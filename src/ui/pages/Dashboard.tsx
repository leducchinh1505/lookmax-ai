import { adherence, categoryDelta, isoDay, scoreSeries, streak, taskStatus } from '../../core/progress';
import { Bar, ConfidenceBadge, LineChart, ScoreRing, scoreColor } from '../components/Charts';
import { Icon } from '../components/Icon';
import { navigate } from '../router';
import { useStore, usePhotoUrl } from '../store';

export function Dashboard() {
  const { analyses, plan } = useStore();
  const latest = analyses[0];
  const series = scoreSeries(analyses);
  const today = isoDay(new Date());
  const tasks = plan?.tasks.filter((t) => !plan.archived.includes(t.id)) ?? [];
  const todayDone = tasks.filter((t) => taskStatus(t, plan?.completions[t.id], today).complete).length;
  const delta = categoryDelta(series, 'overall');
  const thumb = usePhotoUrl(latest?.photos[0]?.image);

  if (!latest) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 pt-6 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-accent to-accent-blue text-2xl font-bold">L</div>
        <h1 className="text-3xl font-semibold">Your private appearance lab</h1>
        <p className="text-slate-400">Measure facial proportions, track progress and follow a personalised self-care plan — entirely on this device.</p>
        <button className="btn-primary px-6 py-3" onClick={() => navigate('new')}><Icon name="camera" /> Start first analysis</button>
        <div className="grid gap-3 pt-6 text-left sm:grid-cols-3">
          {[['shield', 'Private', 'No uploads, no account, works offline.'], ['face', 'Transparent', 'Every score shows its raw measurement, reference and confidence.'], ['list', 'Actionable', 'Safe, realistic habits with frequency and time estimates.']].map(([i, t, d]) => (
            <div key={t} className="card p-4"><Icon name={i} className="h-5 w-5 text-accent-soft" /><div className="mt-2 font-medium">{t}</div><div className="text-sm text-slate-400">{d}</div></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Dashboard</h1>
          <p className="text-sm text-slate-400">Last analysis {new Date(latest.createdAt).toLocaleDateString()}</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('new')}><Icon name="camera" /> <span className="hidden sm:inline">New analysis</span></button>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <button className="card flex items-center gap-4 p-5 text-left transition hover:border-accent/30" onClick={() => navigate(`analysis/${latest.id}`)}>
          {thumb && <img src={thumb} alt="" className="h-24 w-20 rounded-xl object-cover" />}
          <div className="flex flex-1 flex-col items-center">
            <ScoreRing score={latest.report.overall} size={110} label="overall" />
            {delta !== null && <span className={`mt-1 text-xs ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} vs previous</span>}
          </div>
        </button>
        <div className="card p-5">
          <div className="label">Today's plan</div>
          <div className="mt-2 text-3xl font-semibold tabular-nums">{todayDone}<span className="text-lg text-slate-500">/{tasks.length}</span></div>
          <div className="mt-3"><Bar value={tasks.length ? (todayDone / tasks.length) * 100 : 0} color="#8b5cf6" /></div>
          <button className="btn-ghost mt-4 w-full" onClick={() => navigate('plan')}>Open plan</button>
        </div>
        <div className="card grid grid-cols-2 gap-4 p-5">
          <div><div className="label">Streak</div><div className="mt-2 flex items-center gap-1 text-3xl font-semibold"><Icon name="flame" className="h-6 w-6 text-orange-400" />{plan ? streak(plan, today) : 0}</div><div className="text-xs text-slate-500">days</div></div>
          <div><div className="label">14-day adherence</div><div className="mt-2 text-3xl font-semibold">{plan && adherence(plan, today) !== null ? `${Math.round(adherence(plan, today)! * 100)}%` : '—'}</div></div>
          <div className="col-span-2"><div className="label">Analyses</div><div className="text-lg">{analyses.length}</div></div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between"><div className="font-medium">Categories</div><ConfidenceBadge value={latest.report.overallConfidence} /></div>
          <div className="space-y-3">
            {latest.report.categories.map((c) => (
              <div key={c.id}>
                <div className="mb-1 flex justify-between text-sm"><span className="text-slate-300">{c.label}</span><span className="tabular-nums" style={{ color: scoreColor(c.score) }}>{c.score ?? 'n/a'}</span></div>
                <Bar value={c.score} />
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <div className="mb-3 font-medium">Overall trend</div>
          <LineChart series={[{ name: 'Overall', color: '#a78bfa', points: series.map((p) => ({ x: p.date, y: p.overall })) }]} />
          <button className="btn-ghost mt-3 w-full" onClick={() => navigate('progress')}>Progress details</button>
        </div>
      </div>
    </div>
  );
}
