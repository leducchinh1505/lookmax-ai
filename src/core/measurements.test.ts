import { describe, expect, it } from 'vitest';
import { classifyPose, estimateHeadPose, headPoseFromMatrix, LM, poseMatchesIntent } from './landmarks';
import { computeMeasurements, frontMetrics, gonialAngle } from './measurements';
import { syntheticPixels, toNormalised, transform } from './testing/syntheticFace';

const base = syntheticPixels();

describe('FacialMeasurements — synthetic symmetric face', () => {
  const m = frontMetrics(base);

  it('computes proportions from landmark positions', () => {
    expect(m.intercanthalRatio).toBeCloseTo(1.0, 5); // 80 / 80
    expect(m.eyeWidthRatio).toBeCloseTo(0.2, 5); // 80 / 400
    expect(m.alarIntercanthal).toBeCloseTo(1.0, 5); // 80 / 80
    expect(m.mouthNoseRatio).toBeCloseTo(1.5, 5); // 120 / 80
    expect(m.jawRatio).toBeCloseTo(0.8, 5); // 320 / 400
    expect(m.thirdsRatio).toBeCloseTo(210 / 210, 5);
    expect(m.noseLengthRatio).toBeCloseTo(170 / 380, 5);
    expect(m.faceLengthRatio).toBeCloseTo(500 / 400, 5);
    expect(m.chinPhiltrum).toBeCloseTo(98 / 48, 5);
    expect(m.lipRatio).toBeCloseTo(36 / 26, 5);
    expect(m.fwhr).toBeCloseTo(400 / 258, 5);
    expect(m.eyeAspect).toBeCloseTo(0.3, 5);
  });

  it('reports zero asymmetry and zero canthal tilt for a mirrored face', () => {
    expect(m.symmetryIndex).toBeCloseTo(0, 6);
    expect(m.eyeLevelDiff).toBeCloseTo(0, 6);
    expect(m.mouthLevelDiff).toBeCloseTo(0, 6);
    expect(m.canthalTilt).toBeCloseTo(0, 6);
  });

  it('is invariant to head roll and image scale', () => {
    for (const [deg, scale] of [[12, 1], [-9, 0.6], [5, 1.4]]) {
      const t = frontMetrics(transform(base, deg, scale));
      for (const k of Object.keys(m)) expect(t[k]).toBeCloseTo(m[k], 4);
    }
  });

  it('measures positive canthal tilt when outer corners are raised', () => {
    const p = base.map((q) => ({ ...q }));
    p[LM.eyeOuterR].y -= 8; p[LM.eyeOuterL].y -= 8; // 8px over 80px -> atan(0.1)
    expect(frontMetrics(p).canthalTilt).toBeCloseTo(Math.atan(0.1) * 57.29578, 3);
    p[LM.eyeOuterR].y += 16; p[LM.eyeOuterL].y += 16;
    expect(frontMetrics(p).canthalTilt).toBeLessThan(0);
  });

  it('detects asymmetry when one side moves', () => {
    const p = base.map((q) => ({ ...q }));
    for (const i of [LM.eyeOuterL, LM.eyeInnerL, LM.eyeTopL, LM.eyeBottomL]) p[i].y -= 10;
    const a = frontMetrics(p);
    expect(a.eyeLevelDiff).toBeGreaterThan(1);
    expect(a.symmetryIndex).toBeGreaterThan(0);
  });
});

describe('Head pose & angle classification', () => {
  it('estimates a level, frontal pose for the synthetic face', () => {
    const hp = estimateHeadPose(base);
    expect(Math.abs(hp.yaw)).toBeLessThan(1);
    expect(Math.abs(hp.roll)).toBeLessThan(1);
    expect(classifyPose(hp)).toBe('front');
  });

  it('detects yaw sign: nose shifted toward subject-right means left cheek is visible', () => {
    const p = base.map((q) => ({ ...q }));
    p[LM.noseTip].x -= 60;
    expect(estimateHeadPose(p).yaw).toBeGreaterThan(10);
  });

  it('classifies poses by yaw thresholds', () => {
    expect(classifyPose({ yaw: 5, pitch: 0, roll: 0 })).toBe('front');
    expect(classifyPose({ yaw: 25, pitch: 0, roll: 0 })).toBe('threeQuarterLeft');
    expect(classifyPose({ yaw: -25, pitch: 0, roll: 0 })).toBe('threeQuarterRight');
    expect(classifyPose({ yaw: 60, pitch: 0, roll: 0 })).toBe('profileLeft');
    expect(poseMatchesIntent('profileRight', 'right')).toBe(true);
    expect(poseMatchesIntent('front', 'left')).toBe(false);
  });

  it('decodes an identity transformation matrix as zero rotation', () => {
    const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const hp = headPoseFromMatrix(I);
    expect(Math.abs(hp.yaw) + Math.abs(hp.pitch) + Math.abs(hp.roll)).toBe(0);
  });
});

describe('computeMeasurements', () => {
  const lms = toNormalised(base);

  it('emits front metrics with confidence scaled by quality', () => {
    const hi = computeMeasurements({ photoId: 'a', landmarks: lms, width: 1000, height: 1000, pose: 'front', headPose: { yaw: 0, pitch: 0, roll: 0 }, qualityScore: 1 });
    const lo = computeMeasurements({ photoId: 'a', landmarks: lms, width: 1000, height: 1000, pose: 'front', headPose: { yaw: 0, pitch: 0, roll: 0 }, qualityScore: 0.5 });
    const c = (ms: typeof hi, id: string) => ms.find((x) => x.id === id)!.confidence;
    expect(hi.map((x) => x.id)).toContain('symmetryIndex');
    expect(c(lo, 'thirdsRatio')).toBeCloseTo(c(hi, 'thirdsRatio') / 2, 3);
  });

  it('only emits side-capable metrics for profile photos', () => {
    const ms = computeMeasurements({ photoId: 'b', landmarks: lms, width: 1000, height: 1000, pose: 'profileLeft', headPose: { yaw: 60, pitch: 0, roll: 0 }, qualityScore: 1 });
    expect(ms.map((x) => x.id)).toEqual(['gonialAngle']);
  });

  it('computes the gonial angle in 3D', () => {
    const p3 = base.map((p) => ({ ...p, z: 0 }));
    // cheekR (300,420) - jawR (340,650) - menton (500,750)
    const v1 = [-40, -230], v2 = [160, 100];
    const exp = (Math.acos((v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2))) * 180) / Math.PI;
    expect(gonialAngle(p3, 'profileRight')).toBeCloseTo(exp, 6);
  });

  it('returns nothing for incomplete landmark sets', () => {
    expect(computeMeasurements({ photoId: 'c', landmarks: lms.slice(0, 100), width: 1, height: 1, pose: 'front', headPose: { yaw: 0, pitch: 0, roll: 0 }, qualityScore: 1 })).toEqual([]);
  });
});
