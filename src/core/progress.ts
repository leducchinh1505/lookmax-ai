// ProgressTracking: score history, deltas, task due-state, adherence & streaks.
import type { AnalysisRecord, CategoryId, PlanState, PlanTask } from './types';

export interface SeriesPoint { id: string; date: string; overall: number | null; categories: Partial<Record<CategoryId, number | null>> }

export function scoreSeries(analyses: AnalysisRecord[]): SeriesPoint[] {
  return [...analyses]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((a) => ({
      id: a.id,
      date: a.createdAt,
      overall: a.report.overall,
      categories: Object.fromEntries(a.report.categories.map((c) => [c.id, c.score])),
    }));
}

export function categoryDelta(series: SeriesPoint[], cat: CategoryId | 'overall'): number | null {
  const vals = series.map((p) => (cat === 'overall' ? p.overall : p.categories[cat] ?? null)).filter((v): v is number => v !== null);
  if (vals.length < 2) return null;
  return vals[vals.length - 1] - vals[vals.length - 2];
}

export function isoDay(d: Date): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00') - Date.parse(a + 'T00:00:00')) / 86_400_000);
}

function countWithin(dates: string[], today: string, days: number) {
  return dates.filter((d) => { const diff = daysBetween(d, today); return diff >= 0 && diff < days; }).length;
}

/** How many completions are expected in the window, and how many happened. */
export function taskTarget(task: PlanTask): { window: number; times: number } {
  switch (task.frequency) {
    case 'daily': return { window: 1, times: 1 };
    case 'twice-daily': return { window: 1, times: 2 };
    case '3x-week': return { window: 7, times: 3 };
    case 'weekly': return { window: 7, times: 1 };
    case 'monthly': return { window: 30, times: 1 };
    case 'once': return { window: 100_000, times: 1 };
  }
}

export function taskStatus(task: PlanTask, completions: string[] | undefined, today: string) {
  const { window, times } = taskTarget(task);
  const done = countWithin(completions ?? [], today, window);
  return { done, times, complete: done >= times };
}

/** Share of expected completions achieved over the last `days` days (0..1). */
export function adherence(plan: PlanState, today: string, days = 14): number | null {
  const tasks = plan.tasks.filter((t) => t.frequency !== 'once' && !plan.archived.includes(t.id));
  if (!tasks.length) return null;
  let expected = 0, got = 0;
  for (const t of tasks) {
    const { window, times } = taskTarget(t);
    const exp = (days / window) * times;
    expected += exp;
    got += Math.min(exp, countWithin(plan.completions[t.id] ?? [], today, days));
  }
  return expected ? got / expected : null;
}

/** Consecutive days (ending today, or yesterday if nothing yet today) with ≥1 completion. */
export function streak(plan: PlanState, today: string): number {
  const days = new Set(Object.values(plan.completions).flat());
  let d = new Date(today + 'T00:00:00');
  if (!days.has(today)) d = new Date(d.getTime() - 86_400_000);
  let n = 0;
  while (days.has(isoDay(d))) { n++; d = new Date(d.getTime() - 86_400_000); }
  return n;
}

export function toggleCompletion(plan: PlanState, taskId: string, day: string, task: PlanTask): PlanState {
  const list = [...(plan.completions[taskId] ?? [])];
  const { times } = taskTarget(task);
  const todays = list.filter((d) => d === day).length;
  if (todays >= (task.frequency === 'twice-daily' ? times : 1)) {
    // Already at the per-day max: undo all of today's entries.
    return { ...plan, completions: { ...plan.completions, [taskId]: list.filter((d) => d !== day) } };
  }
  return { ...plan, completions: { ...plan.completions, [taskId]: [...list, day] } };
}
