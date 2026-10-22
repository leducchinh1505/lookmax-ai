// Analysis pipeline: image -> quality gate -> landmarks -> measurements -> scores -> plan.
import { assessQuality, imageStats } from '../core/imageQuality';
import { classifyPose, estimateHeadPose, faceBox, headPoseFromMatrix, toPixels } from '../core/landmarks';
import { computeMeasurements, eyeAspect, mouthOpenness, poseFit } from '../core/measurements';
import { METRIC_BY_ID } from '../core/metrics';
import { groomingMeasurements, scoreMeasurements } from '../core/scoring';
import { skinMetrics } from '../core/skin';
import type { AnalysisRecord, GroomingSelfReport, HeadPose, IntendedAngle, Measurement, PhotoRecord } from '../core/types';
import { detectFaces } from './faceDetection';
import { canvasToBlob } from './imageLoader';

export const APP_VERSION = '0.1.0';

export interface PhotoInput { id: string; intended: IntendedAngle; canvas: HTMLCanvasElement }
export interface PhotoAnalysis { photo: PhotoRecord; measurements: Measurement[] }

export function uid(): string {
  return (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
}

/** Combine matrix-based pose (robust magnitude) with the landmark estimate (known sign convention). */
function resolveHeadPose(matrix: number[] | null, lmPose: HeadPose): HeadPose {
  if (!matrix) return lmPose;
  const m = headPoseFromMatrix(matrix);
  const sign = (a: number, ref: number) => (Math.abs(ref) < 3 ? a : Math.sign(ref) * Math.abs(a));
  return { yaw: sign(m.yaw, lmPose.yaw), pitch: m.pitch, roll: sign(m.roll, lmPose.roll) };
}

export async function analyzePhoto(input: PhotoInput): Promise<PhotoAnalysis> {
  const { canvas } = input;
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const pixels = ctx.getImageData(0, 0, w, h);
  const det = await detectFaces(canvas);

  // Largest face wins when several are detected.
  const faces = det.faces.map((f) => ({ f, box: faceBox(toPixels(f.landmarks, w, h)) })).sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h);
  const main = faces[0];

  let headPose: HeadPose | null = null, pose = null, ear: number | null = null, mouth: number | null = null;
  let stats = imageStats(pixels);
  if (main) {
    const px = toPixels(main.f.landmarks, w, h);
    headPose = resolveHeadPose(main.f.matrix, estimateHeadPose(px));
    pose = classifyPose(headPose);
    stats = imageStats(pixels, main.box);
    if (pose === 'front' || pose.startsWith('threeQuarter')) { ear = eyeAspect(px); mouth = mouthOpenness(px); }
  }
  const quality = assessQuality({
    imageWidth: w, imageHeight: h, stats, faceCount: det.faces.length, faceBox: main?.box ?? null,
    headPose, pose, intended: input.intended, eyeOpenness: ear, mouthOpen: mouth,
  });

  let measurements: Measurement[] = [];
  if (main && quality.usable && headPose && pose) {
    measurements = computeMeasurements({ photoId: input.id, landmarks: main.f.landmarks, width: w, height: h, pose, headPose, qualityScore: quality.score });
    if (pose === 'front') {
      const skin = skinMetrics(pixels, toPixels(main.f.landmarks, w, h));
      if (skin) {
        // Skin readings are extra-sensitive to blur and exposure clipping.
        const sharpPenalty = stats.sharpness < 60 ? 0.6 : 1;
        const clipPenalty = Math.max(stats.clippedHigh, stats.clippedLow) > 0.06 ? 0.6 : 1;
        for (const id of ['skinEvenness', 'skinTexture', 'rednessVariation'] as const) {
          const def = METRIC_BY_ID[id];
          const conf = def.reliability * quality.score * poseFit(def.poses, pose, headPose) * sharpPenalty * clipPenalty;
          measurements.push({ id, value: skin[id], pose, photoId: input.id, confidence: Math.round(conf * 1000) / 1000 });
        }
      }
    }
  }

  return {
    photo: {
      id: input.id, intended: input.intended, detectedPose: pose, headPose, quality,
      landmarks: main ? main.f.landmarks : null, width: w, height: h,
      image: await canvasToBlob(canvas),
    },
    measurements,
  };
}

/** Combine per-photo results (already quality-checked) into one scored record. */
export function buildRecord(results: PhotoAnalysis[], grooming: GroomingSelfReport | null, keepPhotos = true): AnalysisRecord {
  const measurements = results.flatMap((r) => r.measurements);
  const all = grooming ? [...measurements, ...groomingMeasurements(grooming)] : measurements;
  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    photos: results.map((r) => (keepPhotos ? r.photo : { ...r.photo, image: '' })),
    measurements: all,
    report: scoreMeasurements(all),
    grooming,
    appVersion: APP_VERSION,
  };
}
