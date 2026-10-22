import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

/** Webcam / front-camera capture. Requires a secure context (https or localhost). */
export function Camera({ onCapture, onClose }: { onCapture: (canvas: HTMLCanvasElement) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError('Live camera needs HTTPS or localhost. Use "Upload / take photo" instead — on iPhone it opens the camera directly.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        if (video.current) { video.current.srcObject = stream; await video.current.play().catch(() => {}); }
        setError(null);
      } catch (e) {
        const name = (e as DOMException).name;
        setError(name === 'NotAllowedError' ? 'Camera permission was denied. Allow it in the browser/site settings, or upload a photo instead.'
          : name === 'NotFoundError' ? 'No camera found on this device.' : `Camera unavailable (${name}).`);
      }
    })();
    return () => { cancelled = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [facing]);

  const capture = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0); // un-mirrored, like a normal photo
    onCapture(c);
  };

  const timed = () => {
    let n = 3; setCountdown(n);
    const t = setInterval(() => { n--; if (n === 0) { clearInterval(t); setCountdown(null); capture(); } else setCountdown(n); }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black safe-top safe-bottom">
      <div className="relative flex-1 overflow-hidden">
        {error ? (
          <div className="grid h-full place-items-center p-8 text-center text-slate-300">{error}</div>
        ) : (
          <>
            <video ref={video} playsInline muted className={`h-full w-full object-contain ${facing === 'user' ? '-scale-x-100' : ''}`} />
            {/* Framing guide */}
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="aspect-[3/4] h-[70%] rounded-[50%] border-2 border-dashed border-white/30" />
            </div>
            {countdown !== null && <div className="absolute inset-0 grid place-items-center text-8xl font-bold text-white/90">{countdown}</div>}
          </>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 bg-ink-950 p-4">
        <button className="btn-ghost" onClick={onClose}><Icon name="x" /> Close</button>
        <div className="flex gap-2">
          <button className="btn-ghost" disabled={!!error} onClick={timed}><Icon name="clock" /> 3s</button>
          <button className="btn-primary px-6" disabled={!!error} onClick={capture}><Icon name="camera" /> Capture</button>
        </div>
        <button className="btn-ghost" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}><Icon name="refresh" /></button>
      </div>
    </div>
  );
}
