import { useState } from 'react';
import clsx from 'clsx';
import { Check, CheckCheck, StickyNote, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import { formatTime, linkify, formatDateTime } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { Attachments } from './AttachmentView';
import { Avatar, Dropdown, MenuItem } from '@/components/ui';
import type { Message } from '@/lib/types';

export function MessageBubble({ m, onEdit, onDelete }: { m: Message; onEdit?: (m: Message) => void; onDelete?: (m: Message) => void }) {
  const { user, isStaff } = useAuth();
  const mine = m.sender?.id === user?.id;
  const fromStaff = m.sender?.role === 'agent' || m.sender?.role === 'admin';
  const isNote = m.type === 'note';
  // Layout: for customers, agent messages on the left; for staff, customer messages on the left.
  const alignEnd = mine || (isStaff && fromStaff);
  const read = fromStaff ? m.read_by_customer_at : m.read_by_agent_at;
  const canEdit = !m.deleted && mine && !!m.body && (isStaff || Date.now() - Date.parse(m.created_at) < 15 * 60_000);
  const canDelete = !m.deleted && (mine || user?.role === 'admin');

  return (
    <div className={clsx('flex items-end gap-2 animate-fade-in', alignEnd ? 'flex-row' : 'flex-row-reverse')} dir="rtl">
      <Avatar user={m.sender} size="sm" className="mb-5 hidden sm:inline-flex" />
      <div className={clsx('group relative max-w-[88%] sm:max-w-[75%]', alignEnd ? 'items-end' : 'items-start')}>
        <div className={clsx('mb-1 flex items-center gap-2 text-[11px] text-slate-400', alignEnd ? 'justify-end' : 'justify-start')}>
          <span className="font-medium text-slate-600 dark:text-slate-300">{m.sender?.name || 'سیستم'}</span>
          {fromStaff && <span className="rounded bg-brand/10 px-1 text-[10px] text-brand">{m.sender?.title || 'کارشناس'}</span>}
          {isNote && <span className="flex items-center gap-0.5 rounded bg-amber-100 px-1 text-[10px] text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"><StickyNote className="h-3 w-3" /> یادداشت داخلی</span>}
        </div>
        <div
          className={clsx(
            'relative rounded-2xl px-4 py-2.5 shadow-sm',
            isNote
              ? 'border border-amber-200 bg-amber-50 text-slate-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-50'
              : alignEnd
                ? 'msg-mine bg-brand text-white rounded-br-md'
                : 'border border-slate-200 bg-white text-slate-800 rounded-bl-md dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
          )}
        >
          {m.deleted ? (
            <span className="text-sm italic opacity-70">این پیام حذف شده است.</span>
          ) : (
            <>
              {m.body && <div className="message-body whitespace-pre-wrap break-words text-[14.5px] leading-7" dir="auto" dangerouslySetInnerHTML={{ __html: linkify(m.body) }} />}
              <Attachments items={m.attachments} onDark={alignEnd && !isNote} />
            </>
          )}
          {(canEdit || canDelete) && !m.deleted && (
            <div className={clsx('absolute -top-3 opacity-0 transition group-hover:opacity-100', alignEnd ? 'left-2' : 'right-2')}>
              <Dropdown
                width="w-40"
                trigger={
                  <button className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                }
              >
                {(close) => (
                  <>
                    {canEdit && <MenuItem icon={<Pencil />} onClick={() => { close(); onEdit?.(m); }}>ویرایش</MenuItem>}
                    {canDelete && <MenuItem icon={<Trash2 />} danger onClick={() => { close(); onDelete?.(m); }}>حذف</MenuItem>}
                  </>
                )}
              </Dropdown>
            </div>
          )}
        </div>
        <div className={clsx('mt-1 flex items-center gap-1.5 text-[11px] text-slate-400', alignEnd ? 'justify-end' : 'justify-start')} title={formatDateTime(m.created_at)}>
          <span>{formatTime(m.created_at)}</span>
          {m.edited_at && <span>• ویرایش‌شده</span>}
          {mine && !isNote && (read ? <CheckCheck className="h-3.5 w-3.5 text-brand" /> : <Check className="h-3.5 w-3.5" />)}
        </div>
      </div>
    </div>
  );
}

export function EditMessageBox({ initial, onSave, onCancel }: { initial: string; onSave: (body: string) => Promise<void>; onCancel: () => void }) {
  const [v, setV] = useState(initial);
  const [saving, setSaving] = useState(false);
  return (
    <div className="card p-3">
      <textarea className="input min-h-[100px]" value={v} onChange={(e) => setV(e.target.value)} dir="auto" autoFocus />
      <div className="mt-2 flex justify-end gap-2">
        <button className="btn-secondary btn-sm" onClick={onCancel}>انصراف</button>
        <button className="btn-primary btn-sm" disabled={saving || !v.trim()} onClick={async () => { setSaving(true); try { await onSave(v.trim()); } finally { setSaving(false); } }}>ذخیره</button>
      </div>
    </div>
  );
}
