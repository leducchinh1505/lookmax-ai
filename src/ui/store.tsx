import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, type Settings } from '../core/backup';
import { generatePlan } from '../core/recommendations';
import type { AnalysisRecord, PlanState } from '../core/types';
import { db } from '../services/storage';

interface Store {
  ready: boolean;
  error: string | null;
  analyses: AnalysisRecord[];
  plan: PlanState | null;
  settings: Settings;
  reload: () => Promise<void>;
  saveAnalysis: (a: AnalysisRecord) => Promise<void>;
  deleteAnalysis: (id: string) => Promise<void>;
  savePlan: (p: PlanState) => Promise<void>;
  saveSettings: (s: Settings) => Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [plan, setPlan] = useState<PlanState | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const reload = useCallback(async () => {
    try {
      const [a, p, s] = await Promise.all([db.listAnalyses(), db.getPlan(), db.getSettings()]);
      setAnalyses(a); setPlan(p ?? null); setSettings(s);
    } catch (e) {
      setError(`Local storage unavailable: ${(e as Error).message}. Private browsing mode can block IndexedDB.`);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const saveAnalysis = async (a: AnalysisRecord) => {
    await db.putAnalysis(a);
    // Regenerate the plan from the newest analysis, keeping completion history.
    const tasks = generatePlan(a.report, a.grooming);
    const next: PlanState = {
      id: 'current', basedOnAnalysisId: a.id, createdAt: new Date().toISOString(), tasks,
      completions: plan?.completions ?? {}, archived: plan?.archived ?? [],
    };
    await db.putPlan(next);
    await reload();
  };

  const value: Store = {
    ready, error, analyses, plan, settings, reload, saveAnalysis,
    deleteAnalysis: async (id) => { await db.deleteAnalysis(id); await reload(); },
    savePlan: async (p) => { setPlan(p); await db.putPlan(p); },
    saveSettings: async (s) => { setSettings(s); await db.putSettings(s); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}

/** Object URL for a stored photo (Blob) or data URL string. */
export function usePhotoUrl(image: Blob | string | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!image) return setUrl(undefined);
    if (typeof image === 'string') return setUrl(image || undefined);
    const u = URL.createObjectURL(image);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [image]);
  return url;
}
