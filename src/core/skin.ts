// Skin APPEARANCE metrics from pixel data. These describe what the camera
// recorded under the current lighting — they are not a medical assessment.
import { dist, mean } from './geometry';
import { LM } from './landmarks';
import type { PixelBuffer, Point2 } from './types';

const PATCH = 48; // samples per patch side

/** Skin patch centres: cheeks, forehead, chin. */
export const SKIN_PATCHES = [
  { name: 'right cheek', index: 50, radius: 0.07 },
  { name: 'left cheek', index: 280, radius: 0.07 },
  { name: 'forehead', index: 151, radius: 0.06 },
  { name: 'chin', index: 199, radius: 0.045 },
];

function srgbToLinear(c: number) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** sRGB 0..255 -> CIE L*a*b* (D65). */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Separable box blur with clamped edges. */
export function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r <= 0) return src.slice();
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let k = -r; k <= r; k++) { const xx = Math.min(w - 1, Math.max(0, x + k)); s += src[y * w + xx]; n++; }
      tmp[y * w + x] = s / n;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let k = -r; k <= r; k++) { const yy = Math.min(h - 1, Math.max(0, y + k)); s += tmp[yy * w + x]; n++; }
      out[y * w + x] = s / n;
    }
  }
  return out;
}

function samplePatch(buf: PixelBuffer, c: Point2, radius: number) {
  const L = new Float32Array(PATCH * PATCH), A = new Float32Array(PATCH * PATCH);
  const ch = buf.data.length / (buf.width * buf.height);
  for (let j = 0; j < PATCH; j++) {
    for (let i = 0; i < PATCH; i++) {
      const x = Math.round(c.x - radius + (2 * radius * (i + 0.5)) / PATCH);
      const y = Math.round(c.y - radius + (2 * radius * (j + 0.5)) / PATCH);
      const xx = Math.min(buf.width - 1, Math.max(0, x)), yy = Math.min(buf.height - 1, Math.max(0, y));
      const k = (yy * buf.width + xx) * ch;
      const [l, a] = rgbToLab(buf.data[k], buf.data[k + 1], buf.data[k + 2]);
      L[j * PATCH + i] = l; A[j * PATCH + i] = a;
    }
  }
  return { L, A };
}

function stdOf(a: Float32Array) {
  let s = 0, s2 = 0;
  for (const v of a) { s += v; s2 += v * v; }
  const m = s / a.length;
  return Math.sqrt(Math.max(0, s2 / a.length - m * m));
}

export interface SkinMetrics { skinEvenness: number; skinTexture: number; rednessVariation: number; patches: number }

/**
 * px: landmark pixel coordinates for this image.
 * Patches whose radius would fall outside the image are skipped.
 */
export function skinMetrics(buf: PixelBuffer, px: Point2[]): SkinMetrics | null {
  const faceW = dist(px[LM.cheekR], px[LM.cheekL]);
  if (!(faceW > 0)) return null;
  const even: number[] = [], tex: number[] = [], red: number[] = [];
  for (const patch of SKIN_PATCHES) {
    const c = px[patch.index];
    const r = patch.radius * faceW;
    if (!c || c.x - r < 0 || c.y - r < 0 || c.x + r >= buf.width || c.y + r >= buf.height) continue;
    const { L, A } = samplePatch(buf, c, r);
    const fine = boxBlur(L, PATCH, PATCH, 1);
    const midB = boxBlur(L, PATCH, PATCH, 3);
    const large = boxBlur(L, PATCH, PATCH, 12);
    const band = new Float32Array(L.length), hf = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) { band[i] = midB[i] - large[i]; hf[i] = Math.abs(L[i] - fine[i]); }
    even.push(stdOf(band));
    tex.push(mean(Array.from(hf)));
    const aBand = boxBlur(A, PATCH, PATCH, 2), aLarge = boxBlur(A, PATCH, PATCH, 12);
    const ad = new Float32Array(A.length);
    for (let i = 0; i < A.length; i++) ad[i] = aBand[i] - aLarge[i];
    red.push(stdOf(ad));
  }
  if (even.length < 2) return null;
  return { skinEvenness: mean(even), skinTexture: mean(tex), rednessVariation: mean(red), patches: even.length };
}
