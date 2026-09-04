import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useConfig } from '@/store/config';
import type { VoiceClip } from './VoiceRecorder';

export interface PendingFile {
  id: string;
  file: File;
  kind: 'image' | 'video' | 'audio' | 'file';
  preview?: string;
  duration?: number;
}

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'svg', 'avif'];
const VIDEO_EXT = ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v', '3gp'];
const AUDIO_EXT = ['mp3', 'm4a', 'ogg', 'oga', 'wav', 'aac', 'opus'];

function kindOf(file: File): PendingFile['kind'] {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (file.type.startsWith('image/') || IMAGE_EXT.includes(ext)) return 'image';
  if (file.type.startsWith('video/') || VIDEO_EXT.includes(ext)) return 'video';
  if (file.type.startsWith('audio/') || AUDIO_EXT.includes(ext)) return 'audio';
  return 'file';
}

function mediaDuration(file: File, kind: string): Promise<number | undefined> {
  if (kind !== 'audio' && kind !== 'video') return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const el = document.createElement(kind === 'audio' ? 'audio' : 'video');
    const url = URL.createObjectURL(file);
    const done = (v?: number) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    el.preload = 'metadata';
    el.onloadedmetadata = () => done(isFinite(el.duration) ? el.duration : undefined);
    el.onerror = () => done(undefined);
    el.src = url;
    setTimeout(() => done(undefined), 4000);
  });
}

export function useAttachments() {
  const { settings } = useConfig();
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [voice, setVoice] = useState<VoiceClip | null>(null);
  const filesRef = useRef(files);
  filesRef.current = files;

  const allowed = useMemo(() => new Set(settings.allowed_extensions.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)), [settings.allowed_extensions]);

  const addFiles = useCallback(
    async (list: FileList | File[]) => {
      const incoming = Array.from(list);
      const accepted: PendingFile[] = [];
      for (const f of incoming) {
        const ext = f.name.split('.').pop()?.toLowerCase() || '';
        if (allowed.size && !allowed.has(ext)) {
          toast.error(`فرمت «${ext || f.name}» مجاز نیست.`);
          continue;
        }
        if (f.size > settings.max_upload_mb * 1024 * 1024) {
          toast.error(`حجم «${f.name}» بیشتر از ${settings.max_upload_mb} مگابایت است.`);
          continue;
        }
        if (filesRef.current.length + accepted.length >= settings.max_attachments) {
          toast.error(`حداکثر ${settings.max_attachments} فایل در هر پیام مجاز است.`);
          break;
        }
        if (filesRef.current.some((p) => p.file.name === f.name && p.file.size === f.size)) continue;
        const kind = kindOf(f);
        const duration = await mediaDuration(f, kind);
        accepted.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file: f, kind, preview: kind === 'image' ? URL.createObjectURL(f) : undefined, duration });
      }
      if (accepted.length) setFiles((prev) => [...prev, ...accepted]);
    },
    [allowed, settings.max_attachments, settings.max_upload_mb]
  );

  const remove = useCallback((id: string) => {
    setFiles((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item?.preview) URL.revokeObjectURL(item.preview);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    filesRef.current.forEach((p) => p.preview && URL.revokeObjectURL(p.preview));
    setFiles([]);
    if (voice?.url) URL.revokeObjectURL(voice.url);
    setVoice(null);
  }, [voice]);

  useEffect(() => () => filesRef.current.forEach((p) => p.preview && URL.revokeObjectURL(p.preview)), []);

  const appendTo = useCallback(
    (form: FormData) => {
      const meta: Record<string, { duration?: number }> = {};
      for (const p of files) {
        form.append('attachments', p.file, p.file.name);
        if (p.duration) meta[p.file.name] = { duration: p.duration };
      }
      if (voice) {
        const name = `voice-${Date.now()}.${voice.ext}`;
        form.append('voice', voice.blob, name);
        meta[name] = { duration: voice.duration };
      }
      form.append('meta', JSON.stringify(meta));
    },
    [files, voice]
  );

  return { files, voice, setVoice, addFiles, remove, clear, appendTo, hasAny: files.length > 0 || !!voice, totalSize: files.reduce((a, f) => a + f.file.size, 0) + (voice?.blob.size || 0) };
}
