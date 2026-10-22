// ScoringEngine: deterministic conversion of measurements -> metric scores ->
// category scores. Measurements, converted scores and the aesthetic
// interpretation are kept as separate fields.
import { CATEGORY_META, CATEGORY_ORDER, METRICS, type MetricDef } from './metrics';
import type { CategoryResult, GroomingSelfReport, Measurement, MetricResult, ScoreReport } from './types';

export const MIN_COVERAGE = 0.5; // share of a category's metric weight needed to score it
export const MIN_METRIC_CONFIDENCE = 0.12; // below this a measurement is ignored
export const MIN_CATEGORIES_FOR_OVERALL = 3;

export const DISCLAIMER =
  'Scores describe how measured 2D proportions compare with commonly cited reference ranges. ' +
  'They cannot determine bone structure or how attractive a person is, and are not medical advice.';

/** 100 inside the target range; falls linearly to 40 at one tolerance outside, 0 at ~1.67 tolerances. */
export function rangeScore(value: number, target: [number, number], tolerance: number): number {
  const [lo, hi] = target;
  const d = value < lo ? lo - value : value > hi ? value - hi : 0;
  return Math.round(Math.max(0, Math.min(100, 100 - (60 * d) / tolerance)));
}

export function interpret(def: MetricDef, value: number): string {
  const [lo, hi] = def.target;
  if (value >= lo && value <= hi) return 'Within the reference range';
  const d = value < lo ? lo - value : value - hi;
  const amount = d < def.tolerance * 0.5 ? 'Slightly' : d < def.tolerance ? 'Moderately' : 'Well';
  const dir = value < lo ? 'below' : 'above';
  const word = value < lo ? def.lowWord : def.highWord;
  return `${amount} ${dir} the reference range${word ? ` (${word})` : ''}`;
}

/** Combine repeated measurements of one metric (e.g. two side photos). */
export function aggregate(ms: Measurement[]): { value: number; confidence: number; sources: string[] } | null {
  const usable = ms.filter((m) => m.confidence >= MIN_METRIC_CONFIDENCE && Number.isFinite(m.value));
  if (!usable.length) return null;
  const wsum = usable.reduce((s, m) => s + m.confidence, 0);
  const value = usable.reduce((s, m) => s + m.value * m.confidence, 0) / wsum;
  const best = Math.max(...usable.map((m) => m.confidence));
  // Agreement between photos adds a little confidence (capped).
  const confidence = Math.min(1, best * (1 + 0.1 * (usable.length - 1)));
  return { value, confidence, sources: [...new Set(usable.map((m) => m.photoId))] };
}

export function groomingMeasurements(g: GroomingSelfReport): Measurement[] {
  const map: [string, number][] = [
    ['groomHair', g.hairCondition], ['groomCut', g.haircutRecency], ['groomFacialHair', g.facialHairKept],
    ['groomBrows', g.eyebrowsGroomed], ['groomSkincare', g.skincareRoutine],
  ];
  return map.map(([id, value]) => ({ id, value, pose: 'front', photoId: 'self-report', confidence: 0.5 }));
}

export function scoreMeasurements(measurements: Measurement[]): ScoreReport {
  const byId = new Map<string, Measurement[]>();
  for (const m of measurements) byId.set(m.id, [...(byId.get(m.id) ?? []), m]);

  const categories: CategoryResult[] = CATEGORY_ORDER.map((cat) => {
    const defs = METRICS.filter((d) => d.category === cat);
    const metrics: MetricResult[] = defs.map((def) => {
      const agg = aggregate(byId.get(def.id) ?? []);
      const round = (v: number) => Math.round(v * 10 ** def.decimals) / 10 ** def.decimals;
      return {
        id: def.id, label: def.label, category: def.category, unit: def.unit,
        value: agg ? round(agg.value) : null,
        score: agg && def.weight > 0 ? rangeScore(agg.value, def.target, def.tolerance) : null,
        confidence: agg ? Math.round(agg.confidence * 100) / 100 : 0,
        reference: def.reference,
        interpretation: agg ? interpret(def, agg.value) : 'Not measured — needs a suitable photo',
        sources: agg?.sources ?? [],
      };
    });
    const scored = defs.filter((d) => d.weight > 0);
    const totalW = scored.reduce((s, d) => s + d.weight, 0);
    let w = 0, ws = 0, wc = 0;
    for (const d of scored) {
      const r = metrics.find((m) => m.id === d.id)!;
      if (r.score === null) continue;
      w += d.weight; ws += d.weight * r.score; wc += d.weight * r.confidence;
    }
    const coverage = totalW ? w / totalW : 0;
    const ok = coverage >= MIN_COVERAGE && w > 0;
    return {
      id: cat,
      label: CATEGORY_META[cat].label,
      score: ok ? Math.round(ws / w) : null,
      confidence: ok ? Math.round((wc / w) * coverage * 100) / 100 : 0,
      coverage: Math.round(coverage * 100) / 100,
      metrics,
      limitations: CATEGORY_META[cat].limitations,
      status: ok ? 'scored' : 'insufficient',
    };
  });

  const scoredCats = categories.filter((c) => c.score !== null);
  let overall: number | null = null, overallConfidence = 0;
  if (scoredCats.length >= MIN_CATEGORIES_FOR_OVERALL) {
    const tw = scoredCats.reduce((s, c) => s + CATEGORY_META[c.id].weight, 0);
    overall = Math.round(scoredCats.reduce((s, c) => s + c.score! * CATEGORY_META[c.id].weight, 0) / tw);
    const meanConf = scoredCats.reduce((s, c) => s + c.confidence, 0) / scoredCats.length;
    overallConfidence = Math.round(meanConf * (scoredCats.length / categories.length) * 100) / 100;
  }
  return { overall, overallConfidence, categories, disclaimer: DISCLAIMER };
}

export function confidenceLabel(c: number): 'High' | 'Medium' | 'Low' | 'Very low' {
  return c >= 0.6 ? 'High' : c >= 0.4 ? 'Medium' : c >= 0.2 ? 'Low' : 'Very low';
}
