// FaceDetection / FaceLandmarks: thin wrapper around MediaPipe Face Landmarker.
// The WASM runtime and model are served from this app's own origin
// (public/mediapipe, public/models) — no CDN, works offline.
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { Point3 } from '../core/types';

export interface Detection {
  faces: { landmarks: Point3[]; matrix: number[] | null; blendshapes: Record<string, number> }[];
}

let instance: Promise<FaceLandmarker> | null = null;

function assetUrl(path: string) {
  return new URL(path, document.baseURI).href;
}

async function create(delegate: 'GPU' | 'CPU') {
  const fileset = await FilesetResolver.forVisionTasks(assetUrl('mediapipe/wasm'));
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: assetUrl('models/face_landmarker.task'), delegate },
    runningMode: 'IMAGE',
    numFaces: 3,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });
}

export function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (!instance) {
    // GPU is faster but unavailable on some machines/WebViews; fall back to CPU.
    instance = create('GPU').catch(() => create('CPU'));
    instance.catch(() => { instance = null; });
  }
  return instance;
}

export async function detectFaces(image: HTMLCanvasElement | HTMLImageElement | ImageBitmap): Promise<Detection> {
  const lm = await getFaceLandmarker();
  const r = lm.detect(image);
  return {
    faces: r.faceLandmarks.map((landmarks, i) => ({
      landmarks: landmarks.map((p) => ({ x: p.x, y: p.y, z: p.z })),
      matrix: r.facialTransformationMatrixes?.[i] ? Array.from(r.facialTransformationMatrixes[i].data) : null,
      blendshapes: Object.fromEntries((r.faceBlendshapes?.[i]?.categories ?? []).map((c) => [c.categoryName, c.score])),
    })),
  };
}
