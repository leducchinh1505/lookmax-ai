import { Icon } from '../components/Icon';
import { useStore } from '../store';

export function ConsentGate() {
  const { settings, saveSettings } = useStore();
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="card max-w-lg animate-fadeUp p-6 sm:p-8">
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-blue font-bold">L</div>
        <h1 className="text-2xl font-semibold">Welcome to Lookmax AI</h1>
        <p className="mt-2 text-sm text-slate-400">A private, offline tool that measures facial proportions in your photos and builds a self-care plan.</p>
        <ul className="mt-5 space-y-3 text-sm text-slate-300">
          {[
            ['shield', 'Photos are analysed on this device. Nothing is uploaded; no account, no cloud.'],
            ['info', 'Scores compare 2D measurements with common reference ranges. They cannot judge bone structure or how attractive you are.'],
            ['info', 'Skin readings describe the photo, not your health. This is not medical or dermatological advice.'],
            ['download', 'Data stays in this browser/app. Use Settings → Export to back it up or move it to another device.'],
          ].map(([icon, text]) => (
            <li key={text} className="flex gap-3"><Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0 text-accent-soft" />{text}</li>
          ))}
        </ul>
        <p className="mt-5 text-xs text-slate-500">Intended for adults. If thinking about your appearance causes you distress, consider talking to someone you trust or a professional.</p>
        <button className="btn-primary mt-6 w-full" onClick={() => saveSettings({ ...settings, consentAccepted: true })}>I understand — continue</button>
      </div>
    </div>
  );
}
