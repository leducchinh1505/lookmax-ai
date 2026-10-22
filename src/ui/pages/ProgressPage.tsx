import { useState } from 'react';
import { CATEGORY_META, CATEGORY_ORDER } from '../../core/metrics';
import { categoryDelta, isoDay, scoreSeries } from '../../core/progress';
import type { AnalysisRecord, CategoryId } from '../../core/types';
import { LineChart, scoreColor } from '../components/Charts';
import { useStore, usePhotoUrl } from '../store';

const COLORS = ['#a78bfa', '#60a5fa', '#22d3ee', '#f0abfc', '#34d399', '#fbbf24', '#f87171'];

export function ProgressPage() {
  const { analyses, plan } = useStore();
  const series = scoreSeries(analyses);
  const [sel, setSel] = useState<CategoryId[]>(['harmony', 'symmetry', 'skin']);
  const [a, setA] = useState<string>(analyses[analyses.length - 1]?.id ?? '');
  const [b, setB] = useState<string>(analyses[0]?.id ?? '');

  // Completion heatmap: last 12 weeks
  const counts = new Map<string, number>();
  for (const ds of Object.values(plan?.completions ?? {})) for (const d of ds) counts.set(d, (counts.get(d) ?? 0) + 1);
  const days: string[] = [];
  for (let i = 83; i >= 0; i--) days.push(isoDay(new Date(Date.now() - i * 86_400_000)));
  const max = Math.max(1, ...counts.values());

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Progress Tracking</h1>
        <p className="text-sm text-slate-400">Compare like with like: same lighting, distance and angle. Differences of a few points are within normal measurement noise.</p>
      </header>

      <div className="card p-5">
        <div className="mb-3 flex flex-wrap gap-2">
          {CATEGORY_ORDER.map((c, i) => (
            <button key={c} onClick={() => setSel(sel.includes(c) ? sel.filter((x) => x !== c) : [...sel, c])}
              className="chip border" style={{ borderColor: sel.includes(c) ? COLORS[i] : 'transparent', color: sel.includes(c) ? COLORS[i] : '#64748b', background: 'rgba(255,255,255,0.03)' }}>
              {CATEGORY_META[c].label}
              {categoryDelta(series, c) !== null && <span className="tabular-nums">({categoryDelta(series, c)! >= 0 ? '+' : ''}{categoryDelta(series, c)})</span>}
            </button>
          ))}
        </div>
        <LineChart height={220} series={[
          { name: 'Overall', color: '#ffffff', points: series.map((p) => ({ x: p.date, y: p.overall })) },
          ...sel.map((c) => ({ name: c, color: COLORS[CATEGORY_ORDER.indexOf(c)], points: series.map((p) => ({ x: p.date, y: p.categories[c] ?? null })) })),
        ]} />
      </div>

      <div className="card p-5">
        <div className="mb-3 font-medium">Plan activity (12 weeks)</div>
        <div className="grid w-max max-w-full grid-flow-col grid-rows-7 gap-1 overflow-x-auto">
          {days.map((d) => {
            const n = counts.get(d) ?? 0;
            return <div key={d} title={`${d}: ${n} task(s)`} className="h-3.5 w-3.5 rounded-sm" style={{ background: n ? `rgba(139,92,246,${0.25 + 0.75 * (n / max)})` : 'rgba(255,255,255,0.05)' }} />;
          })}
        </div>
      </div>

      {analyses.length >= 2 && (
        <div className="card p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="font-medium">Compare</span>
            <Pick value={a} onChange={setA} list={analyses} /> <span className="text-slate-500">→</span> <Pick value={b} onChange={setB} list={analyses} />
          </div>
          <Compare a={analyses.find((x) => x.id === a)} b={analyses.find((x) => x.id === b)} />
        </div>
      )}
    </div>
  );
}

function Pick({ value, onChange, list }: { value: string; onChange: (v: string) => void; list: AnalysisRecord[] }) {
  return (
    <select className="input w-auto" value={value} onChange={(e) => onChange(e.target.value)}>
      {list.map((x) => <option key={x.id} value={x.id}>{new Date(x.createdAt).toLocaleDateString()}</option>)}
    </select>
  );
}

function Compare({ a, b }: { a?: AnalysisRecord; b?: AnalysisRecord }) {
  const ua = usePhotoUrl(a?.photos[0]?.image), ub = usePhotoUrl(b?.photos[0]?.image);
  if (!a || !b) return null;
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1fr_1.4fr]">
      {[ua, ub].map((u, i) => u ? <img key={i} src={u} alt="" className="aspect-[3/4] w-full rounded-xl object-cover" /> : <div key={i} className="grid aspect-[3/4] place-items-center rounded-xl bg-white/5 text-xs text-slate-500">No photo</div>)}
      <table className="w-full self-start text-sm">
        <tbody>
          {a.report.categories.map((ca) => {
            const cb = b.report.categories.find((x) => x.id === ca.id)!;
            const d = ca.score !== null && cb?.score != null ? cb.score - ca.score : null;
            return (
              <tr key={ca.id} className="border-b border-white/5">
                <td className="py-2 text-slate-300">{ca.label}</td>
                <td className="py-2 text-right tabular-nums" style={{ color: scoreColor(ca.score) }}>{ca.score ?? '—'}</td>
                <td className="py-2 text-right tabular-nums" style={{ color: scoreColor(cb?.score ?? null) }}>{cb?.score ?? '—'}</td>
                <td className={`py-2 text-right tabular-nums ${d === null ? 'text-slate-600' : d >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{d === null ? '' : `${d >= 0 ? '+' : ''}${d}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
