// FacialMeasurements: turns landmarks of ONE photo into raw, unit-bearing
// measurements. No scoring happens here.
import { angleAt3, angleUp, dist, fitLine, mean, mid, reflect, rotate, RAD2DEG } from './geometry';
import { LM, MIDLINE, MIRROR_PAIRS, toPixels, toPixels3 } from './landmarks';
import { METRIC_BY_ID } from './metrics';
import type { HeadPose, Measurement, Point2, Point3, Pose } from './types';

export interface PhotoGeometryInput {
  photoId: string;
  landmarks: Point3[]; // normalised (MediaPipe output)
  width: number;
  height: number;
  pose: Pose;
  headPose: HeadPose;
  qualityScore: number; // 0..1
}

/** Rotate pixel landmarks so the fitted facial midline is vertical (removes roll). */
export function alignToMidline(px: Point2[]): { pts: Point2[]; midline: { c: Point2; d: Point2 }; angle: number } {
  const midline = fitLine(MIDLINE.map((i) => px[i]));
  // Direction should point downwards (forehead -> chin).
  let d = midline.d;
  const top = px[LM.foreheadTop], bot = px[LM.menton];
  if ((bot.x - top.x) * d.x + (bot.y - top.y) * d.y < 0) d = { x: -d.x, y: -d.y };
  const angle = Math.atan2(d.x, d.y) * RAD2DEG; // deviation from +y
  const pts = px.map((p) => rotate(p, midline.c, angle));
  return { pts, midline: { c: midline.c, d }, angle };
}

export function eyeAspect(px: Point2[]): number {
  const r = dist(px[LM.eyeTopR], px[LM.eyeBottomR]) / dist(px[LM.eyeOuterR], px[LM.eyeInnerR]);
  const l = dist(px[LM.eyeTopL], px[LM.eyeBottomL]) / dist(px[LM.eyeOuterL], px[LM.eyeInnerL]);
  return (r + l) / 2;
}

export function mouthOpenness(px: Point2[]): number {
  return dist(px[LM.upperLipInner], px[LM.lowerLipInner]) / dist(px[LM.nasion], px[LM.menton]);
}

/** Front-view 2D metrics (values only). Exported for unit tests. */
export function frontMetrics(px: Point2[]): Record<string, number> {
  const { pts: p } = alignToMidline(px);
  const browY = (p[LM.browMidR].y + p[LM.browMidL].y) / 2;
  const bizyg = Math.abs(p[LM.cheekL].x - p[LM.cheekR].x);
  const faceH = p[LM.menton].y - p[LM.nasion].y;
  const eyeWR = dist(p[LM.eyeOuterR], p[LM.eyeInnerR]);
  const eyeWL = dist(p[LM.eyeOuterL], p[LM.eyeInnerL]);
  const eyeW = (eyeWR + eyeWL) / 2;
  const icd = dist(p[LM.eyeInnerR], p[LM.eyeInnerL]);
  const alar = dist(p[LM.alarR], p[LM.alarL]);

  // Canthal tilt per eye: inner -> outer corner, positive when outer is higher.
  const tiltR = angleUp(p[LM.eyeInnerR], p[LM.eyeOuterR]);
  const tiltL = angleUp(p[LM.eyeInnerL], p[LM.eyeOuterL]);
  // R eye goes leftwards in the image (angle near 180°); fold to [-90, 90].
  const fold = (a: number) => (a > 90 ? 180 - a : a < -90 ? -180 - a : a);

  const eyeCR = mid(p[LM.eyeOuterR], p[LM.eyeInnerR]);
  const eyeCL = mid(p[LM.eyeOuterL], p[LM.eyeInnerL]);

  // Symmetry: reflect subject-left points across the midline, compare to right.
  const line = fitLine(MIDLINE.map((i) => p[i]));
  const asym = MIRROR_PAIRS.map(([r, l]) => dist(p[r], reflect(p[l], line)) / bizyg);

  return {
    thirdsRatio: (p[LM.menton].y - p[LM.subnasale].y) / (p[LM.subnasale].y - browY),
    fwhr: bizyg / (p[LM.upperLipTop].y - browY),
    mouthNoseRatio: dist(p[LM.mouthR], p[LM.mouthL]) / alar,
    lipRatio: dist(p[LM.lowerLipInner], p[LM.lowerLipBottom]) / dist(p[LM.upperLipTop], p[LM.upperLipInner]),
    faceLengthRatio: (p[LM.menton].y - p[LM.foreheadTop].y) / bizyg,
    symmetryIndex: mean(asym) * 100,
    eyeLevelDiff: (Math.abs(eyeCR.y - eyeCL.y) / faceH) * 100,
    mouthLevelDiff: (Math.abs(p[LM.mouthR].y - p[LM.mouthL].y) / faceH) * 100,
    canthalTilt: (fold(tiltR) + fold(tiltL)) / 2,
    intercanthalRatio: icd / eyeW,
    eyeWidthRatio: eyeW / bizyg,
    eyeAspect: eyeAspect(p),
    alarIntercanthal: alar / icd,
    noseLengthRatio: (p[LM.subnasale].y - p[LM.nasion].y) / faceH,
    jawRatio: dist(p[LM.jawR], p[LM.jawL]) / bizyg,
    chinPhiltrum: dist(p[LM.lowerLipBottom], p[LM.menton]) / dist(p[LM.subnasale], p[LM.upperLipTop]),
  };
}

/** Gonial angle from the 3D mesh on the side facing the camera (or the mean of both). */
export function gonialAngle(p3: Point3[], pose: Pose): number {
  const side = (s: 'R' | 'L') =>
    s === 'R' ? angleAt3(p3[LM.cheekR], p3[LM.jawR], p3[LM.menton]) : angleAt3(p3[LM.cheekL], p3[LM.jawL], p3[LM.menton]);
  if (pose === 'profileLeft' || pose === 'threeQuarterLeft') return side('L');
  if (pose === 'profileRight' || pose === 'threeQuarterRight') return side('R');
  return (side('L') + side('R')) / 2;
}

/** How well the head pose suits a metric's intended view (0..1). */
export function poseFit(metricPoses: Pose[], pose: Pose, hp: HeadPose): number {
  if (!metricPoses.includes(pose)) return 0;
  if (pose === 'front') {
    const frontOnly = metricPoses.length === 1;
    // Front-only metrics degrade quickly with yaw; side-capable ones prefer side views.
    return frontOnly ? Math.max(0.3, 1 - Math.abs(hp.yaw) / 20) : 0.6;
  }
  return 1;
}

export function computeMeasurements(input: PhotoGeometryInput): Measurement[] {
  const { landmarks, width, height, pose, headPose, photoId, qualityScore } = input;
  if (landmarks.length < 468) return [];
  const px = toPixels(landmarks, width, height);
  const ear = eyeAspect(px);
  const mouth = mouthOpenness(px);
  const values: Record<string, number> = {};
  if (pose === 'front') Object.assign(values, frontMetrics(px));
  values.gonialAngle = gonialAngle(toPixels3(landmarks, width, height), pose);

  const out: Measurement[] = [];
  for (const [id, value] of Object.entries(values)) {
    const def = METRIC_BY_ID[id];
    if (!def || !Number.isFinite(value)) continue;
    const fit = poseFit(def.poses, pose, headPose);
    if (fit === 0) continue;
    let conf = def.reliability * qualityScore * fit;
    if (def.sensitiveTo === 'mouth' && mouth > 0.04) conf *= 0.3;
    if (def.sensitiveTo === 'eyes' && ear < 0.16) conf *= 0.3;
    out.push({ id, value, pose, photoId, confidence: Math.round(conf * 1000) / 1000 });
  }
  return out;
}
