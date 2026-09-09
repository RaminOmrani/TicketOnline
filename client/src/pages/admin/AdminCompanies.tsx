import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Building, PlusCircle, Pencil, Trash2, Upload, X, Plus, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { faNum } from '@/lib/format';
import { useConfig } from '@/store/config';
import { ConfirmDialog, Field, Modal, Spinner, Toggle } from '@/components/ui';
import { LogoMark } from '@/components/Logo';
import { BusinessHoursEditor, DEFAULT_HOURS } from '@/components/BusinessHoursEditor';
import type { BusinessHours, Company } from '@/lib/types';

type Form = { id?: number; name: string; name_en: string; slug: string; description: string; color: string; is_active: boolean; sort_order: number; ticket_prefix: string; support_email: string; support_phone: string; website: string; business_hours: BusinessHours; products: string[] };
const empty: Form = { name: '', name_en: '', slug: '', description: '', color: '#8B0000', is_active: true, sort_order: 0, ticket_prefix: 'TKT', support_email: '', support_phone: '', website: '', business_hours: DEFAULT_HOURS, products: [] };

export default function AdminCompanies() {
  const qc = useQueryClient();
  const { reload } = useConfig();
  const [edit, setEdit] = useState<Form | null>(null);
  const [del, setDel] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);
  const [newProduct, setNewProduct] = useState('');
  const logoRef = useRef<HTMLInputElement>(null);
  const [logoFor, setLogoFor] = useState<number | null>(null);
  const { data } = useQuery({ queryKey: ['companies'], queryFn: () => api.get<{ items: Company[] }>('/companies') });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['companies'] });
    qc.invalidateQueries({ queryKey: ['admin-departments'] });
    reload();
  };

  const save = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      const { id, ...payload } = edit;
      if (id) await api.patch(`/companies/${id}`, payload);
      else await api.post('/companies', payload);
      refresh();
      setEdit(null);
      toast.success('ذخیره شد');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (id: number, f: File) => {
    try {
      const form = new FormData();
      form.append('logo', f);
      await api.upload(`/companies/${id}/logo`, form);
      refresh();
      toast.success('لوگو به‌روز شد');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden onChange={(e) => { if (e.target.files?.[0] && logoFor) uploadLogo(logoFor, e.target.files[0]); e.target.value = ''; }} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div><h1 className="flex items-center gap-2 text-xl font-extrabold"><Building className="h-5 w-5 text-brand" /> شرکت‌ها و برندها</h1><p className="text-xs text-slate-500">هر شرکت بخش‌ها، محصولات، ساعت کاری، پیشوند تیکت و گزارش مستقل دارد.</p></div>
        <button className="btn-primary mr-auto" onClick={() => setEdit({ ...empty, sort_order: (data?.items.length || 0) + 1 })}><PlusCircle className="h-4 w-4" /> شرکت جدید</button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {data?.items.map((c) => (
          <div key={c.id} className={clsx('card p-4', !c.is_active && 'opacity-60')}>
            <div className="flex items-start gap-3">
              <button className="flex h-16 w-24 shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800" title="تغییر لوگو" onClick={() => { setLogoFor(c.id); logoRef.current?.click(); }}>
                {c.logo ? <img src={c.logo} alt="" className="max-h-full max-w-full object-contain" /> : <LogoMark className="h-10 w-10" color="rgb(var(--brand-rgb))" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold">{c.name}</h3>
                  {c.name_en && <span className="text-xs text-slate-400" dir="ltr">{c.name_en}</span>}
                  <span className="chip bg-slate-100 font-mono text-[10px] dark:bg-slate-800" dir="ltr">{c.ticket_prefix}-</span>
                  {!c.is_active && <span className="chip bg-slate-100 text-slate-500">غیرفعال</span>}
                </div>
                {c.description && <p className="mt-0.5 text-xs text-slate-500">{c.description}</p>}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                  <span>{faNum(c.departments?.length || 0)} بخش</span>
                  <span>{faNum((c.products as any[])?.length || 0)} محصول</span>
                  <span>{faNum(c.open_tickets || 0)} تیکت باز از {faNum(c.ticket_count || 0)}</span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500"><Clock className="h-3 w-3" /> {c.business_hours_text || 'بدون ساعت کاری (زمان تقویمی)'}</div>
              </div>
              <div className="flex gap-1">
                <button className="btn-icon h-8 w-8" title="بارگذاری لوگو" onClick={() => { setLogoFor(c.id); logoRef.current?.click(); }}><Upload className="h-4 w-4" /></button>
                <button className="btn-icon h-8 w-8" onClick={() => setEdit({ id: c.id, name: c.name, name_en: c.name_en || '', slug: c.slug, description: c.description || '', color: c.color || '#8B0000', is_active: !!c.is_active, sort_order: c.sort_order || 0, ticket_prefix: c.ticket_prefix || 'TKT', support_email: c.support_email || '', support_phone: c.support_phone || '', website: c.website || '', business_hours: c.business_hours || DEFAULT_HOURS, products: ((c.products as any[]) || []).map((p: any) => (typeof p === 'string' ? p : p.name)) })}><Pencil className="h-4 w-4" /></button>
                <button className="btn-icon h-8 w-8 text-rose-500" onClick={() => setDel(c)}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'ویرایش شرکت' : 'شرکت جدید'} size="xl" footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>انصراف</button><button className="btn-primary" onClick={save} disabled={saving || !edit?.name}>{saving && <Spinner className="h-4 w-4" />} ذخیره</button></>}>
        {edit && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="نام شرکت / برند" required><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="نام انگلیسی"><input className="input ltr" value={edit.name_en} onChange={(e) => setEdit({ ...edit, name_en: e.target.value })} dir="ltr" /></Field>
              <Field label="پیشوند شماره تیکت" hint="مثلاً MLN، SHM"><input className="input ltr" value={edit.ticket_prefix} onChange={(e) => setEdit({ ...edit, ticket_prefix: e.target.value.toUpperCase() })} dir="ltr" maxLength={6} /></Field>
            </div>
            <Field label="توضیح کوتاه" hint="به مشتری در انتخاب شرکت کمک می‌کند."><input className="input" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="ایمیل پشتیبانی"><input className="input ltr" value={edit.support_email} onChange={(e) => setEdit({ ...edit, support_email: e.target.value })} dir="ltr" /></Field>
              <Field label="تلفن پشتیبانی"><input className="input ltr" value={edit.support_phone} onChange={(e) => setEdit({ ...edit, support_phone: e.target.value })} dir="ltr" /></Field>
              <Field label="وب‌سایت"><input className="input ltr" value={edit.website} onChange={(e) => setEdit({ ...edit, website: e.target.value })} dir="ltr" /></Field>
            </div>
            <Field label="محصولات / خدمات" hint="هنگام ثبت تیکت به مشتری نمایش داده می‌شود.">
              <div className="flex flex-wrap gap-1.5">
                {edit.products.map((p) => <span key={p} className="chip bg-slate-100 dark:bg-slate-800">{p}<button type="button" onClick={() => setEdit({ ...edit, products: edit.products.filter((x) => x !== p) })} className="hover:text-rose-600"><X className="h-3 w-3" /></button></span>)}
              </div>
              <div className="mt-2 flex gap-1"><input className="input" placeholder="محصول جدید…" value={newProduct} onChange={(e) => setNewProduct(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (newProduct.trim() && !edit.products.includes(newProduct.trim())) setEdit({ ...edit, products: [...edit.products, newProduct.trim()] }); setNewProduct(''); } }} /><button type="button" className="btn-secondary" onClick={() => { if (newProduct.trim() && !edit.products.includes(newProduct.trim())) setEdit({ ...edit, products: [...edit.products, newProduct.trim()] }); setNewProduct(''); }}><Plus className="h-4 w-4" /></button></div>
            </Field>
            <Field label="ساعات کاری (برای محاسبه مهلت پاسخ‌گویی)" hint="مهلت SLA فقط در این ساعات جلو می‌رود. هر بخش می‌تواند ساعت کاری خودش را داشته باشد.">
              <BusinessHoursEditor value={edit.business_hours} onChange={(v) => setEdit({ ...edit, business_hours: v })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="ترتیب نمایش"><input className="input ltr" type="number" value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })} /></Field>
              <Field label="نامک (slug)"><input className="input ltr" value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} dir="ltr" placeholder="خودکار" /></Field>
            </div>
            <Toggle checked={edit.is_active} onChange={(v) => setEdit({ ...edit, is_active: v })} label="فعال" description="شرکت غیرفعال هنگام ثبت تیکت نمایش داده نمی‌شود." />
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger title="حذف شرکت" message={`«${del?.name}» حذف شود؟ بخش‌ها و محصولات آن هم حذف می‌شوند. اگر تیکتی دارد، حذف ممکن نیست.`} confirmText="حذف" onConfirm={async () => { try { await api.del(`/companies/${del!.id}`); refresh(); toast.success('حذف شد'); } catch (e: any) { toast.error(e.message); } setDel(null); }} />
    </div>
  );
}
