// RecommendationEngine: rule-based, deterministic plan generation. Rules only
// recommend low-risk habits; nothing promises a score increase, and nothing
// claims to change adult bone structure.
import type { CategoryId, GroomingSelfReport, PlanTask, ScoreReport } from './types';

type Rule = { when: (ctx: Ctx) => boolean; task: PlanTask | ((ctx: Ctx) => PlanTask) };
interface Ctx {
  report: ScoreReport;
  grooming: GroomingSelfReport | null;
  cat: (id: CategoryId) => number | null;
  metric: (id: string) => number | null;
}

const BASE: PlanTask[] = [
  { id: 'spf', area: 'skincare', title: 'Apply sunscreen (SPF 30+)', frequency: 'daily', durationMin: 2, priority: 1,
    instructions: ['Apply a broad-spectrum SPF 30+ as the last morning skincare step.', 'Use about two finger-lengths for face and neck.', 'Reapply every 2 hours when outdoors.'],
    rationale: 'UV exposure is the main avoidable driver of uneven tone and visible skin ageing.', linkedCategories: ['skin'] },
  { id: 'cleanse-moisturize', area: 'skincare', title: 'Gentle cleanse + moisturise', frequency: 'twice-daily', durationMin: 3, priority: 2,
    instructions: ['Wash with lukewarm water and a gentle, fragrance-free cleanser.', 'Pat dry, then apply a moisturiser suited to your skin type.', 'Patch-test any new product on a small area for a few days first.'],
    rationale: 'A simple, consistent routine supports the skin barrier.', linkedCategories: ['skin'] },
  { id: 'sleep', area: 'lifestyle', title: 'Sleep 7–9 hours on a regular schedule', frequency: 'daily', durationMin: 0, priority: 2,
    instructions: ['Keep bed and wake times within ~30 minutes, including weekends.', 'Avoid screens and caffeine late in the day.'],
    rationale: 'Sleep affects under-eye appearance, skin and overall wellbeing.', linkedCategories: ['eyes', 'skin'] },
  { id: 'hydration-diet', area: 'lifestyle', title: 'Water and balanced meals', frequency: 'daily', durationMin: 0, priority: 3,
    instructions: ['Drink water regularly through the day.', 'Favour vegetables, fruit, protein and whole grains; limit ultra-processed food and alcohol.'],
    rationale: 'General health habits that support skin and body composition.', linkedCategories: ['skin'] },
  { id: 'activity', area: 'fitness', title: 'Cardio + strength training', frequency: '3x-week', durationMin: 40, priority: 2,
    instructions: ['Aim for ~150 min/week of moderate activity (brisk walking, cycling, swimming).', 'Include 2 sessions/week of full-body strength training.', 'Progress gradually; consult a doctor first if you have a medical condition.'],
    rationale: 'Improves fitness and body composition, which can change how facial contours look. It does not change bone structure.', linkedCategories: ['jaw'] },
  { id: 'posture-chin-tuck', area: 'posture', title: 'Chin tucks & wall posture drill', frequency: 'daily', durationMin: 5, priority: 2,
    instructions: ['Stand with back and head against a wall.', 'Gently draw the chin straight back (a "double chin" motion) without tilting the head; hold 5 s.', 'Repeat 10 times, then 10 slow wall angels.'],
    rationale: 'Helps reduce forward-head posture, which affects how the neck and jaw look in photos and in person.',
    caution: 'Stop if you feel pain, numbness or dizziness. Seek a physiotherapist for persistent neck problems.', linkedCategories: ['jaw'] },
];

const RULES: Rule[] = [
  // Skin appearance
  { when: (c) => (c.metric('skinTexture') ?? 0) > 1.6, task: { id: 'gentle-exfoliation', area: 'skincare', title: 'Gentle exfoliation (low strength)', frequency: 'weekly', durationMin: 5, priority: 2,
    instructions: ['Use a low-strength chemical exfoliant (e.g. lactic or salicylic acid) once a week; increase to twice only if well tolerated.', 'Avoid gritty scrubs and do not combine several exfoliants.', 'Always pair with daily sunscreen.'],
    rationale: 'Visible fine texture was above the reference range in your photo.', caution: 'Stop if stinging, redness or peeling persists. For persistent bumps or breakouts, see a dermatologist.', linkedCategories: ['skin'] } },
  { when: (c) => (c.metric('rednessVariation') ?? 0) > 2.5, task: { id: 'calm-skin', area: 'skincare', title: 'Keep skin calm', frequency: 'daily', durationMin: 1, priority: 2,
    instructions: ['Use lukewarm (not hot) water and avoid harsh scrubs.', 'Prefer fragrance-free products; introduce one new product at a time.', 'Note triggers (heat, spicy food, alcohol, new products).'],
    rationale: 'Colour variation (redness) appeared above the reference range in this photo. Lighting can also cause this.',
    caution: 'The app cannot diagnose skin conditions. If redness is persistent, painful or spreading, consult a dermatologist.', linkedCategories: ['skin'] } },
  { when: (c) => (c.metric('skinEvenness') ?? 0) > 2.5, task: { id: 'even-tone', area: 'skincare', title: 'Support even skin tone', frequency: 'daily', durationMin: 1, priority: 3,
    instructions: ['Make sunscreen non-negotiable — it is the most effective step for tone.', 'Optionally add a gentle, well-tolerated serum (e.g. niacinamide) after patch testing.'],
    rationale: 'Tone unevenness appeared above the reference range in this photo.', linkedCategories: ['skin'] } },

  // Grooming (self-report)
  { when: (c) => !!c.grooming && c.grooming.haircutRecency <= 3, task: { id: 'haircut', area: 'grooming', title: 'Keep a regular haircut schedule', frequency: 'monthly', durationMin: 45, priority: 1,
    instructions: ['Book a cut every 4–6 weeks for short styles, 8–10 weeks for longer styles.', 'Bring reference photos of styles that suit your face shape (see Hairstyle task).'],
    rationale: 'You reported your haircut is overdue.', linkedCategories: ['grooming'] } },
  { when: (c) => !!c.grooming && c.grooming.eyebrowsGroomed <= 3, task: { id: 'brows', area: 'grooming', title: 'Tidy eyebrows', frequency: 'weekly', durationMin: 5, priority: 2,
    instructions: ['Brush brows upward and trim only hairs that extend far past the natural line.', 'Remove stray hairs between the brows; avoid over-thinning the arch.', 'Consider a professional shaping once, then maintain at home.'],
    rationale: 'Well-kept brows frame the eye area. You reported they need attention.', linkedCategories: ['grooming', 'eyes'] } },
  { when: (c) => !!c.grooming && c.grooming.facialHairKept <= 3, task: { id: 'facial-hair', area: 'grooming', title: 'Define facial hair or shave cleanly', frequency: '3x-week', durationMin: 10, priority: 2,
    instructions: ['If keeping a beard: set a neckline about one finger above the Adam’s apple and a clean cheek line.', 'Trim to an even length; keep the moustache off the lip.', 'If shaving: shave with the grain after warm water and use a moisturiser after.'],
    rationale: 'You reported facial hair is untidy. A defined beard line can also visually sharpen the jaw.', linkedCategories: ['grooming', 'jaw'] } },
  { when: (c) => !!c.grooming && c.grooming.hairCondition <= 3, task: { id: 'hair-care', area: 'grooming', title: 'Hair care routine', frequency: '3x-week', durationMin: 10, priority: 3,
    instructions: ['Wash 2–4×/week (or as your hair type needs) and always condition the lengths.', 'Limit high heat; use a heat protectant when styling.', 'Use a light product (clay, cream or paste) suited to your hair type.'],
    rationale: 'You reported hair condition could be better.', linkedCategories: ['grooming'] } },
  { when: (c) => !!c.grooming && c.grooming.skincareRoutine <= 2, task: { id: 'routine-reminder', area: 'skincare', title: 'Build the habit: link skincare to brushing teeth', frequency: 'twice-daily', durationMin: 1, priority: 2,
    instructions: ['Keep cleanser/moisturiser/sunscreen next to your toothbrush.', 'Do them immediately after brushing, morning and night.'],
    rationale: 'You reported an inconsistent skincare routine.', linkedCategories: ['skin', 'grooming'] } },

  // Hairstyle by measured face shape (always added when shape is known)
  { when: (c) => c.metric('faceLengthRatio') !== null, task: (c) => hairstyleTask(c.metric('faceLengthRatio')!, c.metric('jawRatio')) },

  // Jaw / chin: only soft-tissue, posture and grooming levers
  { when: (c) => (c.cat('jaw') ?? 100) < 70, task: { id: 'jaw-contour', area: 'fitness', title: 'Jaw contour: body composition & grooming', frequency: 'weekly', durationMin: 10, priority: 2,
    instructions: ['If your body-fat level is above a healthy range, gradual fat loss through diet and exercise may make facial contours more visible.', 'A neatly defined beard or stubble can visually define the jawline.', 'In photos, keep the camera at or slightly above eye level and extend the neck slightly forward.'],
    rationale: 'Jawline & Chin scored lower in this analysis. These levers affect soft tissue and presentation only.',
    caution: 'No exercise (including "mewing" or jaw trainers) has been shown to change adult jaw bone structure; aggressive chewing devices can strain the jaw joint.', linkedCategories: ['jaw'] } },

  // Eye area
  { when: (c) => (c.cat('eyes') ?? 100) < 70, task: { id: 'eye-area', area: 'lifestyle', title: 'Eye-area care', frequency: 'daily', durationMin: 3, priority: 3,
    instructions: ['Prioritise sleep and limit late-evening salty food/alcohol to reduce puffiness.', 'A cool compress for 2–3 minutes can temporarily reduce morning puffiness.', 'Groom brows (see Grooming) — brows frame the eyes more than any exercise.'],
    rationale: 'Eye Area scored lower. Measured eye proportions (spacing, tilt) are structural and are not changed by habits; these steps target appearance factors like puffiness and framing.', linkedCategories: ['eyes'] } },

  // Symmetry & photo technique
  { when: (c) => (c.cat('symmetry') ?? 100) < 75 || (c.cat('harmony') ?? 100) < 70, task: { id: 'photo-technique', area: 'lifestyle', title: 'Consistent photo technique', frequency: 'once', durationMin: 10, priority: 3,
    instructions: ['Take analysis photos from ~1–1.5 m with the rear camera or zoom, not at arm’s length (close lenses enlarge the nose and narrow the face).', 'Keep the camera at eye level, head level, neutral expression, soft front light.', 'Use the same setup each time so progress comparisons are fair.'],
    rationale: 'Lens distance, head tilt and expression measurably change proportions and asymmetry in 2D photos.', linkedCategories: ['symmetry', 'harmony'] } },

  // Safe face relaxation (explicitly not structural)
  { when: () => true, task: { id: 'face-relax', area: 'exercise', title: 'Facial relaxation & light massage', frequency: 'daily', durationMin: 3, priority: 3,
    instructions: ['With clean hands and a little moisturiser, use light upward strokes from chin to ears and from the nose outwards.', 'Relax the jaw (teeth apart, lips closed) and unclench the brow for a few breaths.'],
    rationale: 'Can ease muscle tension and temporary puffiness.', caution: 'This does not change bone structure or permanently reshape the face. Skip on irritated skin.', linkedCategories: ['jaw', 'skin'] } },
];

export function hairstyleTask(lengthRatio: number, jawRatio: number | null): PlanTask {
  let shape: string, tips: string[];
  if (lengthRatio > 1.38) {
    shape = 'longer';
    tips = ['Keep some width/fullness at the sides rather than very short sides.', 'Avoid adding a lot of height on top.', 'A fringe or textured forward styling can shorten the look of the face.'];
  } else if (lengthRatio < 1.18) {
    shape = jawRatio !== null && jawRatio > 0.92 ? 'wider/squarer' : 'rounder/wider';
    tips = ['Add height or volume on top to lengthen the silhouette.', 'Keep the sides shorter or tighter.', 'Side parts and slightly asymmetric styles break up roundness.'];
  } else {
    shape = 'balanced';
    tips = ['Most cuts suit a balanced shape; choose based on hair type and lifestyle.', 'Medium-length textured styles or a classic taper are easy starting points.'];
  }
  return { id: 'hairstyle', area: 'hairstyle', title: `Hairstyle for a ${shape} face shape`, frequency: 'once', durationMin: 15, priority: 2,
    instructions: [...tips, 'Ask your barber/stylist about your hair type (density, wave, cowlicks) — it matters as much as face shape.'],
    rationale: `Measured face length ÷ width ratio: ${lengthRatio.toFixed(2)} (reference 1.18–1.38). Face-shape advice is a starting point, not a rule.`,
    linkedCategories: ['grooming', 'harmony'] };
}

export function generatePlan(report: ScoreReport, grooming: GroomingSelfReport | null): PlanTask[] {
  const ctx: Ctx = {
    report, grooming,
    cat: (id) => report.categories.find((c) => c.id === id)?.score ?? null,
    metric: (id) => {
      for (const c of report.categories) { const m = c.metrics.find((x) => x.id === id); if (m) return m.value; }
      return null;
    },
  };
  const tasks = [...BASE];
  for (const r of RULES) if (r.when(ctx)) tasks.push(typeof r.task === 'function' ? r.task(ctx) : r.task);
  // De-duplicate by id and sort by priority, then area.
  const seen = new Set<string>();
  return tasks.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
    .sort((a, b) => a.priority - b.priority || a.area.localeCompare(b.area));
}

export const FREQUENCY_LABEL: Record<PlanTask['frequency'], string> = {
  daily: 'Daily', 'twice-daily': 'Twice daily', '3x-week': '3× per week', weekly: 'Weekly', monthly: 'Monthly', once: 'Once',
};

export const AREA_LABEL: Record<PlanTask['area'], string> = {
  skincare: 'Skincare', hairstyle: 'Hairstyle', grooming: 'Grooming', fitness: 'Fitness', posture: 'Posture', exercise: 'Safe exercises', lifestyle: 'Lifestyle',
};
