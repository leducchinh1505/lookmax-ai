import { Icon } from './ui/components/Icon';
import { navigate, useRoute, type Route } from './ui/router';
import { StoreProvider, useStore } from './ui/store';
import { Dashboard } from './ui/pages/Dashboard';
import { NewAnalysis } from './ui/pages/NewAnalysis';
import { AnalysisView } from './ui/pages/AnalysisView';
import { PlanPage } from './ui/pages/PlanPage';
import { ProgressPage } from './ui/pages/ProgressPage';
import { SettingsPage } from './ui/pages/SettingsPage';
import { ConsentGate } from './ui/pages/ConsentGate';

const NAV: { route: Route['name']; path: string; label: string; short: string; icon: string }[] = [
  { route: 'dashboard', path: '', label: 'Dashboard', short: 'Home', icon: 'home' },
  { route: 'new', path: 'new', label: 'New Analysis', short: 'New', icon: 'camera' },
  { route: 'analysis', path: 'analysis', label: 'Facial Analysis', short: 'Results', icon: 'face' },
  { route: 'plan', path: 'plan', label: 'Improvement Plan', short: 'Plan', icon: 'list' },
  { route: 'progress', path: 'progress', label: 'Progress', short: 'Progress', icon: 'chart' },
  { route: 'settings', path: 'settings', label: 'Settings', short: 'Settings', icon: 'gear' },
];

function Shell() {
  const route = useRoute();
  const { ready, error, settings } = useStore();

  if (!ready) return <div className="grid min-h-screen place-items-center text-slate-500">Loading…</div>;
  if (!settings.consentAccepted) return <ConsentGate />;

  return (
    <div className="mx-auto flex min-h-screen max-w-[1400px]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-1 border-r border-white/5 p-4 lg:flex">
        <div className="mb-6 flex items-center gap-2 px-2 pt-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-blue font-bold">L</div>
          <div>
            <div className="font-semibold leading-tight">Lookmax AI</div>
            <div className="text-[11px] text-slate-500">Local-first · offline</div>
          </div>
        </div>
        {NAV.map((n) => (
          <button key={n.route} onClick={() => navigate(n.path)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${route.name === n.route ? 'bg-accent/15 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
            <Icon name={n.icon} /> {n.label}
          </button>
        ))}
        <div className="mt-auto flex items-center gap-2 rounded-xl bg-white/[0.03] p-3 text-[11px] text-slate-500">
          <Icon name="shield" className="h-4 w-4 shrink-0 text-emerald-400" /> Photos are processed and stored only on this device.
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-4 safe-top sm:px-6 lg:px-10 lg:pb-10 lg:pt-8">
        {error && <div className="card mb-4 border-red-500/30 p-4 text-sm text-red-300">{error}</div>}
        <div key={route.name} className="animate-fadeUp">
          {route.name === 'dashboard' && <Dashboard />}
          {route.name === 'new' && <NewAnalysis />}
          {route.name === 'analysis' && <AnalysisView id={route.id} />}
          {route.name === 'plan' && <PlanPage />}
          {route.name === 'progress' && <ProgressPage />}
          {route.name === 'settings' && <SettingsPage />}
        </div>
      </main>

      {/* Mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-ink-950/90 backdrop-blur-lg safe-bottom lg:hidden">
        <div className="grid grid-cols-6">
          {NAV.map((n) => (
            <button key={n.route} onClick={() => navigate(n.path)}
              className={`flex flex-col items-center gap-1 py-2.5 text-[10px] ${route.name === n.route ? 'text-accent-soft' : 'text-slate-500'}`}>
              <Icon name={n.icon} className="h-[22px] w-[22px]" />
              <span className="leading-none">{n.short}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
