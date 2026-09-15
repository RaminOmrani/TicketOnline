import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { Send, Mic, StickyNote, MessageSquareText, ChevronDown, CheckCircle2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { faNum, formatBytes } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { useConfig } from '@/store/config';
import { getSocket } from '@/lib/socket';
import { useAttachments } from './useAttachments';
import { AttachButtons, DropOverlay, PendingList } from './AttachmentPicker';
import { VoiceRecorder } from './VoiceRecorder';
import { Dropdown, MenuItem, Spinner } from '@/components/ui';
import type { CannedResponse, Ticket } from '@/lib/types';

interface Props {
  ticket: Ticket;
  onSent: () => void;
}

function CannedPicker({ ticket, onPick }: { ticket: Ticket; onPick: (body: string) => void }) {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const { data } = useQuery({ queryKey: ['canned'], queryFn: () => api.get<{ items: CannedResponse[] }>('/canned') });
  const fill = (body: string) =>
    body
      .replace(/\{\{customer_name\}\}/g, ticket.customer?.name || '')
      .replace(/\{\{ticket_number\}\}/g, ticket.number)
      .replace(/\{\{agent_name\}\}/g, user?.name || '')
      .replace(/\{\{subject\}\}/g, ticket.subject);
  const items = (data?.items || []).filter((c) => (!c.department_id || c.department_id === ticket.department.id) && (!q || c.title.includes(q) || c.body.includes(q) || (c.shortcut || '').includes(q)));
  return (
    <Dropdown
      width="w-80"
      align="start"
      trigger={
        <button type="button" className="btn-icon" title="پاسخ‌های آماده">
          <MessageSquareText className="h-5 w-5" />
        </button>
      }
    >
      {(close) => (
        <div>
          <div className="relative mb-1">
            <Search className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input autoFocus className="input py-1.5 pr-8 text-xs" placeholder="جستجوی پاسخ آماده…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {!items.length && <div className="px-3 py-6 text-center text-xs text-slate-400">پاسخ آماده‌ای یافت نشد.</div>}
            {items.map((c) => (
              <button key={c.id} type="button" className="block w-full rounded-lg px-3 py-2 text-start hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => { onPick(fill(c.body)); close(); }}>
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{c.title}</span>
                  {c.shortcut && <code className="rounded bg-slate-100 px-1 text-[10px] text-slate-500 dark:bg-slate-700">/{c.shortcut}</code>}
                </span>
                <span className="mt-0.5 line-clamp-2 text-xs text-slate-500">{c.body}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Dropdown>
  );
}

export function Composer({ ticket, onSent }: Props) {
  const { user, isStaff } = useAuth();
  const { settings } = useConfig();
  const att = useAttachments();
  const [body, setBody] = useState('');
  const [note, setNote] = useState(false);
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [drag, setDrag] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const typingRef = useRef(0);
  const draftKey = `draft-${ticket.id}`;

  useEffect(() => {
    try {
      const d = localStorage.getItem(draftKey);
      if (d) setBody(d);
    } catch {}
  }, [draftKey]);
  useEffect(() => {
    try {
      body ? localStorage.setItem(draftKey, body) : localStorage.removeItem(draftKey);
    } catch {}
  }, [body, draftKey]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(260, ta.scrollHeight) + 'px';
  }, [body]);

  // Customers cannot write into a closed ticket (it is final); staff still can.
  const disabled = !isStaff && ticket.status === 'closed';
  void settings;

  const send = async (statusAfter?: 'resolved' | 'in_progress') => {
    const text = body.trim();
    if (!text && !att.hasAny) return toast.error('متن پیام یا پیوست را وارد کنید.');
    setSending(true);
    setProgress(0);
    try {
      const form = new FormData();
      form.append('body', text);
      if (note) form.append('type', 'note');
      att.appendTo(form);
      await api.upload(`/tickets/${ticket.id}/messages`, form, setProgress);
      if (statusAfter && isStaff) await api.patch(`/tickets/${ticket.id}`, { status: statusAfter });
      setBody('');
      att.clear();
      setNote(false);
      try {
        localStorage.removeItem(draftKey);
      } catch {}
      onSent();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      send();
    }
  };
  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value);
    const now = Date.now();
    if (now - typingRef.current > 2500) {
      typingRef.current = now;
      try {
        getSocket().emit('typing', { ticket_id: ticket.id, name: user?.name });
      } catch {}
    }
  };
  const onPaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files || []);
    if (files.length) {
      e.preventDefault();
      att.addFiles(files);
    }
  };

  if (disabled) {
    return <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700">این تیکت بسته شده است و امکان ارسال پیام ندارد. لطفاً تیکت جدیدی ثبت کنید.</div>;
  }

  return (
    <div
      className={clsx('relative rounded-2xl border bg-white shadow-card transition dark:bg-slate-900', note ? 'border-amber-300 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-500/5' : 'border-slate-200 dark:border-slate-800', drag && 'ring-4 ring-brand/20')}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) att.addFiles(e.dataTransfer.files); }}
    >
      <DropOverlay active={drag} />
      {note && <div className="flex items-center gap-2 border-b border-amber-200 px-4 py-1.5 text-xs font-medium text-amber-700 dark:border-amber-500/30 dark:text-amber-300"><StickyNote className="h-3.5 w-3.5" /> یادداشت داخلی — فقط کارشناسان این پیام را می‌بینند.</div>}
      <textarea
        ref={taRef}
        value={body}
        onChange={onChange}
        onKeyDown={onKey}
        onPaste={onPaste}
        rows={3}
        placeholder={note ? 'یادداشت داخلی برای همکاران…' : isStaff ? 'پاسخ خود را بنویسید… (Ctrl+Enter برای ارسال)' : 'پیام خود را بنویسید… می‌توانید فایل، تصویر، ویدیو یا پیام صوتی هم ارسال کنید.'}
        className="block w-full resize-none bg-transparent px-4 pt-3 text-sm leading-7 outline-none placeholder:text-slate-400"
        dir="auto"
        disabled={sending}
      />
      {(att.files.length > 0 || att.voice) && (
        <div className="px-4 pb-2">
          <PendingList files={att.files} voice={att.voice} onRemove={att.remove} onRemoveVoice={() => att.setVoice(null)} />
          <div className="mt-1 text-[11px] text-slate-400">مجموع: {formatBytes(att.totalSize)}</div>
        </div>
      )}
      {recording && (
        <div className="px-3 pb-2">
          <VoiceRecorder onDone={(clip) => { att.setVoice(clip); setRecording(false); }} onCancel={() => setRecording(false)} />
        </div>
      )}
      {sending && progress > 0 && progress < 100 && (
        <div className="px-4 pb-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-slate-400">در حال ارسال… {faNum(progress)}٪</div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1 border-t border-slate-100 px-2 py-1.5 dark:border-slate-800">
        <AttachButtons onFiles={att.addFiles} disabled={sending} />
        <button type="button" className={clsx('btn-icon', recording && 'bg-rose-100 text-rose-600')} title="ضبط پیام صوتی" onClick={() => setRecording((r) => !r)} disabled={sending || !!att.voice}>
          <Mic className="h-5 w-5" />
        </button>
        {isStaff && (
          <>
            <CannedPicker ticket={ticket} onPick={(t) => setBody((b) => (b ? b + '\n' + t : t))} />
            <button type="button" className={clsx('btn-icon', note && 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300')} title="یادداشت داخلی" onClick={() => setNote((n) => !n)}>
              <StickyNote className="h-5 w-5" />
            </button>
          </>
        )}
        <div className="flex-1" />
        <span className="hidden text-[11px] text-slate-400 sm:block">Ctrl + Enter</span>
        {isStaff && !note ? (
          <div className="flex h-10 items-stretch">
            <button type="button" className="btn-primary h-10 rounded-l-none py-0" onClick={() => send()} disabled={sending}>
              {sending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4 -scale-x-100" />}
              ارسال پاسخ
            </button>
            <Dropdown
              width="w-56"
              trigger={
                <button type="button" className="btn-primary h-10 rounded-r-none border-r border-white/20 px-2 py-0" disabled={sending} aria-label="گزینه‌های ارسال">
                  <ChevronDown className="h-4 w-4" />
                </button>
              }
            >
              {(close) => (
                <>
                  <MenuItem icon={<CheckCircle2 />} onClick={() => { close(); send('resolved'); }}>ارسال و علامت «حل شده»</MenuItem>
                  <MenuItem icon={<Send />} onClick={() => { close(); send('in_progress'); }}>ارسال و «در حال بررسی»</MenuItem>
                </>
              )}
            </Dropdown>
          </div>
        ) : (
          <button type="button" className={clsx('h-10 py-0', note ? 'btn bg-amber-500 text-white hover:bg-amber-600' : 'btn-primary')} onClick={() => send()} disabled={sending}>
            {sending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4 -scale-x-100" />}
            {note ? 'ثبت یادداشت' : 'ارسال'}
          </button>
        )}
      </div>
    </div>
  );
}
