import { useState } from 'react';
import { isoDay, taskStatus, toggleCompletion } from '../../core/progress';
import { AREA_LABEL, FREQUENCY_LABEL } from '../../core/recommendations';
import type { PlanTask, TaskArea } from '../../core/types';
import { Icon } from '../components/Icon';
import { navigate } from '../router';
import { useStore } from '../store';

export function PlanPage() {
  const { plan, savePlan } = useStore();
  const [showArchived, setShowArchived] = useState(false);
  const today = isoDay(new Date());

  if (!plan) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <p className="text-slate-400">Your plan is generated from your first analysis.</p>
        <button className="btn-primary mt-4" onClick={() => navigate('new')}>Start an analysis</button>
      </div>
    );
  }
  const visible = plan.tasks.filter((t) => showArchived || !plan.archived.includes(t.id));
  const areas = [...new Set(visible.map((t) => t.area))] as TaskArea[];
  const totalMin = plan.tasks.filter((t) => !plan.archived.includes(t.id) && ['daily', 'twice-daily'].includes(t.frequency))
    .reduce((s, t) => s + t.durationMin * (t.frequency === 'twice-daily' ? 2 : 1), 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Improvement Plan</h1>
        <p className="text-sm text-slate-400">Generated {new Date(plan.createdAt).toLocaleDateString()} from your latest analysis · ~{totalMin} min/day of daily tasks</p>
      </header>
      <div className="flex gap-2 rounded-xl bg-white/[0.03] p-3 text-xs text-slate-400">
        <Icon name="info" className="h-4 w-4 shrink-0" />
        These are general, low-risk habits — not medical advice, and no specific score change is promised. Measured bone proportions are not changed by habits or facial exercises.
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-400">
        <input type="checkbox" className="accent-violet-500" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show hidden tasks
      </label>

      {areas.map((area) => (
        <section key={area} className="space-y-3">
          <h2 className="label">{AREA_LABEL[area]}</h2>
          {visible.filter((t) => t.area === area).map((t) => (
            <TaskCard key={t.id} task={t} archived={plan.archived.includes(t.id)} status={taskStatus(t, plan.completions[t.id], today)}
              onToggle={() => savePlan(toggleCompletion(plan, t.id, today, t))}
              onArchive={() => savePlan({ ...plan, archived: plan.archived.includes(t.id) ? plan.archived.filter((x) => x !== t.id) : [...plan.archived, t.id] })} />
          ))}
        </section>
      ))}
    </div>
  );
}

function TaskCard({ task, status, archived, onToggle, onArchive }: {
  task: PlanTask; status: { done: number; times: number; complete: boolean }; archived: boolean; onToggle: () => void; onArchive: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`card p-4 transition ${archived ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3">
        <button onClick={onToggle} aria-label="Mark done"
          className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border transition ${status.complete ? 'border-transparent bg-gradient-to-br from-accent to-accent-blue' : 'border-white/15 hover:border-accent'}`}>
          {status.complete && <Icon name="check" className="h-4 w-4" />}
        </button>
        <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(!open)}>
          <div className={`font-medium ${status.complete ? 'text-slate-400 line-through decoration-slate-600' : ''}`}>{task.title}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="chip bg-white/5">{FREQUENCY_LABEL[task.frequency]}</span>
            {task.durationMin > 0 && <span className="chip bg-white/5"><Icon name="clock" className="h-3 w-3" />{task.durationMin} min</span>}
            {status.times > 1 || task.frequency !== 'daily' ? <span className="chip bg-white/5">{status.done}/{status.times} this period</span> : null}
            {task.priority === 1 && <span className="chip bg-accent/15 text-accent-soft">Priority</span>}
          </div>
        </button>
        <button className="text-xs text-slate-500 hover:text-slate-300" onClick={onArchive}>{archived ? 'Restore' : 'Hide'}</button>
      </div>
      {open && (
        <div className="mt-3 space-y-2 border-t border-white/5 pt-3 text-sm">
          <ol className="list-decimal space-y-1 pl-5 text-slate-300">{task.instructions.map((s) => <li key={s}>{s}</li>)}</ol>
          <p className="text-xs text-slate-400"><span className="text-slate-500">Why: </span>{task.rationale}</p>
          {task.caution && <p className="rounded-lg bg-amber-500/10 p-2 text-xs text-amber-200">{task.caution}</p>}
        </div>
      )}
    </div>
  );
}
