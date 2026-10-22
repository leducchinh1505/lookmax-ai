import { describe, expect, it } from 'vitest';
import { assessQuality, imageStats, type FaceQualityInput } from './imageQuality';
import { skinMetrics, rgbToLab } from './skin';
import { solidImage, syntheticPixels } from './testing/syntheticFace';

function checker(w: number, h: number, cell = 4) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = ((x / cell) ^ (y / cell)) & 1 ? 200 : 60;
    const i = (y * w + x) * 4; data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255;
  }
  return { data, width: w, height: h };
}

const good: FaceQualityInput = {
  imageWidth: 1200, imageHeight: 1600, faceCount: 1, faceBox: { x: 300, y: 400, w: 600, h: 700 },
  stats: { brightness: 130, contrast: 40, sharpness: 120, clippedHigh: 0, clippedLow: 0 },
  headPose: { yaw: 2, pitch: 3, roll: 1 }, pose: 'front', intended: 'front', eyeOpenness: 0.3, mouthOpen: 0.01,
};

describe('imageStats', () => {
  it('measures brightness and zero sharpness on a flat image', () => {
    const s = imageStats(solidImage(200, 200, [100, 100, 100]));
    expect(s.brightness).toBeCloseTo(100, 0);
    expect(s.sharpness).toBeCloseTo(0, 5);
    expect(s.contrast).toBeCloseTo(0, 5);
  });
  it('reports high sharpness for fine detail', () => {
    expect(imageStats(checker(256, 256)).sharpness).toBeGreaterThan(1000);
  });
  it('detects clipping', () => {
    expect(imageStats(solidImage(50, 50, [255, 255, 255])).clippedHigh).toBe(1);
  });
});

describe('assessQuality', () => {
  it('passes a good photo with full quality score', () => {
    const r = assessQuality(good);
    expect(r.usable).toBe(true);
    expect(r.score).toBe(1);
  });
  it('fails when no face is detected', () => {
    const r = assessQuality({ ...good, faceCount: 0, faceBox: null });
    expect(r.usable).toBe(false);
    expect(r.checks.find((c) => c.id === 'face')!.status).toBe('fail');
  });
  it('fails on blur, darkness, tiny images', () => {
    expect(assessQuality({ ...good, stats: { ...good.stats, sharpness: 3 } }).usable).toBe(false);
    expect(assessQuality({ ...good, stats: { ...good.stats, brightness: 30 } }).usable).toBe(false);
    expect(assessQuality({ ...good, imageWidth: 300, imageHeight: 300 }).usable).toBe(false);
  });
  it('warns (reducing confidence) on mismatched angle, closed eyes, open mouth', () => {
    const r = assessQuality({ ...good, intended: 'left', eyeOpenness: 0.1, mouthOpen: 0.08 });
    expect(r.usable).toBe(true);
    expect(r.score).toBeLessThan(0.7);
    expect(r.checks.filter((c) => c.status === 'warn').map((c) => c.id)).toEqual(expect.arrayContaining(['angle', 'eyes', 'expression']));
  });
});

describe('skin appearance', () => {
  const px = syntheticPixels();
  it('converts sRGB white to L*≈100, a*≈0', () => {
    const [L, a] = rgbToLab(255, 255, 255);
    expect(L).toBeCloseTo(100, 0);
    expect(Math.abs(a)).toBeLessThan(0.5);
  });
  it('is ~0 on perfectly uniform skin', () => {
    const s = skinMetrics(solidImage(1000, 1000, [200, 160, 140]), px)!;
    expect(s.patches).toBe(4);
    expect(s.skinEvenness).toBeLessThan(0.01);
    expect(s.skinTexture).toBeLessThan(0.01);
    expect(s.rednessVariation).toBeLessThan(0.01);
  });
  it('rises with fine noise', () => {
    const s = skinMetrics(solidImage(1000, 1000, [200, 160, 140], 30), px)!;
    expect(s.skinTexture).toBeGreaterThan(1);
  });
});
