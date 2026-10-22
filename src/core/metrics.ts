// The single source of truth for every metric: what it measures, which photo
// angles it can be taken from, how reliable it is, and the reference range used
// to convert it to a 0..100 score.
//
// IMPORTANT: Reference ranges are heuristics drawn from commonly cited
// proportion guides (neoclassical canons, rule of fifths/thirds, published
// anthropometric averages). They vary by ethnicity, sex, and age, and fitting
// them is NOT the same as being attractive. Weights of 0 mark a metric as
// informational only (shown, never scored).
import type { CategoryId, Pose } from './types';

export interface MetricDef {
  id: string;
  label: string;
  category: CategoryId;
  unit: string;
  poses: Pose[];
  /** Base reliability 0..1 of measuring this from a single 2D photo. */
  reliability: number;
  weight: number;
  target: [number, number];
  /** Distance outside the target range at which the score falls to 40. */
  tolerance: number;
  reference: string;
  lowWord: string;
  highWord: string;
  /** Lower-face metrics are distorted by an open mouth; eye metrics by closed eyes. */
  sensitiveTo?: 'mouth' | 'eyes';
  decimals: number;
}

const FRONT: Pose[] = ['front'];
const SIDES: Pose[] = ['profileLeft', 'profileRight', 'threeQuarterLeft', 'threeQuarterRight', 'front'];

export const METRICS: MetricDef[] = [
  // ── Facial harmony ────────────────────────────────────────────────
  { id: 'thirdsRatio', label: 'Lower ÷ middle third', category: 'harmony', unit: '×', poses: FRONT, reliability: 0.8, weight: 2,
    target: [0.95, 1.15], tolerance: 0.25, reference: 'Neoclassical canon: middle (brow→nose base) and lower (nose base→chin) thirds roughly equal.',
    lowWord: 'shorter lower face', highWord: 'longer lower face', sensitiveTo: 'mouth', decimals: 2 },
  { id: 'fwhr', label: 'Width-to-height ratio (fWHR)', category: 'harmony', unit: '×', poses: FRONT, reliability: 0.7, weight: 1,
    target: [1.75, 2.05], tolerance: 0.35, reference: 'Cheekbone width ÷ brow-to-upper-lip height. Typical adult range ≈1.75–2.05.',
    lowWord: 'narrower/taller midface', highWord: 'wider/shorter midface', decimals: 2 },
  { id: 'mouthNoseRatio', label: 'Mouth ÷ nose width', category: 'harmony', unit: '×', poses: FRONT, reliability: 0.75, weight: 1.5,
    target: [1.45, 1.65], tolerance: 0.35, reference: 'Mouth width is commonly ≈1.5–1.6× the nose (alar) width.',
    lowWord: 'narrower mouth', highWord: 'wider mouth', decimals: 2 },
  { id: 'lipRatio', label: 'Lower ÷ upper lip height', category: 'harmony', unit: '×', poses: FRONT, reliability: 0.6, weight: 1,
    target: [1.3, 2.0], tolerance: 0.7, reference: 'Lower lip is typically fuller, around 1.3–2× the upper lip height.',
    lowWord: 'fuller upper lip', highWord: 'thinner upper lip', sensitiveTo: 'mouth', decimals: 2 },
  { id: 'faceLengthRatio', label: 'Face length ÷ width', category: 'harmony', unit: '×', poses: FRONT, reliability: 0.6, weight: 0,
    target: [1.18, 1.38], tolerance: 0.2, reference: 'Informational (face shape). Upper forehead point is used, not the hairline.',
    lowWord: 'rounder/wider shape', highWord: 'longer shape', decimals: 2 },

  // ── Symmetry ──────────────────────────────────────────────────────
  { id: 'symmetryIndex', label: 'Landmark asymmetry', category: 'symmetry', unit: '% of face width', poses: FRONT, reliability: 0.7, weight: 2,
    target: [0, 2.0], tolerance: 4, reference: 'Mean mismatch of 30 mirrored landmark pairs. No face is perfectly symmetric; 1–3% is common.',
    lowWord: 'more symmetric', highWord: 'less symmetric', decimals: 2 },
  { id: 'eyeLevelDiff', label: 'Eye height difference', category: 'symmetry', unit: '% of face height', poses: FRONT, reliability: 0.7, weight: 1,
    target: [0, 1.0], tolerance: 2.5, reference: 'Vertical offset between eye centres relative to the facial midline.',
    lowWord: 'level', highWord: 'uneven', decimals: 2 },
  { id: 'mouthLevelDiff', label: 'Mouth corner difference', category: 'symmetry', unit: '% of face height', poses: FRONT, reliability: 0.6, weight: 1,
    target: [0, 1.0], tolerance: 2.5, reference: 'Vertical offset between mouth corners. Expression strongly affects this.',
    lowWord: 'level', highWord: 'uneven', sensitiveTo: 'mouth', decimals: 2 },

  // ── Eye area ──────────────────────────────────────────────────────
  { id: 'canthalTilt', label: 'Canthal tilt', category: 'eyes', unit: '°', poses: FRONT, reliability: 0.65, weight: 1.5,
    target: [1, 8], tolerance: 6, reference: 'Angle of inner→outer eye corner vs. horizontal. A slight positive tilt is often preferred.',
    lowWord: 'neutral/negative tilt', highWord: 'strong positive tilt', sensitiveTo: 'eyes', decimals: 1 },
  { id: 'intercanthalRatio', label: 'Eye spacing ÷ eye width', category: 'eyes', unit: '×', poses: FRONT, reliability: 0.75, weight: 1.5,
    target: [0.9, 1.1], tolerance: 0.3, reference: 'Rule of fifths: the gap between the eyes ≈ one eye width.',
    lowWord: 'closer-set', highWord: 'wider-set', sensitiveTo: 'eyes', decimals: 2 },
  { id: 'eyeWidthRatio', label: 'Eye width ÷ face width', category: 'eyes', unit: '×', poses: FRONT, reliability: 0.65, weight: 1,
    target: [0.18, 0.23], tolerance: 0.04, reference: 'Rule of fifths: each eye ≈ one fifth of face width.',
    lowWord: 'smaller eyes relative to face', highWord: 'larger eyes relative to face', sensitiveTo: 'eyes', decimals: 3 },
  { id: 'eyeAspect', label: 'Eye openness (height ÷ width)', category: 'eyes', unit: '×', poses: FRONT, reliability: 0.6, weight: 0,
    target: [0.22, 0.38], tolerance: 0.1, reference: 'Informational — changes with expression and lighting.',
    lowWord: 'narrower aperture', highWord: 'rounder aperture', decimals: 2 },

  // ── Nose ──────────────────────────────────────────────────────────
  { id: 'alarIntercanthal', label: 'Nose width ÷ eye spacing', category: 'nose', unit: '×', poses: FRONT, reliability: 0.75, weight: 2,
    target: [0.9, 1.1], tolerance: 0.3, reference: 'Nose (alar) width commonly ≈ the distance between inner eye corners.',
    lowWord: 'narrower nose', highWord: 'wider nose', decimals: 2 },
  { id: 'noseLengthRatio', label: 'Nose length ÷ face height', category: 'nose', unit: '×', poses: FRONT, reliability: 0.65, weight: 1,
    target: [0.4, 0.46], tolerance: 0.07, reference: 'Nasion→nose base as a fraction of nasion→chin.',
    lowWord: 'shorter nose', highWord: 'longer nose', sensitiveTo: 'mouth', decimals: 3 },

  // ── Jawline & chin ────────────────────────────────────────────────
  { id: 'jawRatio', label: 'Jaw width ÷ cheekbone width', category: 'jaw', unit: '×', poses: FRONT, reliability: 0.55, weight: 1.5,
    target: [0.78, 0.92], tolerance: 0.15, reference: 'Lower-jaw width relative to cheekbones. Soft tissue and beard affect this.',
    lowWord: 'tapered jaw', highWord: 'squarer/wider jaw', decimals: 2 },
  { id: 'chinPhiltrum', label: 'Chin ÷ philtrum height', category: 'jaw', unit: '×', poses: FRONT, reliability: 0.6, weight: 1.5,
    target: [1.9, 2.4], tolerance: 0.8, reference: 'Chin height (lower lip→chin) is often ≈2–2.25× the philtrum.',
    lowWord: 'shorter chin', highWord: 'longer chin', sensitiveTo: 'mouth', decimals: 2 },
  { id: 'gonialAngle', label: 'Jaw angle (estimated)', category: 'jaw', unit: '°', poses: SIDES, reliability: 0.45, weight: 1,
    target: [115, 130], tolerance: 12, reference: 'Estimated from the 3D face mesh; side/3-4 photos are more reliable than front. Not a cephalometric measurement.',
    lowWord: 'sharper angle', highWord: 'more obtuse angle', decimals: 0 },

  // ── Skin appearance (photo-dependent) ─────────────────────────────
  { id: 'skinEvenness', label: 'Tone unevenness', category: 'skin', unit: 'ΔL*', poses: FRONT, reliability: 0.4, weight: 1.5,
    target: [0, 2.5], tolerance: 4, reference: 'Mid-scale lightness variation on cheeks/forehead/chin. Lighting and makeup dominate this.',
    lowWord: 'even', highWord: 'uneven', decimals: 2 },
  { id: 'skinTexture', label: 'Fine texture', category: 'skin', unit: 'ΔL*', poses: FRONT, reliability: 0.35, weight: 1,
    target: [0, 1.6], tolerance: 2.5, reference: 'Fine-scale detail (pores, bumps — and camera noise/sharpening).',
    lowWord: 'smooth', highWord: 'textured', decimals: 2 },
  { id: 'rednessVariation', label: 'Redness variation', category: 'skin', unit: 'Δa*', poses: FRONT, reliability: 0.35, weight: 1,
    target: [0, 2.5], tolerance: 4, reference: 'Variation of red–green colour on skin patches. Not a diagnosis of any condition.',
    lowWord: 'uniform colour', highWord: 'blotchy colour', decimals: 2 },

  // ── Hair & grooming (self-reported, not computer vision) ──────────
  { id: 'groomHair', label: 'Hair condition', category: 'grooming', unit: '/5', poses: [], reliability: 0.5, weight: 1,
    target: [4, 5], tolerance: 2.5, reference: 'Self-reported.', lowWord: 'needs care', highWord: '', decimals: 0 },
  { id: 'groomCut', label: 'Haircut recency', category: 'grooming', unit: '/5', poses: [], reliability: 0.5, weight: 1,
    target: [4, 5], tolerance: 2.5, reference: 'Self-reported.', lowWord: 'overdue', highWord: '', decimals: 0 },
  { id: 'groomFacialHair', label: 'Facial hair kept', category: 'grooming', unit: '/5', poses: [], reliability: 0.5, weight: 1,
    target: [4, 5], tolerance: 2.5, reference: 'Self-reported (clean-shaven also counts as kept).', lowWord: 'untidy', highWord: '', decimals: 0 },
  { id: 'groomBrows', label: 'Eyebrows groomed', category: 'grooming', unit: '/5', poses: [], reliability: 0.5, weight: 1,
    target: [4, 5], tolerance: 2.5, reference: 'Self-reported.', lowWord: 'unshaped', highWord: '', decimals: 0 },
  { id: 'groomSkincare', label: 'Skincare routine', category: 'grooming', unit: '/5', poses: [], reliability: 0.5, weight: 1,
    target: [4, 5], tolerance: 2.5, reference: 'Self-reported.', lowWord: 'inconsistent', highWord: '', decimals: 0 },
];

export const METRIC_BY_ID: Record<string, MetricDef> = Object.fromEntries(METRICS.map((m) => [m.id, m]));

export const CATEGORY_META: Record<CategoryId, { label: string; weight: number; limitations: string[] }> = {
  harmony: { label: 'Facial Harmony', weight: 1, limitations: [
    'Proportions are measured on a 2D photo; lens distance (selfie distortion) changes them.',
    'Reference ranges are population heuristics, not personal ideals.'] },
  symmetry: { label: 'Facial Symmetry', weight: 1, limitations: [
    'Only front photos are used. Slight head turns or expressions add apparent asymmetry.'] },
  eyes: { label: 'Eye Area', weight: 1, limitations: [
    'Eyelid shape, under-eye area and brows are not measured. Squinting or glasses reduce accuracy.'] },
  nose: { label: 'Nose', weight: 1, limitations: [
    'Front-view widths and lengths only; nasal profile/projection is not reliably measurable here.'] },
  jaw: { label: 'Jawline & Chin', weight: 1, limitations: [
    'Soft tissue, body fat and beards change visible jaw contours; bone structure cannot be determined from photos.',
    'Jaw angle comes from a fitted 3D mesh and is an estimate.'] },
  skin: { label: 'Skin Appearance', weight: 0.75, limitations: [
    'Describes how skin appears in THIS photo; lighting, camera processing and makeup dominate.',
    'This is not a dermatological assessment and cannot detect or diagnose any skin condition.'] },
  grooming: { label: 'Hair & Grooming', weight: 0.75, limitations: [
    'Based on your self-report, not computer vision.'] },
};

export const CATEGORY_ORDER: CategoryId[] = ['harmony', 'symmetry', 'eyes', 'nose', 'jaw', 'skin', 'grooming'];
