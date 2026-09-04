import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ScrollText, PlusCircle, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { faNum, renderMarkdown, timeAgo } from '@/lib/format';
import { useConfig } from '@/store/config';
import { ConfirmDialog, EmptyState, Field, Modal, Spinner, Tabs, Toggle } from '@/components/ui';
import type { KbArticle } from '@/lib/types';

type Form = { id?: number; title: string; slug: string; summary: string; body: string; category: string; department_id: number | null; is_published: boolean };
const empty: Form = { title: '', slug: '', summary: '', body: '', category: '', department_id: null, is_published: true };

export default function AdminKb() {
  const qc = useQueryClient();
  const { departments } = useConfig();
  const [params] = useSearchParams();
  const [edit, setEdit] = useState<Form | null>(null);
  const [del, setDel] = useState<KbArticle | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const { data } = useQuery({ queryKey: ['kb-admin'], queryFn: () => api.get<{ items: KbArticle[]; categories: { category: string }[] }>('/kb') });

  useEffect(() => {
    const id = params.get('edit');
    if (id) api.get(`/kb/${id}`).then((r) => openEdit(r.article)).catch(() => {});
  }, []);

  const openEdit = (a: KbArticle) => { setTab('edit'); setEdit({ id: a.id, title: a.title, slug: a.slug, summary: a.summary || '', body: a.body, category: a.category || '', department_id: a.department_id || null, is_published: !!a.is_published }); };

  const save = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      const { id, ...payload } = edit;
      if (id) await api.patch(`/kb/${id}`, { ...payload, slug: payload.slug || undefined });
      else await api.post('/kb', { ...payload, slug: payload.slug || undefined });
      qc.invalidateQueries({ queryKey: ['kb-admin'] });
      qc.invalidateQueries({ queryKey: ['kb'] });
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
        <div><h1 className="flex items-center gap-2 text-xl font-extrabold"><ScrollText className="h-5 w-5 text-brand" /> مدیریت مقالات راهنما</h1><p className="text-xs text-slate-500">پایگاه دانش برای پاسخ به سوالات پرتکرار — از Markdown ساده پشتیبانی می‌شود.</p></div>
        <button className="btn-primary mr-auto" onClick={() => { setTab('edit'); setEdit({ ...empty }); }}><PlusCircle className="h-4 w-4" /> مقاله جدید</button>
      </div>
      {!data?.items.length ? (
        <div className="card"><EmptyState icon={<ScrollText />} title="مقاله‌ای وجود ندارد" /></div>
      ) : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {data.items.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3">
              <span className={a.is_published ? 'text-emerald-500' : 'text-slate-300'}>{a.is_published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{a.title}</div>
                <div className="text-[11px] text-slate-400">{a.category || 'بدون دسته'} • {faNum(a.views)} بازدید • {timeAgo(a.updated_at)} • <span className="ltr">/kb/{a.slug}</span></div>
              </div>
              <button className="btn-icon h-8 w-8" onClick={() => api.get(`/kb/${a.id}`).then((r) => openEdit(r.article))}><Pencil className="h-4 w-4" /></button>
              <button className="btn-icon h-8 w-8 text-rose-500" onClick={() => setDel(a)}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'ویرایش مقاله' : 'مقاله جدید'} size="xl" footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>انصراف</button><button className="btn-primary" onClick={save} disabled={saving || !edit?.title || !edit?.body}>{saving && <Spinner className="h-4 w-4" />} ذخیره</button></>}>
        {edit && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="عنوان" required><input className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
              <Field label="نامک (slug)" hint="خالی = ساخت خودکار"><input className="input ltr" value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} dir="ltr" /></Field>
              <Field label="دسته‌بندی"><input className="input" list="kb-cats" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /><datalist id="kb-cats">{data?.categories.map((c) => <option key={c.category} value={c.category} />)}</datalist></Field>
              <Field label="بخش مرتبط"><select className="input" value={edit.department_id || ''} onChange={(e) => setEdit({ ...edit, department_id: e.target.value ? Number(e.target.value) : null })}><option value="">—</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
            </div>
            <Field label="خلاصه"><input className="input" value={edit.summary} onChange={(e) => setEdit({ ...edit, summary: e.target.value })} /></Field>
            <div>
              <div className="mb-2 flex items-center justify-between"><label className="label mb-0">متن مقاله <span className="text-rose-500">*</span></label><Tabs value={tab} onChange={setTab} items={[{ value: 'edit', label: 'ویرایش' }, { value: 'preview', label: 'پیش‌نمایش' }]} /></div>
              {tab === 'edit' ? <textarea className="input min-h-[320px] font-mono text-[13px] leading-7" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} dir="auto" placeholder={'## عنوان بخش\nمتن…\n- مورد اول\n- مورد دوم\n**پررنگ** و `کد`'} /> : <div className="prose-fa min-h-[320px] rounded-xl border border-slate-200 p-4 dark:border-slate-700" dangerouslySetInnerHTML={{ __html: renderMarkdown(edit.body) }} />}
            </div>
            <Toggle checked={edit.is_published} onChange={(v) => setEdit({ ...edit, is_published: v })} label="منتشر شده" description="مقاله پیش‌نویس فقط برای کارشناسان قابل مشاهده است." />
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger title="حذف مقاله" message={`«${del?.title}» حذف شود؟`} confirmText="حذف" onConfirm={async () => { await api.del(`/kb/${del!.id}`); qc.invalidateQueries({ queryKey: ['kb-admin'] }); qc.invalidateQueries({ queryKey: ['kb'] }); setDel(null); }} />
    </div>
  );
}
