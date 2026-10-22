// Deterministic synthetic landmark set used by unit tests. Coordinates are in
// pixels of a 1000×1000 image and converted to MediaPipe-style normalised form.
import { MIRROR_PAIRS } from '../landmarks';
import type { Point2, Point3 } from '../types';

export const W = 1000, H = 1000;

/** Subject-right side points (image left). Subject-left points are mirrored at x=500. */
const RIGHT: Record<number, [number, number]> = {
  33: [380, 380], 133: [460, 380], 159: [420, 368], 145: [420, 392],
  105: [420, 330], 234: [300, 420], 172: [340, 650], 129: [460, 510], 61: [440, 615],
};
const MID: Record<number, number> = {
  10: 250, 151: 270, 9: 320, 168: 370, 6: 400, 197: 420, 195: 440, 5: 460, 4: 480, 1: 500,
  2: 540, 0: 588, 13: 614, 14: 616, 17: 652, 18: 670, 200: 690, 199: 705, 175: 725, 152: 750,
};

export function syntheticPixels(): Point2[] {
  const pts: Point2[] = Array.from({ length: 478 }, () => ({ x: 500, y: 500 }));
  for (const [i, y] of Object.entries(MID)) pts[+i] = { x: 500, y };
  // Fill remaining mirror pairs with deterministic positions.
  MIRROR_PAIRS.forEach(([r], k) => {
    if (!(r in RIGHT)) pts[r] = { x: 320 + ((k * 37) % 150), y: 330 + ((k * 53) % 380) };
  });
  for (const [i, [x, y]] of Object.entries(RIGHT)) pts[+i] = { x, y };
  for (const [r, l] of MIRROR_PAIRS) pts[l] = { x: 1000 - pts[r].x, y: pts[r].y };
  // Skin patch centres
  pts[50] = { x: 380, y: 470 }; pts[280] = { x: 620, y: 470 };
  return pts;
}

export function toNormalised(px: Point2[], w = W, h = H, z?: (i: number) => number): Point3[] {
  return px.map((p, i) => ({ x: p.x / w, y: p.y / h, z: z ? z(i) / w : 0 }));
}

export function transform(px: Point2[], deg: number, scale = 1, center: Point2 = { x: 500, y: 500 }): Point2[] {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return px.map((p) => {
    const dx = (p.x - center.x) * scale, dy = (p.y - center.y) * scale;
    return { x: center.x + dx * c - dy * s, y: center.y + dx * s + dy * c };
  });
}

/** Solid-colour RGBA buffer, optionally with deterministic noise. */
export function solidImage(w: number, h: number, rgb: [number, number, number], noise = 0) {
  const data = new Uint8ClampedArray(w * h * 4);
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) - 0.5;
  for (let i = 0; i < w * h; i++) {
    const n = noise ? rnd() * noise : 0;
    data[i * 4] = rgb[0] + n; data[i * 4 + 1] = rgb[1] + n; data[i * 4 + 2] = rgb[2] + n; data[i * 4 + 3] = 255;
  }
  return { data, width: w, height: h };
}
