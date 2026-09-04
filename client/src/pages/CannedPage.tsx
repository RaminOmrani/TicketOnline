import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquareText, PlusCircle, Pencil, Trash2, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useConfig } from '@/store/config';
import { ConfirmDialog, EmptyState, Field, Modal, SearchInput, Spinner } from '@/components/ui';
import type { CannedResponse } from '@/lib/types';

const empty = { title: '', shortcut: '', body: '', department_id: null as number | null };

export default function CannedPage() {
  const qc = useQueryClient();
  const { departments } = useConfig();
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<(typeof empty & { id?: number }) | null>(null);
  const [del, setDel] = useState<CannedResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const { data } = useQuery({ queryKey: ['canned'], queryFn: () => api.get<{ items: CannedResponse[] }>('/canned') });
  const items = (data?.items || []).filter((c) => !q || c.title.includes(q) || c.body.includes(q));

  const save = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      const payload = { title: edit.title, shortcut: edit.shortcut || null, body: edit.body, department_id: edit.department_id || null };
      if (edit.id) await api.patch(`/canned/${edit.id}`, payload);
      else await api.post('/canned', payload);
      qc.invalidateQueries({ queryKey: ['canned'] });
      setEdit(null);
      toast.success('ذخیره شد');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div><h1 className="flex items-center gap-2 text-xl font-extrabold"><MessageSquareText className="h-5 w-5 text-brand" /> پاسخ‌های آماده</h1><p className="text-xs text-slate-500">متغیرها: {'{{customer_name}}'}، {'{{ticket_number}}'}، {'{{agent_name}}'}، {'{{subject}}'}</p></div>
        <div className="mr-auto flex items-center gap-2">
          <SearchInput value={q} onChange={setQ} className="w-56" />
          <button className="btn-primary" onClick={() => setEdit({ ...empty })}><PlusCircle className="h-4 w-4" /> پاسخ جدید</button>
        </div>
      </div>
      {!items.length ? (
        <div className="card"><EmptyState icon={<MessageSquareText />} title="پاسخ آماده‌ای وجود ندارد" action={<button className="btn-primary" onClick={() => setEdit({ ...empty })}>ایجاد اولین پاسخ</button>} /></div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((c) => (
            <div key={c.id} className="card flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold">{c.title}</h3>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                    {c.shortcut && <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">/{c.shortcut}</code>}
                    <span>{c.department_name || 'همه بخش‌ها'}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button className="btn-icon h-8 w-8" title="کپی" onClick={() => navigator.clipboard.writeText(c.body).then(() => toast.success('کپی شد'))}><Copy className="h-4 w-4" /></button>
                  <button className="btn-icon h-8 w-8" onClick={() => setEdit({ id: c.id, title: c.title, shortcut: c.shortcut || '', body: c.body, department_id: c.department_id || null })}><Pencil className="h-4 w-4" /></button>
                  <button className="btn-icon h-8 w-8 text-rose-500" onClick={() => setDel(c)}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-600 dark:text-slate-300 line-clamp-5">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'ویرایش پاسخ آماده' : 'پاسخ آماده جدید'} size="lg" footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>انصراف</button><button className="btn-primary" onClick={save} disabled={saving || !edit?.title || !edit?.body}>{saving && <Spinner className="h-4 w-4" />} ذخیره</button></>}>
        {edit && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2"><Field label="عنوان" required><input className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field></div>
              <Field label="میانبر" hint="مثلاً hi"><input className="input ltr" value={edit.shortcut} onChange={(e) => setEdit({ ...edit, shortcut: e.target.value })} dir="ltr" /></Field>
            </div>
            <Field label="بخش">
              <select className="input" value={edit.department_id || ''} onChange={(e) => setEdit({ ...edit, department_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">همه بخش‌ها</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="متن پاسخ" required><textarea className="input min-h-[180px]" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} dir="auto" /></Field>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger title="حذف پاسخ آماده" message={`«${del?.title}» حذف شود؟`} confirmText="حذف" onConfirm={async () => { await api.del(`/canned/${del!.id}`); setDel(null); qc.invalidateQueries({ queryKey: ['canned'] }); }} />
    </div>
  );
}
