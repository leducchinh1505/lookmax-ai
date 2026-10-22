// MediaPipe Face Mesh landmark indices (478-point topology) and pose helpers.
// "R"/"L" are the SUBJECT's right/left (R appears on the image's left in a
// non-mirrored photo).
import { angleUp, clamp, dist, RAD2DEG } from './geometry';
import type { HeadPose, IntendedAngle, Point2, Point3, Pose } from './types';

export const LM = {
  foreheadTop: 10,
  glabella: 9,
  nasion: 168,
  noseBridge: 6,
  noseTip: 1,
  subnasale: 2,
  upperLipTop: 0,
  upperLipInner: 13,
  lowerLipInner: 14,
  lowerLipBottom: 17,
  menton: 152,
  mouthR: 61,
  mouthL: 291,
  eyeOuterR: 33,
  eyeInnerR: 133,
  eyeInnerL: 362,
  eyeOuterL: 263,
  eyeTopR: 159,
  eyeBottomR: 145,
  eyeTopL: 386,
  eyeBottomL: 374,
  browMidR: 105,
  browMidL: 334,
  cheekR: 234,
  cheekL: 454,
  jawR: 172,
  jawL: 397,
  alarR: 129,
  alarL: 358,
  irisR: 468,
  irisL: 473,
} as const;

/** Midline landmarks used to fit the facial symmetry axis. */
export const MIDLINE = [10, 151, 9, 168, 6, 197, 195, 5, 4, 1, 2, 0, 13, 14, 17, 18, 200, 199, 175, 152];

/** Bilateral landmark pairs [subject-right, subject-left]. */
export const MIRROR_PAIRS: [number, number][] = [
  [33, 263], [133, 362], [159, 386], [145, 374], [160, 387], [144, 373],
  [70, 300], [105, 334], [107, 336], [46, 276],
  [61, 291], [40, 270], [37, 267], [91, 321], [84, 314],
  [129, 358], [98, 327], [64, 294],
  [234, 454], [93, 323], [132, 361], [58, 288], [172, 397], [136, 365], [149, 378],
  [50, 280], [205, 425], [187, 411], [123, 352], [116, 345],
];

export function toPixels(lms: Point3[], width: number, height: number): Point2[] {
  return lms.map((p) => ({ x: p.x * width, y: p.y * height }));
}

/** 3D points in pixel-like units (MediaPipe z shares x's scale). */
export function toPixels3(lms: Point3[], width: number, height: number): Point3[] {
  return lms.map((p) => ({ x: p.x * width, y: p.y * height, z: p.z * width }));
}

/**
 * Head pose from landmarks alone (used when the transformation matrix is not
 * available, and in tests). Yaw>0 means the face is turned so the subject's
 * LEFT cheek is more visible.
 */
export function estimateHeadPose(px: Point2[]): HeadPose {
  const nose = px[LM.noseTip], cR = px[LM.cheekR], cL = px[LM.cheekL];
  const dR = dist(nose, cR), dL = dist(nose, cL);
  // Asymmetry of nose-to-cheek distances approximates sin(yaw).
  // Turning toward the subject's right brings the nose closer to cheekR in 2D.
  const yaw = Math.asin(clamp(((dL - dR) / (dR + dL)) * 1.15, -1, 1)) * RAD2DEG || 0;
  const roll = -angleUp(px[LM.eyeOuterR], px[LM.eyeOuterL]);
  const top = px[LM.nasion], bottom = px[LM.menton];
  const faceH = dist(top, bottom) || 1;
  // Nose tip position along the nasion->menton axis; ~0.37 when level.
  const t = ((nose.x - top.x) * (bottom.x - top.x) + (nose.y - top.y) * (bottom.y - top.y)) / (faceH * faceH);
  const pitch = (t - 0.37) * 150;
  return { yaw: clampNum(yaw), pitch: clampNum(pitch), roll: clampNum(roll) };
}

function clampNum(v: number) {
  return Number.isFinite(v) ? Math.round(v * 10) / 10 : 0;
}

/** Head pose from MediaPipe's 4x4 column-major facial transformation matrix. */
export function headPoseFromMatrix(m: ArrayLike<number>): HeadPose {
  // Rotation part (column-major): r_ij = m[j*4 + i]
  const r = (i: number, j: number) => m[j * 4 + i];
  const pitch = Math.atan2(r(2, 1), r(2, 2)) * RAD2DEG;
  const yaw = Math.asin(clamp(-r(2, 0), -1, 1)) * RAD2DEG;
  const roll = Math.atan2(r(1, 0), r(0, 0)) * RAD2DEG;
  return { yaw: clampNum(-yaw), pitch: clampNum(pitch), roll: clampNum(roll) };
}

export function classifyPose(hp: HeadPose): Pose {
  const a = Math.abs(hp.yaw);
  if (a < 12) return 'front';
  if (a < 38) return hp.yaw > 0 ? 'threeQuarterLeft' : 'threeQuarterRight';
  return hp.yaw > 0 ? 'profileLeft' : 'profileRight';
}

export function poseMatchesIntent(pose: Pose, intent: IntendedAngle): boolean {
  switch (intent) {
    case 'front': return pose === 'front';
    case 'threeQuarter': return pose === 'threeQuarterLeft' || pose === 'threeQuarterRight';
    case 'left': return pose === 'profileLeft' || pose === 'threeQuarterLeft';
    case 'right': return pose === 'profileRight' || pose === 'threeQuarterRight';
  }
}

export const POSE_LABEL: Record<Pose, string> = {
  front: 'Front',
  threeQuarterLeft: '3/4 (left side)',
  threeQuarterRight: '3/4 (right side)',
  profileLeft: 'Left side',
  profileRight: 'Right side',
};

export const INTENT_LABEL: Record<IntendedAngle, string> = {
  front: 'Front',
  left: 'Left side',
  right: 'Right side',
  threeQuarter: '3/4 angle',
};

/** Face bounding box in pixels from landmarks. */
export function faceBox(px: Point2[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < Math.min(px.length, 468); i++) {
    const p = px[i];
    if (p.x < x0) x0 = p.x; if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x; if (p.y > y1) y1 = p.y;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
