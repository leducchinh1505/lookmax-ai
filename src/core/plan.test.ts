import { describe, expect, it } from 'vitest';
import { generatePlan, hairstyleTask } from './recommendations';
import { adherence, categoryDelta, scoreSeries, streak, taskStatus, toggleCompletion } from './progress';
import { mergeAnalyses, validateBackup, BACKUP_FORMAT } from './backup';
import { scoreMeasurements } from './scoring';
import type { AnalysisRecord, Measurement, PlanState, PlanTask } from './types';

const m = (id: string, value: number): Measurement => ({ id, value, confidence: 0.8, photoId: 'p', pose: 'front' });

describe('RecommendationEngine', () => {
  const lowJaw = scoreMeasurements([m('jawRatio', 0.5), m('chinPhiltrum', 1.0), m('faceLengthRatio', 1.5), m('skinTexture', 3)]);
  const plan = generatePlan(lowJaw, { hairCondition: 2, haircutRecency: 2, facialHairKept: 2, eyebrowsGroomed: 2, skincareRoutine: 1 });

  it('every task has instructions, frequency, duration and rationale', () => {
    for (const t of plan) {
      expect(t.instructions.length).toBeGreaterThan(0);
      expect(t.frequency).toBeTruthy();
      expect(t.durationMin).toBeGreaterThanOrEqual(0);
      expect(t.rationale.length).toBeGreaterThan(10);
    }
    expect(new Set(plan.map((t) => t.id)).size).toBe(plan.length);
  });

  it('adds rule-based tasks for measured weaknesses and self-report', () => {
    const ids = plan.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['spf', 'jaw-contour', 'gentle-exfoliation', 'haircut', 'brows', 'facial-hair', 'hairstyle']));
  });

  it('never promises score gains or structural change', () => {
    const text = plan.flatMap((t) => [t.title, t.rationale, ...t.instructions]).join(' ');
    expect(text).not.toMatch(/guarantee|\+\s?\d+\s?points|increase your score|boost your score|reshape your (jaw|bone)/i);
    const jaw = plan.find((t) => t.id === 'jaw-contour')!;
    expect(jaw.caution).toMatch(/not|no exercise/i);
  });

  it('picks hairstyle advice by measured face shape', () => {
    expect(hairstyleTask(1.5, null).title).toMatch(/longer/);
    expect(hairstyleTask(1.1, 0.95).title).toMatch(/squarer/);
    expect(hairstyleTask(1.28, 0.85).title).toMatch(/balanced/);
  });
});

describe('ProgressTracking', () => {
  const task: PlanTask = { id: 't', area: 'skincare', title: 'x', instructions: ['a'], frequency: 'daily', durationMin: 1, rationale: 'r', linkedCategories: [], priority: 1 };
  const weekly: PlanTask = { ...task, id: 'w', frequency: 'weekly' };
  const plan: PlanState = { id: 'current', basedOnAnalysisId: null, createdAt: '', tasks: [task, weekly], completions: { t: ['2026-10-20', '2026-10-21', '2026-10-22'], w: ['2026-10-17'] }, archived: [] };

  it('computes due state per frequency', () => {
    expect(taskStatus(task, plan.completions.t, '2026-10-22').complete).toBe(true);
    expect(taskStatus(task, plan.completions.t, '2026-10-23').complete).toBe(false);
    expect(taskStatus(weekly, plan.completions.w, '2026-10-22').complete).toBe(true);
    expect(taskStatus(weekly, plan.completions.w, '2026-10-24').complete).toBe(false);
  });

  it('computes streak and adherence', () => {
    expect(streak(plan, '2026-10-22')).toBe(3);
    expect(streak(plan, '2026-10-23')).toBe(3); // nothing yet today, streak continues from yesterday
    expect(streak(plan, '2026-10-25')).toBe(0);
    const a = adherence(plan, '2026-10-22', 7)!;
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThanOrEqual(1);
  });

  it('toggles completion for today', () => {
    const on = toggleCompletion(plan, 't', '2026-10-23', task);
    expect(on.completions.t).toContain('2026-10-23');
    const off = toggleCompletion(on, 't', '2026-10-23', task);
    expect(off.completions.t).not.toContain('2026-10-23');
  });

  it('builds a chronological score series and deltas', () => {
    const rec = (id: string, date: string, overall: number): AnalysisRecord => ({ id, createdAt: date, photos: [], measurements: [], grooming: null, appVersion: '0', report: { overall, overallConfidence: 0.5, disclaimer: '', categories: [] } });
    const s = scoreSeries([rec('b', '2026-10-10', 70), rec('a', '2026-10-01', 65)]);
    expect(s.map((p) => p.id)).toEqual(['a', 'b']);
    expect(categoryDelta(s, 'overall')).toBe(5);
  });
});

describe('Backup', () => {
  const rec = { id: 'x', createdAt: '2026-10-01T00:00:00Z', photos: [{ image: 'data:image/jpeg;base64,AAA' }], report: {}, measurements: [] };
  it('validates format', () => {
    expect(validateBackup({ format: BACKUP_FORMAT, version: 1, analyses: [rec] }).ok).toBe(true);
    expect(validateBackup({ format: 'other' }).ok).toBe(false);
    expect(validateBackup({ format: BACKUP_FORMAT, version: 99, analyses: [] }).ok).toBe(false);
    expect(validateBackup({ format: BACKUP_FORMAT, version: 1, analyses: [{ ...rec, photos: [{ image: 'javascript:alert(1)' }] }] }).ok).toBe(false);
  });
  it('merges without overwriting existing records', () => {
    const a = { id: '1' } as AnalysisRecord, b = { id: '2' } as AnalysisRecord;
    const r = mergeAnalyses([a], [{ ...a, notes: 'changed' }, b]);
    expect(r.added).toBe(1);
    expect(r.skipped).toBe(1);
    expect(r.merged.find((x) => x.id === '1')!.notes).toBeUndefined();
  });
});
