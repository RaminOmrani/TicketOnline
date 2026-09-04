import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Download, FileText, FileArchive, FileSpreadsheet, File, X, ChevronLeft, ChevronRight, FileCode, Database } from 'lucide-react';
import { formatBytes } from '@/lib/format';
import type { Attachment } from '@/lib/types';
import { AudioPlayer } from './AudioPlayer';

export function fileIcon(name: string, mime: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (mime === 'application/pdf' || ext === 'pdf') return <FileText className="h-6 w-6 text-rose-500" />;
  if (['zip', 'rar', '7z', 'gz', 'tar'].includes(ext)) return <FileArchive className="h-6 w-6 text-amber-500" />;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet className="h-6 w-6 text-emerald-600" />;
  if (['doc', 'docx', 'txt'].includes(ext)) return <FileText className="h-6 w-6 text-blue-500" />;
  if (['json', 'xml', 'log', 'sql'].includes(ext)) return <FileCode className="h-6 w-6 text-violet-500" />;
  if (['bak', 'mdb', 'accdb', 'db'].includes(ext)) return <Database className="h-6 w-6 text-slate-500" />;
  return <File className="h-6 w-6 text-slate-400" />;
}

export function Lightbox({ items, index, onClose, onIndex }: { items: Attachment[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const a = items[index];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onIndex((index + 1) % items.length);
      if (e.key === 'ArrowRight') onIndex((index - 1 + items.length) % items.length);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [index, items.length]);
  if (!a) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 animate-fade-in" onClick={onClose}>
      <div className="absolute right-4 top-4 flex items-center gap-2 text-white" onClick={(e) => e.stopPropagation()}>
        <a href={`${a.url}?download=1`} download={a.name} className="rounded-full bg-white/10 p-2 hover:bg-white/20" aria-label="دانلود">
          <Download className="h-5 w-5" />
        </a>
        <button className="rounded-full bg-white/10 p-2 hover:bg-white/20" onClick={onClose} aria-label="بستن">
          <X className="h-5 w-5" />
        </button>
      </div>
      {items.length > 1 && (
        <>
          <button className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); onIndex((index - 1 + items.length) % items.length); }}>
            <ChevronRight className="h-6 w-6" />
          </button>
          <button className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); onIndex((index + 1) % items.length); }}>
            <ChevronLeft className="h-6 w-6" />
          </button>
        </>
      )}
      <img src={a.url} alt={a.name} className="max-h-[90vh] max-w-[92vw] rounded-lg object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
        {a.name} — {formatBytes(a.size)}
      </div>
    </div>
  );
}

export function Attachments({ items, onDark }: { items: Attachment[]; onDark?: boolean }) {
  const [lb, setLb] = useState<number | null>(null);
  if (!items?.length) return null;
  const images = items.filter((a) => a.kind === 'image');
  const videos = items.filter((a) => a.kind === 'video');
  const audios = items.filter((a) => a.kind === 'audio' || a.kind === 'voice');
  const files = items.filter((a) => a.kind === 'file');

  return (
    <div className="mt-2 space-y-2">
      {images.length > 0 && (
        <div className={clsx('grid gap-1.5', images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
          {images.map((a) => (
            <button key={a.id} onClick={() => setLb(images.indexOf(a))} className="group relative overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-700" style={{ aspectRatio: images.length === 1 && a.width && a.height ? `${a.width}/${a.height}` : '4/3', maxHeight: images.length === 1 ? 360 : 200 }}>
              <img src={a.thumb_url || a.url} alt={a.name} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
            </button>
          ))}
        </div>
      )}
      {videos.map((a) => (
        <div key={a.id} className="overflow-hidden rounded-xl bg-black">
          <video src={a.url} controls preload="metadata" className="max-h-[360px] w-full" playsInline />
          <div className="flex items-center justify-between bg-slate-900 px-3 py-1.5 text-[11px] text-slate-300">
            <span className="truncate">{a.name}</span>
            <a href={`${a.url}?download=1`} download={a.name} className="flex items-center gap-1 hover:text-white">
              <Download className="h-3.5 w-3.5" /> {formatBytes(a.size)}
            </a>
          </div>
        </div>
      ))}
      {audios.map((a) => (
        <AudioPlayer key={a.id} src={a.url} duration={a.duration} voice={a.kind === 'voice'} seed={a.id} name={a.name} onDark={onDark} />
      ))}
      {files.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {files.map((a) => (
            <a key={a.id} href={`${a.url}?download=1`} download={a.name} className={clsx('flex items-center gap-3 rounded-xl border px-3 py-2 transition hover:shadow-sm', onDark ? 'border-white/20 bg-white/10 text-white hover:bg-white/20' : 'border-slate-200 bg-white text-slate-700 hover:border-brand/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200')}>
              <span className="shrink-0">{fileIcon(a.name, a.mime)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium" dir="auto">{a.name}</span>
                <span className={clsx('block text-[11px]', onDark ? 'text-white/70' : 'text-slate-400')}>{formatBytes(a.size)}</span>
              </span>
              <Download className="h-4 w-4 shrink-0 opacity-60" />
            </a>
          ))}
        </div>
      )}
      {lb !== null && <Lightbox items={images} index={lb} onClose={() => setLb(null)} onIndex={setLb} />}
    </div>
  );
}
