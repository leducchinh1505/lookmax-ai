// Shared domain types. Everything in src/core is framework-free and runs in Node
// (tests), the browser, Tauri's WebView and iOS Safari alike.

export interface Point2 { x: number; y: number }
export interface Point3 { x: number; y: number; z: number }

/** Minimal ImageData-compatible shape so pixel code is testable without a DOM. */
export interface PixelBuffer {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

export type Pose = 'front' | 'threeQuarterLeft' | 'threeQuarterRight' | 'profileLeft' | 'profileRight';
/** What the user says they are capturing. "left" = subject's left cheek faces the camera. */
export type IntendedAngle = 'front' | 'left' | 'right' | 'threeQuarter';

export interface HeadPose { yaw: number; pitch: number; roll: number } // degrees

export type CheckStatus = 'pass' | 'warn' | 'fail';
export interface QualityCheck {
  id: string;
  label: string;
  status: CheckStatus;
  value?: number;
  detail: string;
}
export interface QualityReport {
  checks: QualityCheck[];
  /** 0..1 multiplier applied to metric confidence. */
  score: number;
  usable: boolean;
}

export type CategoryId =
  | 'harmony'
  | 'symmetry'
  | 'eyes'
  | 'nose'
  | 'jaw'
  | 'skin'
  | 'grooming';

/** A raw, unit-bearing measurement taken from one photo. */
export interface Measurement {
  id: string;
  value: number;
  /** Pose of the photo it came from. */
  pose: Pose;
  photoId: string;
  /** 0..1, how trustworthy this value is given pose & quality. */
  confidence: number;
}

export interface MetricResult {
  id: string;
  label: string;
  category: CategoryId;
  unit: string;
  /** Aggregated raw measurement (null when not measurable). */
  value: number | null;
  /** 0..100 converted score; null when insufficient data. */
  score: number | null;
  confidence: number;
  reference: string;
  /** Short, non-judgmental interpretation of where the value sits. */
  interpretation: string;
  sources: string[]; // photo ids
}

export interface CategoryResult {
  id: CategoryId;
  label: string;
  score: number | null;
  confidence: number;
  coverage: number; // fraction of metric weight that had data
  metrics: MetricResult[];
  limitations: string[];
  status: 'scored' | 'insufficient';
}

export interface ScoreReport {
  overall: number | null;
  overallConfidence: number;
  categories: CategoryResult[];
  disclaimer: string;
}

export interface GroomingSelfReport {
  hairCondition: 1 | 2 | 3 | 4 | 5;
  haircutRecency: 1 | 2 | 3 | 4 | 5; // 5 = cut within ~4 weeks
  facialHairKept: 1 | 2 | 3 | 4 | 5;
  eyebrowsGroomed: 1 | 2 | 3 | 4 | 5;
  skincareRoutine: 1 | 2 | 3 | 4 | 5;
}

export interface PhotoRecord {
  id: string;
  intended: IntendedAngle;
  detectedPose: Pose | null;
  headPose: HeadPose | null;
  quality: QualityReport;
  /** Normalised 0..1 landmarks (x,y) + relative z, for overlay. */
  landmarks: Point3[] | null;
  width: number;
  height: number;
  /** JPEG thumbnail. Blob in IndexedDB, data URL in backups. */
  image: Blob | string;
}

export interface AnalysisRecord {
  id: string;
  createdAt: string; // ISO
  photos: PhotoRecord[];
  measurements: Measurement[];
  report: ScoreReport;
  grooming: GroomingSelfReport | null;
  notes?: string;
  appVersion: string;
}

export type TaskArea = 'skincare' | 'hairstyle' | 'grooming' | 'fitness' | 'posture' | 'exercise' | 'lifestyle';
export type Frequency = 'daily' | 'twice-daily' | '3x-week' | 'weekly' | 'monthly' | 'once';

export interface PlanTask {
  id: string;
  area: TaskArea;
  title: string;
  instructions: string[];
  frequency: Frequency;
  durationMin: number;
  rationale: string;
  caution?: string;
  linkedCategories: CategoryId[];
  priority: 1 | 2 | 3; // 1 = highest
}

export interface PlanState {
  id: 'current';
  basedOnAnalysisId: string | null;
  createdAt: string;
  tasks: PlanTask[];
  /** Map taskId -> ISO date strings (yyyy-mm-dd) when completed. */
  completions: Record<string, string[]>;
  archived: string[]; // task ids hidden by user
}
