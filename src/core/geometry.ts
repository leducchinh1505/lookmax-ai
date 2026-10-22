import type { Point2, Point3 } from './types';

export const RAD2DEG = 180 / Math.PI;

export function dist(a: Point2, b: Point2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function dist3(a: Point3, b: Point3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function mid(a: Point2, b: Point2): Point2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Angle of vector a->b in degrees, with +y pointing UP (image y is flipped). */
export function angleUp(a: Point2, b: Point2): number {
  return Math.atan2(-(b.y - a.y), b.x - a.x) * RAD2DEG;
}

/** Interior angle ABC in degrees (3D). */
export function angleAt3(a: Point3, b: Point3, c: Point3): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const v2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const n = Math.hypot(v1.x, v1.y, v1.z) * Math.hypot(v2.x, v2.y, v2.z);
  if (n === 0) return NaN;
  return Math.acos(Math.max(-1, Math.min(1, dot / n))) * RAD2DEG;
}

export function rotate(p: Point2, origin: Point2, deg: number): Point2 {
  const r = deg / RAD2DEG;
  const c = Math.cos(r), s = Math.sin(r);
  const dx = p.x - origin.x, dy = p.y - origin.y;
  return { x: origin.x + dx * c - dy * s, y: origin.y + dx * s + dy * c };
}

/** Total-least-squares line through points: returns centroid and unit direction. */
export function fitLine(points: Point2[]): { c: Point2; d: Point2 } {
  const n = points.length;
  const c = { x: points.reduce((s, p) => s + p.x, 0) / n, y: points.reduce((s, p) => s + p.y, 0) / n };
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of points) {
    const dx = p.x - c.x, dy = p.y - c.y;
    sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { c, d: { x: Math.cos(theta), y: Math.sin(theta) } };
}

/** Reflect p across the line (c, unit d). */
export function reflect(p: Point2, line: { c: Point2; d: Point2 }): Point2 {
  const vx = p.x - line.c.x, vy = p.y - line.c.y;
  const t = vx * line.d.x + vy * line.d.y;
  const px = line.c.x + t * line.d.x, py = line.c.y + t * line.d.y;
  return { x: 2 * px - p.x, y: 2 * py - p.y };
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

export function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
}
