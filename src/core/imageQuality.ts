// Image quality gate. Runs before any scoring so that bad photos lower
// confidence or block analysis instead of silently producing numbers.
import type { CheckStatus, HeadPose, IntendedAngle, PixelBuffer, Pose, QualityCheck, QualityReport } from './types';
import { poseMatchesIntent, POSE_LABEL, INTENT_LABEL } from './landmarks';

export interface Region { x: number; y: number; w: number; h: number }

/** Grayscale crop resampled (box filter) to a fixed width so sharpness is scale-independent. */
export function grayCrop(buf: PixelBuffer, region: Region, targetW = 256): { g: Float32Array; w: number; h: number } {
  const rx = Math.max(0, Math.floor(region.x)), ry = Math.max(0, Math.floor(region.y));
  const rw = Math.max(1, Math.min(buf.width - rx, Math.floor(region.w)));
  const rh = Math.max(1, Math.min(buf.height - ry, Math.floor(region.h)));
  const scale = Math.min(1, targetW / rw);
  const w = Math.max(1, Math.round(rw * scale)), h = Math.max(1, Math.round(rh * scale));
  const g = new Float32Array(w * h);
  const sx = rw / w, sy = rh / h;
  const ch = buf.data.length / (buf.width * buf.height);
  for (let y = 0; y < h; y++) {
    const y0 = ry + Math.floor(y * sy), y1 = Math.max(y0 + 1, ry + Math.floor((y + 1) * sy));
    for (let x = 0; x < w; x++) {
      const x0 = rx + Math.floor(x * sx), x1 = Math.max(x0 + 1, rx + Math.floor((x + 1) * sx));
      let s = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * buf.width + xx) * ch;
          s += 0.299 * buf.data[i] + 0.587 * buf.data[i + 1] + 0.114 * buf.data[i + 2];
          n++;
        }
      }
      g[y * w + x] = s / n;
    }
  }
  return { g, w, h };
}

export interface ImageStats {
  brightness: number; // mean luma 0..255
  contrast: number; // luma std
  sharpness: number; // variance of Laplacian on a 256px-wide crop
  clippedHigh: number; // fraction of pixels >= 250
  clippedLow: number; // fraction <= 5
}

export function imageStats(buf: PixelBuffer, region?: Region): ImageStats {
  const r = region ?? { x: 0, y: 0, w: buf.width, h: buf.height };
  const { g, w, h } = grayCrop(buf, r);
  let s = 0, s2 = 0, hi = 0, lo = 0;
  for (const v of g) { s += v; s2 += v * v; if (v >= 250) hi++; if (v <= 5) lo++; }
  const n = g.length;
  const brightness = s / n;
  const contrast = Math.sqrt(Math.max(0, s2 / n - brightness * brightness));
  let ls = 0, ls2 = 0, ln = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = g[i - 1] + g[i + 1] + g[i - w] + g[i + w] - 4 * g[i];
      ls += lap; ls2 += lap * lap; ln++;
    }
  }
  const lm = ln ? ls / ln : 0;
  const sharpness = ln ? ls2 / ln - lm * lm : 0;
  return { brightness, contrast, sharpness, clippedHigh: hi / n, clippedLow: lo / n };
}

export interface FaceQualityInput {
  imageWidth: number;
  imageHeight: number;
  stats: ImageStats; // computed over the face box
  faceCount: number;
  faceBox: Region | null;
  headPose: HeadPose | null;
  pose: Pose | null;
  intended: IntendedAngle;
  eyeOpenness: number | null; // eye aspect ratio, ~0.25-0.35 open
  mouthOpen: number | null; // inner lip gap / face height
}

export const THRESHOLDS = {
  minSide: 480, goodSide: 900,
  brightLo: 60, brightHi: 205, brightWarnLo: 85, brightWarnHi: 185,
  contrastMin: 18,
  sharpFail: 12, sharpWarn: 35,
  clipWarn: 0.06,
  faceFracFail: 0.15, faceFracWarn: 0.28,
  rollWarn: 8, rollFail: 20,
  pitchWarn: 12, pitchFail: 25,
  earWarn: 0.16,
  mouthWarn: 0.04,
};

function check(id: string, label: string, status: CheckStatus, detail: string, value?: number): QualityCheck {
  return { id, label, status, detail, value };
}

export function assessQuality(q: FaceQualityInput): QualityReport {
  const T = THRESHOLDS;
  const checks: QualityCheck[] = [];
  const minSide = Math.min(q.imageWidth, q.imageHeight);
  checks.push(check('resolution', 'Resolution',
    minSide < T.minSide ? 'fail' : minSide < T.goodSide ? 'warn' : 'pass',
    minSide < T.minSide ? `Image too small (${minSide}px short side, need ≥${T.minSide}).` : `${q.imageWidth}×${q.imageHeight}px`, minSide));

  if (q.faceCount === 0 || !q.faceBox) {
    checks.push(check('face', 'Face detected', 'fail', 'No face found. Use a clear, well-lit photo with the whole face visible.'));
    return finalize(checks);
  }
  checks.push(check('face', 'Face detected', q.faceCount > 1 ? 'warn' : 'pass',
    q.faceCount > 1 ? `${q.faceCount} faces found — the largest one was analysed.` : 'One face found.', q.faceCount));

  const frac = q.faceBox.w / q.imageWidth;
  checks.push(check('faceSize', 'Face size', frac < T.faceFracFail ? 'fail' : frac < T.faceFracWarn ? 'warn' : 'pass',
    frac < T.faceFracFail ? 'Face is too small in frame — move closer.' : `Face fills ${(frac * 100).toFixed(0)}% of width.`, frac));

  const b = q.stats.brightness;
  checks.push(check('brightness', 'Lighting',
    b < T.brightLo || b > T.brightHi ? 'fail' : b < T.brightWarnLo || b > T.brightWarnHi ? 'warn' : 'pass',
    b < T.brightWarnLo ? 'Face is underexposed — face a window or soft light.' : b > T.brightWarnHi ? 'Face is overexposed — avoid direct flash/sun.' : 'Exposure looks fine.', b));

  const clip = Math.max(q.stats.clippedHigh, q.stats.clippedLow);
  checks.push(check('clipping', 'Highlights/shadows', clip > T.clipWarn ? 'warn' : 'pass',
    clip > T.clipWarn ? 'Parts of the face are blown out or crushed; skin metrics are less reliable.' : 'No major clipping.', clip));

  checks.push(check('contrast', 'Contrast', q.stats.contrast < T.contrastMin ? 'warn' : 'pass',
    q.stats.contrast < T.contrastMin ? 'Very flat image (fog, haze or heavy filter?).' : 'OK', q.stats.contrast));

  const s = q.stats.sharpness;
  checks.push(check('sharpness', 'Sharpness', s < T.sharpFail ? 'fail' : s < T.sharpWarn ? 'warn' : 'pass',
    s < T.sharpFail ? 'Image is blurry — hold still and refocus.' : s < T.sharpWarn ? 'Slightly soft; skin texture readings are less reliable.' : 'Sharp.', s));

  if (q.headPose && q.pose) {
    const roll = Math.abs(q.headPose.roll), pitch = Math.abs(q.headPose.pitch);
    checks.push(check('roll', 'Head tilt', roll > T.rollFail ? 'fail' : roll > T.rollWarn ? 'warn' : 'pass',
      roll > T.rollWarn ? `Head tilted ${roll.toFixed(0)}° sideways — keep it level.` : 'Level.', roll));
    checks.push(check('pitch', 'Head up/down', pitch > T.pitchFail ? 'fail' : pitch > T.pitchWarn ? 'warn' : 'pass',
      pitch > T.pitchWarn ? `Chin ${q.headPose.pitch > 0 ? 'down' : 'up'} (~${pitch.toFixed(0)}°). Keep camera at eye level.` : 'Camera at eye level.', pitch));
    const match = poseMatchesIntent(q.pose, q.intended);
    checks.push(check('angle', 'Angle', match ? 'pass' : 'warn',
      match ? `Detected ${POSE_LABEL[q.pose]} (yaw ${q.headPose.yaw.toFixed(0)}°).`
        : `You chose "${INTENT_LABEL[q.intended]}" but the photo looks like ${POSE_LABEL[q.pose]} (yaw ${q.headPose.yaw.toFixed(0)}°). It will be used as detected.`,
      q.headPose.yaw));
  }
  if (q.eyeOpenness !== null) {
    checks.push(check('eyes', 'Eyes open', q.eyeOpenness < T.earWarn ? 'warn' : 'pass',
      q.eyeOpenness < T.earWarn ? 'Eyes look closed or squinting — eye metrics are skipped/less reliable.' : 'Open.', q.eyeOpenness));
  }
  if (q.mouthOpen !== null) {
    checks.push(check('expression', 'Neutral expression', q.mouthOpen > T.mouthWarn ? 'warn' : 'pass',
      q.mouthOpen > T.mouthWarn ? 'Mouth is open — use a relaxed, closed-mouth expression.' : 'Neutral.', q.mouthOpen));
  }
  return finalize(checks);
}

function finalize(checks: QualityCheck[]): QualityReport {
  const fails = checks.filter((c) => c.status === 'fail').length;
  const warns = checks.filter((c) => c.status === 'warn').length;
  const score = fails ? 0 : Math.max(0.35, 1 - warns * 0.12);
  return { checks, score: Math.round(score * 100) / 100, usable: fails === 0 };
}
