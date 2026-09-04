import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Mic, Square, Trash2, Check, Pause, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDuration } from '@/lib/format';

export interface VoiceClip {
  blob: Blob;
  duration: number;
  url: string;
  ext: string;
}

function pickMime(): { mime: string; ext: string } {
  const candidates: [string, string][] = [
    ['audio/webm;codecs=opus', 'webm'],
    ['audio/ogg;codecs=opus', 'ogg'],
    ['audio/webm', 'webm'],
    ['audio/mp4', 'm4a'],
    ['audio/aac', 'aac'],
  ];
  for (const [m, ext] of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return { mime: m, ext };
  }
  return { mime: '', ext: 'webm' };
}

const MAX_SECONDS = 10 * 60;

export function VoiceRecorder({ onDone, onCancel }: { onDone: (clip: VoiceClip) => void; onCancel: () => void }) {
  const [state, setState] = useState<'idle' | 'recording' | 'paused' | 'preview'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState<number[]>(Array(24).fill(0.1));
  const [clip, setClip] = useState<VoiceClip | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const startRef = useRef(0);
  const accRef = useRef(0);
  const mimeRef = useRef(pickMime());

  const cleanup = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current?.close().catch(() => {});
    streamRef.current = null;
    ctxRef.current = null;
  };

  useEffect(() => {
    start();
    return () => {
      cleanup();
      if (clip?.url) URL.revokeObjectURL(clip.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tick = () => {
    const total = accRef.current + (Date.now() - startRef.current) / 1000;
    setSeconds(total);
    if (total >= MAX_SECONDS) stop();
  };

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error('مرورگر شما از ضبط صدا پشتیبانی نمی‌کند.');
      onCancel();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, mimeRef.current.mime ? { mimeType: mimeRef.current.mime, audioBitsPerSecond: 64000 } : undefined);
      recRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || mimeRef.current.mime || 'audio/webm' });
        const duration = accRef.current + (startRef.current ? (Date.now() - startRef.current) / 1000 : 0);
        const url = URL.createObjectURL(blob);
        setClip({ blob, duration, url, ext: mimeRef.current.ext });
        setState('preview');
        cleanup();
      };
      rec.start(250);
      startRef.current = Date.now();
      accRef.current = 0;
      setState('recording');
      timerRef.current = window.setInterval(tick, 200);

      // Level meter
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setLevel((prev) => [...prev.slice(1), Math.min(1, 0.1 + rms * 4)]);
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (e: any) {
      toast.error(e?.name === 'NotAllowedError' ? 'دسترسی به میکروفون رد شد. لطفاً مجوز میکروفون را در مرورگر فعال کنید.' : 'میکروفون در دسترس نیست.');
      onCancel();
    }
  };

  const pause = () => {
    const rec = recRef.current;
    if (!rec || rec.state !== 'recording') return;
    rec.pause();
    accRef.current += (Date.now() - startRef.current) / 1000;
    startRef.current = 0;
    if (timerRef.current) window.clearInterval(timerRef.current);
    setState('paused');
  };
  const resume = () => {
    const rec = recRef.current;
    if (!rec || rec.state !== 'paused') return;
    rec.resume();
    startRef.current = Date.now();
    timerRef.current = window.setInterval(tick, 200);
    setState('recording');
  };
  const stop = () => {
    const rec = recRef.current;
    if (!rec || rec.state === 'inactive') return;
    if (rec.state === 'recording') {
      accRef.current += (Date.now() - startRef.current) / 1000;
      startRef.current = 0;
    }
    if (timerRef.current) window.clearInterval(timerRef.current);
    rec.stop();
  };
  const discard = () => {
    if (recRef.current && recRef.current.state !== 'inactive') {
      recRef.current.onstop = null;
      recRef.current.stop();
    }
    cleanup();
    if (clip?.url) URL.revokeObjectURL(clip.url);
    onCancel();
  };

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 dark:border-rose-500/30 dark:bg-rose-500/10 animate-fade-in">
      <button onClick={discard} className="btn-icon text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500/20" aria-label="حذف">
        <Trash2 className="h-5 w-5" />
      </button>
      {state === 'preview' && clip ? (
        <>
          <audio src={clip.url} controls className="h-9 flex-1 min-w-0" />
          <span className="num text-xs text-slate-500">{formatDuration(clip.duration)}</span>
          <button onClick={() => onDone(clip)} className="btn-primary btn-sm">
            <Check className="h-4 w-4" /> افزودن
          </button>
        </>
      ) : (
        <>
          <span className="relative flex h-3 w-3 shrink-0">
            {state === 'recording' && <span className="absolute inline-flex h-full w-full rounded-full bg-rose-500 animate-pulse-ring" />}
            <span className={clsx('relative inline-flex h-3 w-3 rounded-full', state === 'recording' ? 'bg-rose-500' : 'bg-slate-400')} />
          </span>
          <div className="flex h-8 flex-1 items-center gap-[3px] overflow-hidden" dir="ltr">
            {level.map((l, i) => (
              <span key={i} className="w-1 rounded-full bg-rose-400 transition-all" style={{ height: `${Math.round(l * 100)}%` }} />
            ))}
          </div>
          <span className="num min-w-[44px] text-sm font-semibold text-rose-600 dark:text-rose-300">{formatDuration(seconds)}</span>
          {state === 'recording' ? (
            <button onClick={pause} className="btn-icon" aria-label="مکث">
              <Pause className="h-5 w-5" />
            </button>
          ) : (
            <button onClick={resume} className="btn-icon" aria-label="ادامه">
              <Play className="h-5 w-5" />
            </button>
          )}
          <button onClick={stop} className="flex h-9 items-center gap-1.5 rounded-xl bg-rose-600 px-3 text-sm font-semibold text-white hover:bg-rose-700" aria-label="پایان ضبط">
            <Square className="h-4 w-4 fill-current" /> پایان
          </button>
        </>
      )}
      <span className="sr-only">
        <Mic />
      </span>
    </div>
  );
}
