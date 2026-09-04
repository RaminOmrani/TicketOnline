import { useRef } from 'react';
import clsx from 'clsx';
import { X, Film, Music, Mic, Paperclip, ImagePlus, Video } from 'lucide-react';
import { formatBytes, formatDuration } from '@/lib/format';
import { fileIcon } from './AttachmentView';
import type { PendingFile } from './useAttachments';
import type { VoiceClip } from './VoiceRecorder';

export function PendingList({ files, voice, onRemove, onRemoveVoice }: { files: PendingFile[]; voice: VoiceClip | null; onRemove: (id: string) => void; onRemoveVoice: () => void }) {
  if (!files.length && !voice) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {files.map((p) => (
        <div key={p.id} className="group relative flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 pr-2 dark:border-slate-700 dark:bg-slate-800 animate-fade-in" style={{ maxWidth: 240 }}>
          {p.kind === 'image' && p.preview ? (
            <img src={p.preview} alt="" className="h-12 w-12 rounded-lg object-cover" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
              {p.kind === 'video' ? <Film className="h-6 w-6 text-violet-500" /> : p.kind === 'audio' ? <Music className="h-6 w-6 text-emerald-500" /> : fileIcon(p.file.name, p.file.type)}
            </span>
          )}
          <span className="min-w-0">
            <span className="block max-w-[150px] truncate text-xs font-medium" dir="auto" title={p.file.name}>{p.file.name}</span>
            <span className="block text-[11px] text-slate-400">
              {formatBytes(p.file.size)}
              {p.duration ? ` • ${formatDuration(p.duration)}` : ''}
            </span>
          </span>
          <button type="button" onClick={() => onRemove(p.id)} className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-white shadow hover:bg-rose-600" aria-label="حذف">
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      {voice && (
        <div className="relative flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-1.5 pr-2 dark:border-rose-500/30 dark:bg-rose-500/10 animate-fade-in">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-500/20">
            <Mic className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-xs font-medium">پیام صوتی</span>
            <span className="block text-[11px] text-slate-400">{formatDuration(voice.duration)} • {formatBytes(voice.blob.size)}</span>
          </span>
          <audio src={voice.url} controls className="h-8 w-40" />
          <button type="button" onClick={onRemoveVoice} className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-white shadow hover:bg-rose-600" aria-label="حذف">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export function AttachButtons({ onFiles, disabled, compact }: { onFiles: (f: FileList) => void; disabled?: boolean; compact?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) onFiles(e.target.files);
    e.target.value = '';
  };
  return (
    <>
      <input ref={fileRef} type="file" multiple hidden onChange={handle} />
      <input ref={imgRef} type="file" multiple hidden accept="image/*" onChange={handle} />
      <input ref={vidRef} type="file" multiple hidden accept="video/*" capture="environment" onChange={handle} />
      <button type="button" className={clsx('btn-icon', compact && 'h-8 w-8')} title="پیوست فایل" onClick={() => fileRef.current?.click()} disabled={disabled}>
        <Paperclip className="h-5 w-5" />
      </button>
      <button type="button" className={clsx('btn-icon', compact && 'h-8 w-8')} title="ارسال تصویر" onClick={() => imgRef.current?.click()} disabled={disabled}>
        <ImagePlus className="h-5 w-5" />
      </button>
      <button type="button" className={clsx('btn-icon', compact && 'h-8 w-8')} title="ارسال ویدیو" onClick={() => vidRef.current?.click()} disabled={disabled}>
        <Video className="h-5 w-5" />
      </button>
    </>
  );
}

export function DropOverlay({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-brand bg-brand/10 text-brand backdrop-blur-[1px]">
      <span className="flex items-center gap-2 text-sm font-semibold">
        <Paperclip className="h-5 w-5" /> فایل‌ها را اینجا رها کنید
      </span>
    </div>
  );
}
