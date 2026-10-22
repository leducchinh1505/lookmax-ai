// LocalStorage module: IndexedDB persistence (works in browsers, Tauri's
// WebView2 and iOS Safari/PWA) plus backup export/import.
import { BACKUP_FORMAT, BACKUP_VERSION, DEFAULT_SETTINGS, mergeAnalyses, validateBackup, type BackupFile, type Settings } from '../core/backup';
import type { AnalysisRecord, PlanState } from '../core/types';
import { blobToDataUrl, dataUrlToBlob } from './imageLoader';

const DB_NAME = 'lookmax-ai';
const DB_VERSION = 1;

let dbp: Promise<IDBDatabase> | null = null;

export function openDb(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('analyses')) db.createObjectStore('analyses', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbp = null; reject(req.error); };
  });
  return dbp;
}

/** Test hook: forget the cached connection. */
export function resetDbForTests() { dbp = null; }

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const r = fn(s);
    let result: T;
    if (r) r.onsuccess = () => { result = r.result; };
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('Transaction aborted (storage full?)'));
  }));
}

export const db = {
  listAnalyses: async (): Promise<AnalysisRecord[]> =>
    ((await tx<AnalysisRecord[]>('analyses', 'readonly', (s) => s.getAll())) ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  getAnalysis: (id: string) => tx<AnalysisRecord | undefined>('analyses', 'readonly', (s) => s.get(id)),
  putAnalysis: (a: AnalysisRecord) => tx('analyses', 'readwrite', (s) => s.put(a)),
  deleteAnalysis: (id: string) => tx('analyses', 'readwrite', (s) => s.delete(id)),
  clearAll: async () => { await tx('analyses', 'readwrite', (s) => s.clear()); await tx('kv', 'readwrite', (s) => s.clear()); },
  getPlan: () => tx<PlanState | undefined>('kv', 'readonly', (s) => s.get('current')),
  putPlan: (p: PlanState) => tx('kv', 'readwrite', (s) => s.put(p)),
  getSettings: async (): Promise<Settings> => ({ ...DEFAULT_SETTINGS, ...((await tx<Settings | undefined>('kv', 'readonly', (s) => s.get('settings'))) ?? {}) }),
  putSettings: (st: Settings) => tx('kv', 'readwrite', (s) => s.put(st)),
};

export async function exportBackup(): Promise<Blob> {
  const analyses = await db.listAnalyses();
  const out: AnalysisRecord[] = [];
  for (const a of analyses) {
    out.push({ ...a, photos: await Promise.all(a.photos.map(async (p) => ({ ...p, image: typeof p.image === 'string' ? p.image : await blobToDataUrl(p.image) }))) });
  }
  const file: BackupFile = {
    format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(),
    analyses: out, plan: (await db.getPlan()) ?? null, settings: await db.getSettings(),
  };
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

export async function importBackup(file: Blob, mode: 'merge' | 'replace'): Promise<{ added: number; skipped: number }> {
  let parsed: unknown;
  try { parsed = JSON.parse(await file.text()); } catch { throw new Error('File is not valid JSON.'); }
  const v = validateBackup(parsed);
  if (!v.ok) throw new Error(v.error);
  const incoming: AnalysisRecord[] = [];
  for (const a of v.data.analyses) {
    incoming.push({ ...a, photos: await Promise.all(a.photos.map(async (p) => ({ ...p, image: p.image ? await dataUrlToBlob(p.image as string) : '' }))) });
  }
  if (mode === 'replace') await db.clearAll();
  const existing = mode === 'replace' ? [] : await db.listAnalyses();
  const { added, skipped } = mergeAnalyses(existing, incoming);
  const existingIds = new Set(existing.map((a) => a.id));
  for (const a of incoming) if (!existingIds.has(a.id)) await db.putAnalysis(a);
  if (v.data.plan && (mode === 'replace' || !(await db.getPlan()))) await db.putPlan(v.data.plan);
  if (v.data.settings && mode === 'replace') await db.putSettings(v.data.settings);
  return { added, skipped };
}

export async function storageInfo(): Promise<{ usage: number | null; quota: number | null; persisted: boolean | null }> {
  const s = navigator.storage;
  if (!s?.estimate) return { usage: null, quota: null, persisted: null };
  const e = await s.estimate();
  const persisted = s.persisted ? await s.persisted() : null;
  return { usage: e.usage ?? null, quota: e.quota ?? null, persisted };
}

export async function requestPersistence(): Promise<boolean> {
  return (await navigator.storage?.persist?.()) ?? false;
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
