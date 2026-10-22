// One-time setup: copies MediaPipe WASM runtime and downloads the Face Landmarker
// model into public/ so the app never needs a CDN at runtime (offline-first).
import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const wasmDst = join(root, 'public', 'mediapipe', 'wasm');
const modelDst = join(root, 'public', 'models', 'face_landmarker.task');
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

if (!existsSync(wasmSrc)) {
  console.error('Missing @mediapipe/tasks-vision. Run `npm install` first.');
  process.exit(1);
}
mkdirSync(wasmDst, { recursive: true });
cpSync(wasmSrc, wasmDst, { recursive: true });
console.log('✔ WASM runtime copied to public/mediapipe/wasm');

if (existsSync(modelDst) && statSync(modelDst).size > 1_000_000) {
  console.log('✔ Model already present:', modelDst);
} else {
  mkdirSync(dirname(modelDst), { recursive: true });
  console.log('↓ Downloading face_landmarker.task (~3.6 MB) …');
  const res = await fetch(MODEL_URL);
  if (!res.ok) {
    console.error(`Download failed: HTTP ${res.status}. Download manually from\n  ${MODEL_URL}\nand save to ${modelDst}`);
    process.exit(1);
  }
  writeFileSync(modelDst, Buffer.from(await res.arrayBuffer()));
  console.log('✔ Model saved to public/models/face_landmarker.task');
}
