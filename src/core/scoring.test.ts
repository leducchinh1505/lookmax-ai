import { describe, expect, it } from 'vitest';
import { METRICS } from './metrics';
import { aggregate, confidenceLabel, groomingMeasurements, interpret, rangeScore, scoreMeasurements } from './scoring';
import { computeMeasurements } from './measurements';
import { syntheticPixels, toNormalised } from './testing/syntheticFace';
import type { Measurement } from './types';

const m = (id: string, value: number, confidence = 0.8, photoId = 'p1'): Measurement => ({ id, value, confidence, photoId, pose: 'front' });

describe('rangeScore', () => {
  it('is 100 inside the range, 40 at one tolerance, 0 far away', () => {
    expect(rangeScore(1.0, [0.9, 1.1], 0.3)).toBe(100);
    expect(rangeScore(0.9, [0.9, 1.1], 0.3)).toBe(100);
    expect(rangeScore(1.4, [0.9, 1.1], 0.3)).toBe(40);
    expect(rangeScore(0.6, [0.9, 1.1], 0.3)).toBe(40);
    expect(rangeScore(5, [0.9, 1.1], 0.3)).toBe(0);
  });
  it('decreases monotonically away from the range', () => {
    let prev = 101;
    for (let v = 1.1; v < 2; v += 0.05) { const s = rangeScore(v, [0.9, 1.1], 0.3); expect(s).toBeLessThanOrEqual(prev); prev = s; }
  });
});

describe('interpret', () => {
  const def = METRICS.find((d) => d.id === 'intercanthalRatio')!;
  it('describes position relative to reference, without judging attractiveness', () => {
    expect(interpret(def, 1)).toBe('Within the reference range');
    expect(interpret(def, 1.2)).toMatch(/Slightly above.*wider-set/);
    expect(interpret(def, 0.5)).toMatch(/Well below.*closer-set/);
  });
});

describe('aggregate', () => {
  it('confidence-weights values and ignores very low confidence', () => {
    const r = aggregate([m('x', 1, 0.8, 'a'), m('x', 2, 0.4, 'b'), m('x', 100, 0.05, 'c')])!;
    expect(r.value).toBeCloseTo((1 * 0.8 + 2 * 0.4) / 1.2, 6);
    expect(r.sources).toEqual(['a', 'b']);
    expect(aggregate([m('x', 1, 0.01)])).toBeNull();
  });
});

describe('scoreMeasurements', () => {
  it('marks every category insufficient with no data and gives no overall score', () => {
    const r = scoreMeasurements([]);
    expect(r.overall).toBeNull();
    expect(r.categories.every((c) => c.status === 'insufficient' && c.score === null)).toBe(true);
  });

  it('requires enough metric coverage to score a category', () => {
    // Nose has weights 2 (alar) + 1 (length). Length alone = 33% coverage < 50%.
    const only = scoreMeasurements([m('noseLengthRatio', 0.43)]);
    expect(only.categories.find((c) => c.id === 'nose')!.status).toBe('insufficient');
    const both = scoreMeasurements([m('noseLengthRatio', 0.43), m('alarIntercanthal', 1.0)]);
    expect(both.categories.find((c) => c.id === 'nose')!.score).toBe(100);
  });

  it('never scores informational (weight 0) metrics', () => {
    const r = scoreMeasurements([m('faceLengthRatio', 1.3)]);
    const metric = r.categories.flatMap((c) => c.metrics).find((x) => x.id === 'faceLengthRatio')!;
    expect(metric.value).toBe(1.3);
    expect(metric.score).toBeNull();
  });

  it('is deterministic (no randomness) and scores the synthetic face', () => {
    const lms = toNormalised(syntheticPixels());
    const ms = computeMeasurements({ photoId: 'f', landmarks: lms, width: 1000, height: 1000, pose: 'front', headPose: { yaw: 0, pitch: 0, roll: 0 }, qualityScore: 1 });
    const a = scoreMeasurements(ms), b = scoreMeasurements(ms);
    expect(a).toEqual(b);
    expect(a.overall).not.toBeNull();
    expect(a.categories.find((c) => c.id === 'symmetry')!.score).toBe(100);
    expect(a.categories.find((c) => c.id === 'skin')!.status).toBe('insufficient'); // no pixels given
  });

  it('needs ≥3 scored categories for an overall score', () => {
    const two = scoreMeasurements([m('alarIntercanthal', 1), m('noseLengthRatio', 0.43), m('symmetryIndex', 1), m('eyeLevelDiff', 0.5), m('mouthLevelDiff', 0.5)]);
    expect(two.categories.filter((c) => c.score !== null)).toHaveLength(2);
    expect(two.overall).toBeNull();
  });

  it('scores self-reported grooming separately', () => {
    const r = scoreMeasurements(groomingMeasurements({ hairCondition: 5, haircutRecency: 5, facialHairKept: 4, eyebrowsGroomed: 3, skincareRoutine: 1 }));
    const g = r.categories.find((c) => c.id === 'grooming')!;
    expect(g.status).toBe('scored');
    expect(g.score).toBeGreaterThan(50);
    expect(g.score).toBeLessThan(100);
  });

  it('labels confidence bands', () => {
    expect(confidenceLabel(0.7)).toBe('High');
    expect(confidenceLabel(0.45)).toBe('Medium');
    expect(confidenceLabel(0.25)).toBe('Low');
    expect(confidenceLabel(0.05)).toBe('Very low');
  });
});

describe('metric definitions', () => {
  it('are well formed', () => {
    const ids = new Set<string>();
    for (const d of METRICS) {
      expect(ids.has(d.id)).toBe(false); ids.add(d.id);
      expect(d.target[0]).toBeLessThanOrEqual(d.target[1]);
      expect(d.tolerance).toBeGreaterThan(0);
      expect(d.reliability).toBeGreaterThan(0);
      expect(d.reliability).toBeLessThanOrEqual(1);
      expect(d.reference.length).toBeGreaterThan(5);
    }
  });
});
