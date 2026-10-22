import { useState } from 'react';
import { POSE_LABEL, INTENT_LABEL } from '../../core/landmarks';
import type { CategoryId, CategoryResult } from '../../core/types';

const SHORT: Record<CategoryId, string> = { harmony: 'Harmony', symmetry: 'Symmetry', eyes: 'Eyes', nose: 'Nose', jaw: 'Jaw', skin: 'Skin', grooming: 'Grooming' };
import { Bar, ConfidenceBadge, RadarChart, ScoreRing, scoreColor } from '../components/Charts';
import { Icon } from '../components/Icon';
import { LandmarkOverlay } from '../components/LandmarkOverlay';
import { navigate } from '../router';
import { useStore } from '../store';

export function AnalysisView({ id }: { id: string | null }) {
  const { analyses, settings, deleteAnalysis } = useStore();
  const a = id ? analyses.find((x) => x.id === id) : analyses[0];
  const [photoIdx, setPhotoIdx] = useState(0);
  const [points, setPoints] = useState(settings.showLandmarks);

  if (!a) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <Icon name="face" className="mx-auto h-10 w-10 text-slate-600" />
        <p className="mt-3 text-slate-400">No analysis yet.</p>
        <button className="btn-primary mt-4" onClick={() => navigate('new')}>Start an analysis</button>
      </div>
    );
  }
  const photo = a.photos[Math.min(photoIdx, a.photos.length - 1)];
  const r = a.report;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Facial Analysis</h1>
          <p className="text-sm text-slate-400">{new Date(a.createdAt).toLocaleString()} · {a.photos.length} photo(s)</p>
        </div>
        <div className="flex gap-2">
          {analyses.length > 1 && (
            <select className="input w-auto" value={a.id} onChange={(e) => navigate(`analysis/${e.target.value}`)}>
              {analyses.map((x) => <option key={x.id} value={x.id}>{new Date(x.createdAt).toLocaleDateString()} — {x.report.overall ?? 'n/a'}</option>)}
            </select>
          )}
          <button className="btn-danger" onClick={async () => { if (confirm('Delete this analysis permanently from this device?')) { await deleteAnalysis(a.id); navigate('analysis'); } }}>
            <Icon name="trash" className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="space-y-3">
          {photo && <LandmarkOverlay photo={photo} showPoints={points} />}
          <div className="flex flex-wrap items-center gap-2">
            {a.photos.map((p, i) => (
              <button key={p.id} onClick={() => setPhotoIdx(i)} className={`chip ${i === photoIdx ? 'bg-accent/25 text-white' : 'bg-white/5 text-slate-400'}`}>
                {p.detectedPose ? POSE_LABEL[p.detectedPose] : INTENT_LABEL[p.intended]}{!p.quality.usable && ' (unusable)'}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-2 text-xs text-slate-400">
              <input type="checkbox" className="accent-violet-500" checked={points} onChange={(e) => setPoints(e.target.checked)} /> Landmarks
            </label>
          </div>
          {photo && (
            <div className="card p-4 text-xs">
              <div className="label mb-2">Photo quality</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {photo.quality.checks.map((c) => (
                  <div key={c.id} className="flex items-center gap-1.5">
                    <span className={c.status === 'pass' ? 'text-emerald-400' : c.status === 'warn' ? 'text-amber-400' : 'text-red-400'}>●</span>
                    <span className="text-slate-300">{c.label}</span>
                  </div>
                ))}
              </div>
              {photo.headPose && <div className="mt-2 text-slate-500">Head pose: yaw {photo.headPose.yaw}°, pitch {photo.headPose.pitch}°, roll {photo.headPose.roll}°</div>}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card grid items-center gap-6 p-6 sm:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center gap-2">
              <ScoreRing score={r.overall} label="proportion score" />
              {r.overall !== null ? <ConfidenceBadge value={r.overallConfidence} /> : <span className="text-xs text-slate-500">Need ≥3 scored categories</span>}
            </div>
            <RadarChart items={r.categories.map((c) => ({ label: SHORT[c.id], value: c.score }))} />
          </div>
          <p className="flex gap-2 rounded-xl bg-white/[0.03] p-3 text-xs text-slate-400"><Icon name="info" className="h-4 w-4 shrink-0" />{r.disclaimer}</p>
          <div className="space-y-3">
            {r.categories.map((c) => <CategoryCard key={c.id} c={c} />)}
          </div>
          <button className="btn-primary w-full sm:w-auto" onClick={() => navigate('plan')}>View improvement plan <Icon name="arrow" className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}

function CategoryCard({ c }: { c: CategoryResult }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card overflow-hidden">
      <button className="flex w-full items-center gap-4 p-4 text-left" onClick={() => setOpen(!open)}>
        <div className="w-12 text-2xl font-semibold tabular-nums" style={{ color: scoreColor(c.score) }}>{c.score ?? '—'}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{c.label}</span>
            {c.status === 'scored' ? <ConfidenceBadge value={c.confidence} /> : <span className="chip bg-white/5 text-slate-400">Insufficient data</span>}
          </div>
          <div className="mt-2"><Bar value={c.score} /></div>
        </div>
        <Icon name="arrow" className={`h-4 w-4 text-slate-500 transition ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-white/5 p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr><th className="pb-2 font-normal">Measurement</th><th className="pb-2 font-normal">Value</th><th className="pb-2 font-normal">Score</th><th className="pb-2 font-normal">Interpretation</th></tr>
              </thead>
              <tbody>
                {c.metrics.map((m) => (
                  <tr key={m.id} className="border-t border-white/5 align-top">
                    <td className="py-2 pr-3">
                      <div>{m.label}</div>
                      <div className="text-[11px] text-slate-500">{m.reference}</div>
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 tabular-nums">{m.value === null ? '—' : `${m.value} ${m.unit}`}</td>
                    <td className="py-2 pr-3 tabular-nums" style={{ color: scoreColor(m.score) }}>{m.score ?? (m.value !== null ? 'info' : '—')}</td>
                    <td className="py-2 text-xs text-slate-400">{m.interpretation}{m.value !== null && <div className="text-slate-600">conf. {(m.confidence * 100).toFixed(0)}%</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 space-y-1 text-xs text-slate-500">
            <div className="label">Limitations</div>
            {c.limitations.map((l) => <div key={l}>• {l}</div>)}
            <div>• Data coverage: {(c.coverage * 100).toFixed(0)}% of this category's weighted metrics.</div>
          </div>
        </div>
      )}
    </div>
  );
}
