import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ScrollText, PlusCircle, Pencil, Trash2, Eye, EyeOff, ImagePlus, X, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { faNum, renderMarkdown, timeAgo } from '@/lib/format';
import { useConfig } from '@/store/config';
import { ConfirmDialog, EmptyState, Field, Modal, Spinner, Tabs, Toggle } from '@/components/ui';
import { RichEditor } from '@/components/RichEditor';
import type { KbArticle } from '@/lib/types';

type Form = { id?: number; title: string; slug: string; summary: string; body: string; category: string; department_id: number | null; is_published: boolean; is_faq: boolean; cover_image: string | null };
const empty: Form = { title: '', slug: '', summary: '', body: '', category: '', department_id: null, is_published: true, is_faq: false, cover_image: null };

async function uploadImage(f: File): Promise<string> {
  const form = new FormData();
  form.append('image', f);
  const r = await api.upload<{ url: string }>('/kb/upload', form);
  return r.url;
}

export default function AdminKb() {
  const qc = useQueryClient();
  const { departments, companies } = useConfig();
  const [params] = useSearchParams();
  const [edit, setEdit] = useState<Form | null>(null);
  const [del, setDel] = useState<KbArticle | null>(null);
  const [saving, setSaving] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const coverRef = useRef<HTMLInputElement>(null);
  const { data } = useQuery({ queryKey: ['kb-admin'], queryFn: () => api.get<{ items: KbArticle[]; categories: { category: string }[] }>('/kb') });

  useEffect(() => {
    const id = params.get('edit');
    if (id) api.get(`/kb/${id}`, { count: 0 }).then((r) => openEdit(r.article)).catch(() => {});
  }, []);

  const openEdit = (a: KbArticle) => {
    setTab('edit');
    // Legacy markdown articles are converted to HTML once they are edited in the new editor.
    const body = a.body_format === 'html' ? a.body : renderMarkdown(a.body);
    setEdit({ id: a.id, title: a.title, slug: a.slug, summary: a.summary || '', body, category: a.category || '', department_id: a.department_id || null, is_published: !!a.is_published, is_faq: !!a.is_faq, cover_image: a.cover_image || null });
  };

  const save = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      const { id, ...payload } = edit;
      const body = { ...payload, body_format: 'html' as const, slug: payload.slug || undefined };
      if (id) await api.patch(`/kb/${id}`, body);
      else await api.post('/kb', body);
      qc.invalidateQueries({ queryKey: ['kb-admin'] });
      qc.invalidateQueries({ queryKey: ['kb'] });
      qc.invalidateQueries({ queryKey: ['kb-article'] });
      setEdit(null);
      toast.success('ذخیره شد');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const uploadCover = async (f: File) => {
    if (!edit) return;
    setCoverUploading(true);
    try {
      const url = await uploadImage(f);
      setEdit((s) => (s ? { ...s, cover_image: url } : s));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCoverUploading(false);
    }
  };

  const textOnly = (html: string) => html.replace(/<[^>]+>/g, '').trim();

  return (
    <div className="mx-auto max-w-5xl">
      <input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadCover(f); }} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div><h1 className="flex items-center gap-2 text-xl font-extrabold"><ScrollText className="h-5 w-5 text-brand" /> مدیریت مقالات راهنما</h1><p className="text-xs text-slate-500">پایگاه دانش و سوالات متداول — با ویرایشگر متنی شبیه Word، تصویر شاخص و تصاویر داخل متن.</p></div>
        <button className="btn-primary mr-auto" onClick={() => { setTab('edit'); setEdit({ ...empty }); }}><PlusCircle className="h-4 w-4" /> مقاله جدید</button>
      </div>
      {!data?.items.length ? (
        <div className="card"><EmptyState icon={<ScrollText />} title="مقاله‌ای وجود ندارد" /></div>
      ) : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {data.items.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3">
              {a.cover_image ? <img src={a.cover_image} alt="" className="h-10 w-14 shrink-0 rounded-lg object-cover" /> : <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-300 dark:bg-slate-800"><ImagePlus className="h-4 w-4" /></span>}
              <span className={a.is_published ? 'text-emerald-500' : 'text-slate-300'} title={a.is_published ? 'منتشر شده' : 'پیش‌نویس'}>{a.is_published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 truncate font-semibold">{a.title}{!!a.is_faq && <span className="chip bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><HelpCircle className="h-3 w-3" /> متداول</span>}</div>
                <div className="text-[11px] text-slate-400">{a.category || 'بدون دسته'} • {faNum(a.views)} بازدید • {timeAgo(a.updated_at)} • <span className="ltr">/kb/{a.slug}</span></div>
              </div>
              <button className="btn-icon h-8 w-8" onClick={() => api.get(`/kb/${a.id}`, { count: 0 }).then((r) => openEdit(r.article))}><Pencil className="h-4 w-4" /></button>
              <button className="btn-icon h-8 w-8 text-rose-500" onClick={() => setDel(a)}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'ویرایش مقاله' : 'مقاله جدید'} size="xl" footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>انصراف</button><button className="btn-primary" onClick={save} disabled={saving || !edit?.title || !edit || !textOnly(edit.body)}>{saving && <Spinner className="h-4 w-4" />} ذخیره</button></>}>
        {edit && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="عنوان" required><input className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
              <Field label="نامک (slug)" hint="خالی = ساخت خودکار"><input className="input ltr" value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} dir="ltr" /></Field>
              <Field label="دسته‌بندی"><input className="input" list="kb-cats" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /><datalist id="kb-cats">{data?.categories.map((c) => <option key={c.category} value={c.category} />)}</datalist></Field>
              <Field label="بخش مرتبط" hint="در صفحه ثبت تیکت، مقالات همان بخش پیشنهاد می‌شود.">
                <select className="input" value={edit.department_id || ''} onChange={(e) => setEdit({ ...edit, department_id: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">— همه بخش‌ها —</option>
                  {companies.map((c) => (
                    <optgroup key={c.id} label={c.name}>
                      {departments.filter((d) => d.company_id === c.id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="خلاصه" hint="در فهرست مقالات و نتایج جستجو نمایش داده می‌شود."><input className="input" value={edit.summary} onChange={(e) => setEdit({ ...edit, summary: e.target.value })} /></Field>

            <Field label="تصویر شاخص" hint="بالای مقاله و در فهرست مقالات نمایش داده می‌شود (اختیاری).">
              <div className="flex items-center gap-3">
                <div className="flex h-24 w-40 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                  {edit.cover_image ? <img src={edit.cover_image} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-6 w-6 text-slate-300" />}
                </div>
                <div className="flex flex-col gap-2">
                  <button type="button" className="btn-secondary btn-sm" onClick={() => coverRef.current?.click()} disabled={coverUploading}>{coverUploading ? <Spinner className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />} {edit.cover_image ? 'تغییر تصویر' : 'انتخاب تصویر'}</button>
                  {edit.cover_image && <button type="button" className="btn-ghost btn-sm text-rose-600" onClick={() => setEdit({ ...edit, cover_image: null })}><X className="h-4 w-4" /> حذف تصویر</button>}
                </div>
              </div>
            </Field>

            <div>
              <div className="mb-2 flex items-center justify-between"><label className="label mb-0">متن مقاله <span className="text-rose-500">*</span></label><Tabs value={tab} onChange={setTab} items={[{ value: 'edit', label: 'ویرایش' }, { value: 'preview', label: 'پیش‌نمایش' }]} /></div>
              {tab === 'edit' ? (
                <RichEditor value={edit.body} onChange={(html) => setEdit((s) => (s ? { ...s, body: html } : s))} onUploadImage={uploadImage} />
              ) : (
                <div className="prose-fa min-h-[320px] rounded-xl border border-slate-200 p-4 dark:border-slate-700" dangerouslySetInnerHTML={{ __html: edit.body }} />
              )}
            </div>
            <Toggle checked={edit.is_faq} onChange={(v) => setEdit({ ...edit, is_faq: v })} label="سوال متداول" description="در صفحه ثبت تیکت، قبل از انتخاب بخش به مشتری نمایش داده می‌شود." />
            <Toggle checked={edit.is_published} onChange={(v) => setEdit({ ...edit, is_published: v })} label="منتشر شده" description="مقاله پیش‌نویس فقط برای کارشناسان قابل مشاهده است." />
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger title="حذف مقاله" message={`«${del?.title}» حذف شود؟`} confirmText="حذف" onConfirm={async () => { await api.del(`/kb/${del!.id}`); qc.invalidateQueries({ queryKey: ['kb-admin'] }); qc.invalidateQueries({ queryKey: ['kb'] }); setDel(null); }} />
    </div>
  );
}
