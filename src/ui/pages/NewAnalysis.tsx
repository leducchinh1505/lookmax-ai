import { useEffect, useRef, useState } from 'react';
import { INTENT_LABEL, POSE_LABEL } from '../../core/landmarks';
import type { GroomingSelfReport, IntendedAngle } from '../../core/types';
import { analyzePhoto, buildRecord, uid, type PhotoAnalysis } from '../../services/analyzer';
import { getFaceLandmarker } from '../../services/faceDetection';
import { fileToCanvas } from '../../services/imageLoader';
import { Camera } from '../components/Camera';
import { Icon } from '../components/Icon';
import { navigate } from '../router';
import { useStore, usePhotoUrl } from '../store';

type Slot = { state: 'empty' } | { state: 'busy' } | { state: 'done'; result: PhotoAnalysis } | { state: 'error'; message: string };

const ANGLES: { id: IntendedAngle; hint: string; required?: boolean }[] = [
  { id: 'front', hint: 'Look straight at the camera, neutral face, hair off forehead.', required: true },
  { id: 'threeQuarter', hint: 'Turn your head ~30° to either side.' },
  { id: 'left', hint: 'Turn so your LEFT cheek faces the camera (~60–80°).' },
  { id: 'right', hint: 'Turn so your RIGHT cheek faces the camera (~60–80°).' },
];

const GROOM_Q: { key: keyof GroomingSelfReport; label: string; low: string; high: string }[] = [
  { key: 'hairCondition', label: 'Hair condition', low: 'Dry/damaged', high: 'Healthy' },
  { key: 'haircutRecency', label: 'Haircut', low: 'Very overdue', high: 'Fresh (≤4 wks)' },
  { key: 'facialHairKept', label: 'Facial hair', low: 'Untidy', high: 'Well kept / shaved' },
  { key: 'eyebrowsGroomed', label: 'Eyebrows', low: 'Ungroomed', high: 'Neat' },
  { key: 'skincareRoutine', label: 'Skincare routine', low: 'None', high: 'Consistent daily' },
];

export function NewAnalysis() {
  const { saveAnalysis, settings } = useStore();
  const [slots, setSlots] = useState<Record<IntendedAngle, Slot>>({ front: { state: 'empty' }, threeQuarter: { state: 'empty' }, left: { state: 'empty' }, right: { state: 'empty' } });
  const [camFor, setCamFor] = useState<IntendedAngle | null>(null);
  const [model, setModel] = useState<'loading' | 'ready' | 'error'>('loading');
  const [modelErr, setModelErr] = useState('');
  const [useGrooming, setUseGrooming] = useState(true);
  const [grooming, setGrooming] = useState<GroomingSelfReport>({ hairCondition: 3, haircutRecency: 3, facialHairKept: 3, eyebrowsGroomed: 3, skincareRoutine: 3 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getFaceLandmarker().then(() => setModel('ready')).catch((e) => { setModel('error'); setModelErr(String(e?.message ?? e)); });
  }, []);

  const process = async (angle: IntendedAngle, canvas: HTMLCanvasElement) => {
    setSlots((s) => ({ ...s, [angle]: { state: 'busy' } }));
    try {
      const result = await analyzePhoto({ id: uid(), intended: angle, canvas });
      setSlots((s) => ({ ...s, [angle]: { state: 'done', result } }));
    } catch (e) {
      setSlots((s) => ({ ...s, [angle]: { state: 'error', message: (e as Error).message } }));
    }
  };

  const onFile = async (angle: IntendedAngle, f: File | undefined) => {
    if (!f) return;
    try { await process(angle, await fileToCanvas(f)); }
    catch (e) { setSlots((s) => ({ ...s, [angle]: { state: 'error', message: (e as Error).message } })); }
  };

  const done = Object.values(slots).filter((s): s is Extract<Slot, { state: 'done' }> => s.state === 'done');
  const usable = done.filter((s) => s.result.photo.quality.usable);
  const busy = Object.values(slots).some((s) => s.state === 'busy');

  const submit = async () => {
    setSaving(true);
    try {
      const rec = buildRecord(done.map((d) => d.result), useGrooming ? grooming : null, settings.keepPhotos);
      await saveAnalysis(rec);
      navigate(`analysis/${rec.id}`);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">New Analysis</h1>
        <p className="mt-1 text-sm text-slate-400">Add a front photo (required) and optional side / 3/4 photos. Each photo is quality-checked before it is used.</p>
      </header>

      {model !== 'ready' && (
        <div className={`card p-4 text-sm ${model === 'error' ? 'border-red-500/30 text-red-300' : 'text-slate-400'}`}>
          {model === 'loading' ? 'Loading the on-device face model…' : `Face model failed to load: ${modelErr}. Run "npm run setup:assets" and restart.`}
        </div>
      )}

      <div className="card p-4 text-sm text-slate-400">
        <div className="mb-2 font-medium text-slate-200">Tips for reliable results</div>
        <ul className="grid gap-1 sm:grid-cols-2">
          <li>• Soft, even light facing you (window light is ideal)</li>
          <li>• Camera at eye level, ~1 m away (avoid arm-length selfies)</li>
          <li>• Neutral expression, mouth closed, eyes open</li>
          <li>• No glasses, hair off the face, no beauty filters</li>
        </ul>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {ANGLES.map((a) => (
          <SlotCard key={a.id} angle={a.id} hint={a.hint} required={a.required} slot={slots[a.id]} disabled={model !== 'ready'}
            onCamera={() => setCamFor(a.id)} onFile={(f) => onFile(a.id, f)} onClear={() => setSlots((s) => ({ ...s, [a.id]: { state: 'empty' } }))} />
        ))}
      </div>

      <div className="card p-5">
        <label className="flex items-center justify-between gap-3">
          <div>
            <div className="font-medium">Hair & grooming self-check</div>
            <div className="text-xs text-slate-500">Not measurable reliably from photos — rate honestly, it only feeds your plan and the Grooming score.</div>
          </div>
          <input type="checkbox" className="h-5 w-5 accent-violet-500" checked={useGrooming} onChange={(e) => setUseGrooming(e.target.checked)} />
        </label>
        {useGrooming && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {GROOM_Q.map((q) => (
              <div key={q.key}>
                <div className="flex justify-between text-sm"><span>{q.label}</span><span className="tabular-nums text-accent-soft">{grooming[q.key]}/5</span></div>
                <input type="range" min={1} max={5} step={1} value={grooming[q.key]} className="w-full accent-violet-500"
                  onChange={(e) => setGrooming({ ...grooming, [q.key]: Number(e.target.value) as 1 })} />
                <div className="flex justify-between text-[11px] text-slate-500"><span>{q.low}</span><span>{q.high}</span></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sticky bottom-20 z-30 lg:bottom-4">
        <div className="card flex flex-col items-center justify-between gap-3 p-4 sm:flex-row">
          <div className="text-sm text-slate-400">
            {usable.length} usable photo{usable.length === 1 ? '' : 's'}
            {slots.front.state === 'done' && !slots.front.result.photo.quality.usable && ' · front photo failed quality checks'}
            {slots.front.state === 'done' && slots.front.result.photo.detectedPose !== 'front' && slots.front.result.photo.quality.usable && ' · front slot is not a frontal pose; frontal metrics will be missing'}
          </div>
          <button className="btn-primary w-full sm:w-auto" disabled={!usable.length || busy || saving} onClick={submit}>
            {saving ? 'Saving…' : 'Analyse & save'} <Icon name="arrow" className="h-4 w-4" />
          </button>
        </div>
      </div>

      {camFor && <Camera onClose={() => setCamFor(null)} onCapture={(c) => { const a = camFor; setCamFor(null); void process(a, c); }} />}
    </div>
  );
}

function SlotCard({ angle, hint, required, slot, disabled, onCamera, onFile, onClear }: {
  angle: IntendedAngle; hint: string; required?: boolean; slot: Slot; disabled: boolean;
  onCamera: () => void; onFile: (f: File | undefined) => void; onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const result = slot.state === 'done' ? slot.result : null;
  const url = usePhotoUrl(result?.photo.image);
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between p-4 pb-2">
        <div>
          <div className="font-medium">{INTENT_LABEL[angle]} {required ? <span className="text-xs text-accent-soft">required</span> : <span className="text-xs text-slate-500">optional</span>}</div>
          <div className="text-xs text-slate-500">{hint}</div>
        </div>
        {slot.state === 'done' && <button className="btn-ghost px-2 py-1.5" onClick={onClear} aria-label="Remove"><Icon name="x" className="h-4 w-4" /></button>}
      </div>

      {slot.state === 'empty' || slot.state === 'error' ? (
        <div className="p-4 pt-2">
          {slot.state === 'error' && <div className="mb-3 rounded-lg bg-red-500/10 p-2 text-xs text-red-300">{slot.message}</div>}
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" disabled={disabled} onClick={onCamera}><Icon name="camera" /> Camera</button>
            <button className="btn-ghost flex-1" disabled={disabled} onClick={() => inputRef.current?.click()}><Icon name="upload" /> Upload / take photo</button>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
        </div>
      ) : slot.state === 'busy' ? (
        <div className="p-8 text-center text-sm text-slate-400">Analysing on device…</div>
      ) : result && (
        <div className="grid grid-cols-[110px_1fr] gap-3 p-4 pt-2">
          {url && <img src={url} alt="" className="aspect-[3/4] w-full rounded-lg object-cover" />}
          <div className="min-w-0 space-y-1 text-xs">
            <div className={`chip ${result.photo.quality.usable ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
              {result.photo.quality.usable ? `Usable · quality ${(result.photo.quality.score * 100).toFixed(0)}%` : 'Not usable'}
            </div>
            {result.photo.detectedPose && <div className="text-slate-400">Detected: {POSE_LABEL[result.photo.detectedPose]}</div>}
            {result.photo.quality.checks.filter((c) => c.status !== 'pass').map((c) => (
              <div key={c.id} className={c.status === 'fail' ? 'text-red-300' : 'text-amber-300'}>• {c.detail}</div>
            ))}
            {result.photo.quality.checks.every((c) => c.status === 'pass') && <div className="text-slate-500">All quality checks passed.</div>}
            <div className="text-slate-500">{result.measurements.length} measurements</div>
          </div>
        </div>
      )}
    </div>
  );
}
