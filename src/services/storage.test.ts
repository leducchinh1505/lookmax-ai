import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, exportBackup, importBackup, resetDbForTests } from './storage';
import type { AnalysisRecord } from '../core/types';

const rec = (id: string, date: string): AnalysisRecord => ({
  id, createdAt: date, measurements: [], grooming: null, appVersion: 't',
  report: { overall: 70, overallConfidence: 0.5, disclaimer: '', categories: [] },
  photos: [{ id: 'p', intended: 'front', detectedPose: 'front', headPose: null, landmarks: null, width: 1, height: 1,
    quality: { checks: [], score: 1, usable: true }, image: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }) }],
});

beforeEach(async () => {
  resetDbForTests();
  await db.clearAll();
});

describe('IndexedDB storage', () => {
  it('stores and lists analyses newest first', async () => {
    await db.putAnalysis(rec('a', '2026-01-01T00:00:00Z'));
    await db.putAnalysis(rec('b', '2026-02-01T00:00:00Z'));
    expect((await db.listAnalyses()).map((a) => a.id)).toEqual(['b', 'a']);
    await db.deleteAnalysis('b');
    expect((await db.listAnalyses()).map((a) => a.id)).toEqual(['a']);
  });

  it('returns default settings and persists changes', async () => {
    const s = await db.getSettings();
    expect(s.keepPhotos).toBe(true);
    await db.putSettings({ ...s, showLandmarks: false });
    expect((await db.getSettings()).showLandmarks).toBe(false);
  });

  it('round-trips a backup (export -> clear -> import) including photos', async () => {
    await db.putAnalysis(rec('a', '2026-01-01T00:00:00Z'));
    const blob = await exportBackup();
    const json = JSON.parse(await blob.text());
    expect(json.analyses[0].photos[0].image).toMatch(/^data:image\/jpeg;base64,/);

    await db.clearAll();
    const r = await importBackup(blob, 'merge');
    expect(r).toEqual({ added: 1, skipped: 0 });
    const back = await db.listAnalyses();
    const img = back[0].photos[0].image as Blob;
    expect(Array.from(new Uint8Array(await img.arrayBuffer()))).toEqual([1, 2, 3]);

    const again = await importBackup(blob, 'merge');
    expect(again).toEqual({ added: 0, skipped: 1 });
  });

  it('rejects invalid backup files', async () => {
    await expect(importBackup(new Blob(['not json']), 'merge')).rejects.toThrow(/JSON/);
    await expect(importBackup(new Blob([JSON.stringify({ format: 'x' })]), 'merge')).rejects.toThrow(/Not a Lookmax/);
  });
});
