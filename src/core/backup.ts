// Backup format (JSON). Photos are embedded as JPEG data URLs so a single file
// can move between PC and iPhone. Pure validation lives here; Blob conversion
// happens in services/storage.
import type { AnalysisRecord, PlanState } from './types';

export const BACKUP_FORMAT = 'lookmax-ai-backup';
export const BACKUP_VERSION = 1;

export interface Settings {
  id: 'settings';
  keepPhotos: boolean;
  showLandmarks: boolean;
  consentAccepted: boolean;
}

export const DEFAULT_SETTINGS: Settings = { id: 'settings', keepPhotos: true, showLandmarks: true, consentAccepted: false };

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  analyses: AnalysisRecord[]; // photo.image is a data URL string here
  plan: PlanState | null;
  settings: Settings | null;
}

export function validateBackup(obj: unknown): { ok: true; data: BackupFile } | { ok: false; error: string } {
  if (!obj || typeof obj !== 'object') return { ok: false, error: 'File is not a JSON object.' };
  const b = obj as Partial<BackupFile>;
  if (b.format !== BACKUP_FORMAT) return { ok: false, error: 'Not a Lookmax AI backup file.' };
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) return { ok: false, error: `Unsupported backup version ${String(b.version)}.` };
  if (!Array.isArray(b.analyses)) return { ok: false, error: 'Backup has no analyses list.' };
  for (const [i, a] of b.analyses.entries()) {
    if (!a || typeof a.id !== 'string' || typeof a.createdAt !== 'string' || !a.report || !Array.isArray(a.photos)) {
      return { ok: false, error: `Analysis #${i + 1} is malformed.` };
    }
    for (const p of a.photos) {
      if (typeof p.image !== 'string' || (p.image !== '' && !p.image.startsWith('data:image/'))) {
        return { ok: false, error: `Analysis #${i + 1} contains an invalid photo.` };
      }
    }
  }
  return { ok: true, data: b as BackupFile };
}

/** Merge: records already present (same id) are kept as-is; new ones are added. */
export function mergeAnalyses(existing: AnalysisRecord[], incoming: AnalysisRecord[]): { merged: AnalysisRecord[]; added: number; skipped: number } {
  const map = new Map(existing.map((a) => [a.id, a]));
  let added = 0, skipped = 0;
  for (const a of incoming) {
    if (map.has(a.id)) { skipped++; continue; }
    map.set(a.id, a); added++;
  }
  return { merged: [...map.values()], added, skipped };
}
