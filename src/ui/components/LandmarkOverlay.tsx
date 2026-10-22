import { LM } from '../../core/landmarks';
import type { PhotoRecord } from '../../core/types';
import { usePhotoUrl } from '../store';

const LINES: [number, number, string][] = [
  [LM.cheekR, LM.cheekL, '#60a5fa'],
  [LM.jawR, LM.jawL, '#60a5fa'],
  [LM.eyeOuterR, LM.eyeInnerR, '#c4b5fd'],
  [LM.eyeInnerL, LM.eyeOuterL, '#c4b5fd'],
  [LM.eyeInnerR, LM.eyeInnerL, '#22d3ee'],
  [LM.alarR, LM.alarL, '#22d3ee'],
  [LM.mouthR, LM.mouthL, '#f0abfc'],
  [LM.foreheadTop, LM.menton, 'rgba(255,255,255,0.35)'],
];

export function LandmarkOverlay({ photo, showPoints = true, className = '' }: { photo: PhotoRecord; showPoints?: boolean; className?: string }) {
  const url = usePhotoUrl(photo.image);
  const { width: w, height: h, landmarks } = photo;
  const r = Math.max(w, h) / 380;
  return (
    <div className={`relative overflow-hidden rounded-xl bg-black ${className}`}>
      {url ? <img src={url} alt="Analysed face" className="block h-auto w-full" /> : <div className="grid aspect-[3/4] place-items-center text-sm text-slate-500">Photo not stored</div>}
      {showPoints && landmarks && (
        <svg viewBox={`0 0 ${w} ${h}`} className="pointer-events-none absolute inset-0 h-full w-full">
          {landmarks.slice(0, 468).map((p, i) => <circle key={i} cx={p.x * w} cy={p.y * h} r={r * 0.6} fill="rgba(167,139,250,0.55)" />)}
          {LINES.map(([a, b, c], i) => (
            <line key={i} x1={landmarks[a].x * w} y1={landmarks[a].y * h} x2={landmarks[b].x * w} y2={landmarks[b].y * h} stroke={c} strokeWidth={r * 0.9} strokeLinecap="round" />
          ))}
        </svg>
      )}
    </div>
  );
}
