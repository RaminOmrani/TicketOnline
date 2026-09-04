import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Pause, Play, Download, Mic } from 'lucide-react';
import { formatDuration } from '@/lib/format';

/** Deterministic pseudo-waveform bars from a seed (looks like a voice message). */
function bars(seed: number, count = 40) {
  const out: number[] = [];
  let x = seed || 7;
  for (let i = 0; i < count; i++) {
    x = (x * 9301 + 49297) % 233280;
    const r = x / 233280;
    out.push(0.25 + r * 0.75);
  }
  return out;
}

export function AudioPlayer({ src, duration, voice, seed = 1, name, onDark }: { src: string; duration?: number | null; voice?: boolean; seed?: number; name?: string; onDark?: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [total, setTotal] = useState(duration || 0);
  const [rate, setRate] = useState(1);
  const wave = useMemo(() => bars(seed), [seed]);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onTime = () => setTime(a.currentTime);
    const onMeta = () => isFinite(a.duration) && a.duration > 0 && setTotal(a.duration);
    const onEnd = () => {
      setPlaying(false);
      setTime(0);
    };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('durationchange', onMeta);
    a.addEventListener('ended', onEnd);
    a.addEventListener('pause', () => setPlaying(false));
    a.addEventListener('play', () => setPlaying(true));
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('durationchange', onMeta);
      a.removeEventListener('ended', onEnd);
    };
  }, [src]);

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) {
      document.querySelectorAll('audio').forEach((x) => x !== a && x.pause());
      a.playbackRate = rate;
      a.play().catch(() => {});
    } else a.pause();
  };
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = ref.current;
    if (!a || !total) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = 1 - (e.clientX - rect.left) / rect.width; // RTL: progress from right
    a.currentTime = Math.max(0, Math.min(total, pct * total));
  };
  const cycleRate = () => {
    const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
    setRate(next);
    if (ref.current) ref.current.playbackRate = next;
  };
  const progress = total ? time / total : 0;

  return (
    <div className={clsx('flex w-full max-w-sm items-center gap-2.5 rounded-2xl px-2.5 py-2', onDark ? 'bg-white/15' : 'bg-slate-100 dark:bg-slate-800')}>
      <audio ref={ref} src={src} preload="metadata" />
      <button onClick={toggle} className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm transition active:scale-95', onDark ? 'bg-white text-brand' : 'bg-brand text-white')} aria-label={playing ? 'توقف' : 'پخش'}>
        {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 -mr-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex h-8 cursor-pointer items-center gap-[2px]" onClick={seek} dir="rtl">
          {wave.map((h, i) => {
            const active = i / wave.length < progress;
            return <span key={i} className={clsx('w-[3px] rounded-full transition-colors', active ? (onDark ? 'bg-white' : 'bg-brand') : onDark ? 'bg-white/40' : 'bg-slate-300 dark:bg-slate-600')} style={{ height: `${Math.round(h * 100)}%` }} />;
          })}
        </div>
        <div className={clsx('mt-0.5 flex items-center justify-between text-[11px]', onDark ? 'text-white/80' : 'text-slate-500')}>
          <span className="flex items-center gap-1">
            {voice && <Mic className="h-3 w-3" />}
            {formatDuration(playing || time > 0 ? time : total)} {total > 0 && (playing || time > 0) && `/ ${formatDuration(total)}`}
          </span>
          <span className="flex items-center gap-2">
            <button onClick={cycleRate} className={clsx('rounded-md px-1.5 font-bold', onDark ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700')}>{rate}x</button>
            <a href={`${src}?download=1`} download={name} className="hover:opacity-80" aria-label="دانلود">
              <Download className="h-3.5 w-3.5" />
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
