import { useEffect, useRef, useState } from 'react';
import { db, downloadBlob, exportBackup, importBackup, requestPersistence, storageInfo } from '../../services/storage';
import { Icon } from '../components/Icon';
import { useStore } from '../store';

const mb = (b: number | null) => (b === null ? '?' : `${(b / 1024 / 1024).toFixed(1)} MB`);
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

export function SettingsPage() {
  const { settings, saveSettings, reload, analyses } = useStore();
  const [info, setInfo] = useState<Awaited<ReturnType<typeof storageInfo>> | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const fileRef = useRef<HTMLInputElement>(null);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    void storageInfo().then(setInfo);
    const on = () => setOnline(navigator.onLine);
    window.addEventListener('online', on); window.addEventListener('offline', on);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', on); };
  }, []);

  const doExport = async () => {
    const blob = await exportBackup();
    downloadBlob(blob, `lookmax-backup-${new Date().toISOString().slice(0, 10)}.json`);
    setMsg({ ok: true, text: `Exported ${analyses.length} analyses (${mb(blob.size)}).` });
  };
  const doImport = async (f?: File) => {
    if (!f) return;
    if (mode === 'replace' && !confirm('Replace ALL data on this device with the backup?')) return;
    try {
      const r = await importBackup(f, mode);
      await reload();
      setMsg({ ok: true, text: `Imported ${r.added} analyses${r.skipped ? `, skipped ${r.skipped} already present` : ''}.` });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold sm:text-3xl">Settings</h1>
      {msg && <div className={`card p-3 text-sm ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</div>}

      <section className="card space-y-4 p-5">
        <div className="font-medium">Privacy & display</div>
        <Toggle label="Keep photos with analyses" desc="When off, only measurements are saved (no images)." value={settings.keepPhotos} onChange={(v) => saveSettings({ ...settings, keepPhotos: v })} />
        <Toggle label="Show landmarks by default" desc="Overlay the 468 face-mesh points on results." value={settings.showLandmarks} onChange={(v) => saveSettings({ ...settings, showLandmarks: v })} />
        <div className="flex gap-2 rounded-xl bg-emerald-500/5 p-3 text-xs text-emerald-200/80"><Icon name="shield" className="h-4 w-4 shrink-0" />All analysis runs locally with an on-device model. The app makes no network requests with your photos or data.</div>
      </section>

      <section className="card space-y-4 p-5">
        <div className="font-medium">Backup & restore</div>
        <p className="text-sm text-slate-400">Backups are a single JSON file containing analyses, photos, plan and settings. Use them to move data between PC and iPhone — there is no automatic sync.</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={doExport}><Icon name="download" /> Export backup</button>
          <select className="input w-auto" value={mode} onChange={(e) => setMode(e.target.value as 'merge')}>
            <option value="merge">Import: merge</option>
            <option value="replace">Import: replace all</option>
          </select>
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}><Icon name="upload" /> Import backup</button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void doImport(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      </section>

      <section className="card space-y-3 p-5 text-sm">
        <div className="font-medium">Storage & offline</div>
        <Row k="Network" v={online ? 'Online' : 'Offline (app still works)'} />
        <Row k="Used / available" v={info ? `${mb(info.usage)} / ${mb(info.quota)}` : '…'} />
        <Row k="Persistent storage" v={info?.persisted === null ? 'Not supported' : info?.persisted ? 'Granted' : 'Not granted (browser may evict data under pressure)'} />
        {info && !info.persisted && <button className="btn-ghost" onClick={async () => { await requestPersistence(); setInfo(await storageInfo()); }}>Request persistent storage</button>}
        {isIOS && (
          <div className="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-200">
            iOS note: Safari may delete website data that hasn't been used for ~7 days unless the app is added to the Home Screen. {isStandalone ? 'You are running as a Home Screen app.' : 'Tap Share → "Add to Home Screen".'} Export backups regularly.
          </div>
        )}
      </section>

      <section className="card space-y-3 p-5">
        <div className="font-medium text-red-300">Danger zone</div>
        <button className="btn-danger" onClick={async () => { if (confirm('Permanently delete ALL analyses, photos and plan from this device? Export a backup first if you want to keep them.')) { await db.clearAll(); await reload(); setMsg({ ok: true, text: 'All local data deleted.' }); } }}>
          <Icon name="trash" className="h-4 w-4" /> Delete all data
        </button>
      </section>

      <p className="text-xs text-slate-600">Lookmax AI v0.1.0 · MediaPipe Face Landmarker (on-device)</p>
    </div>
  );
}

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <div><div className="text-sm">{label}</div><div className="text-xs text-slate-500">{desc}</div></div>
      <input type="checkbox" className="h-5 w-5 accent-violet-500" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4 border-b border-white/5 pb-2"><span className="text-slate-400">{k}</span><span className="text-right">{v}</span></div>;
}
