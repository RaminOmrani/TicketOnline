import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Settings, Save, Upload, Trash2, Palette, FileUp, Mail, ShieldCheck, Ticket, X, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { faNum } from '@/lib/format';
import { useConfig } from '@/store/config';
import { Field, PageLoader, Spinner, Toggle } from '@/components/ui';
import { Logo } from '@/components/Logo';

export default function AdminSettings() {
  const { reload } = useConfig();
  const { data, isLoading } = useQuery({ queryKey: ['admin-settings'], queryFn: () => api.get('/admin/settings') });
  const [s, setS] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newProduct, setNewProduct] = useState('');
  const logoRef = useRef<HTMLInputElement>(null);
  useEffect(() => data && setS(data.settings), [data]);
  if (isLoading || !s) return <PageLoader />;

  const set = (k: string, v: any) => setS((p: any) => ({ ...p, [k]: v }));
  const save = async () => {
    setSaving(true);
    try {
      const { logo, ticket_counter, ...payload } = s;
      await api.put('/admin/settings', payload);
      await reload();
      toast.success('تنظیمات ذخیره شد');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  const uploadLogo = async (f: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('logo', f);
      const r = await api.upload('/admin/settings/logo', form);
      set('logo', r.logo);
      await reload();
      toast.success('لوگو به‌روز شد');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
    <section className="card p-5">
      <h2 className="mb-4 flex items-center gap-2 font-bold [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-brand">{icon} {title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center gap-3">
        <div><h1 className="flex items-center gap-2 text-xl font-extrabold"><Settings className="h-5 w-5 text-brand" /> تنظیمات سامانه</h1><p className="text-xs text-slate-500">برندینگ، محدودیت آپلود، SLA و رفتار تیکت‌ها</p></div>
        <button className="btn-primary mr-auto" onClick={save} disabled={saving}>{saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />} ذخیره تغییرات</button>
      </div>

      <Section icon={<Palette />} title="برندینگ">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-20 min-w-[200px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 dark:border-slate-700 dark:bg-slate-800"><Logo /></div>
          <div className="flex flex-col gap-2">
            <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
            <button className="btn-secondary btn-sm" onClick={() => logoRef.current?.click()} disabled={uploading}>{uploading ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />} بارگذاری لوگو</button>
            {s.logo && <button className="btn-ghost btn-sm text-rose-600" onClick={async () => { await api.del('/admin/settings/logo'); set('logo', ''); reload(); }}><Trash2 className="h-4 w-4" /> حذف لوگو</button>}
            <span className="text-[11px] text-slate-400">PNG / SVG / JPG — حداکثر ۵ مگابایت، ترجیحاً پس‌زمینه شفاف</span>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="نام شرکت (فارسی)"><input className="input" value={s.company_name} onChange={(e) => set('company_name', e.target.value)} /></Field>
          <Field label="نام شرکت (انگلیسی)"><input className="input ltr" value={s.company_name_en || ''} onChange={(e) => set('company_name_en', e.target.value)} dir="ltr" /></Field>
          <Field label="عنوان سایت"><input className="input" value={s.site_title} onChange={(e) => set('site_title', e.target.value)} /></Field>
          <Field label="توضیح کوتاه (زیر عنوان)"><input className="input" value={s.tagline || ''} onChange={(e) => set('tagline', e.target.value)} /></Field>
          <Field label="شعار"><input className="input" value={s.slogan || ''} onChange={(e) => set('slogan', e.target.value)} /></Field>
          <Field label="آدرس"><input className="input" value={s.address || ''} onChange={(e) => set('address', e.target.value)} /></Field>
          <Field label="رنگ برند"><div className="flex items-center gap-2"><input type="color" value={s.brand_color} onChange={(e) => set('brand_color', e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-slate-200" /><input className="input ltr flex-1" value={s.brand_color} onChange={(e) => set('brand_color', e.target.value)} dir="ltr" /></div></Field>
          <Field label="وب‌سایت"><input className="input ltr" value={s.website || ''} onChange={(e) => set('website', e.target.value)} dir="ltr" /></Field>
          <Field label="ایمیل پشتیبانی"><input className="input ltr" value={s.support_email || ''} onChange={(e) => set('support_email', e.target.value)} dir="ltr" /></Field>
          <Field label="تلفن پشتیبانی"><input className="input ltr" value={s.support_phone || ''} onChange={(e) => set('support_phone', e.target.value)} dir="ltr" /></Field>
        </div>
        <Field label="ساعات پاسخ‌گویی"><input className="input" value={s.working_hours || ''} onChange={(e) => set('working_hours', e.target.value)} /></Field>
        <Field label="پیام خوش‌آمد (بالای فرم ثبت تیکت)"><textarea className="input min-h-[80px]" value={s.welcome_message || ''} onChange={(e) => set('welcome_message', e.target.value)} /></Field>
      </Section>

      <Section icon={<Ticket />} title="تیکت‌ها و محصولات">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="پیشوند شماره تیکت" hint={`مثال: ${s.ticket_prefix}-${faNum(Number(s.ticket_counter) + 1)}`}><input className="input ltr" value={s.ticket_prefix} onChange={(e) => set('ticket_prefix', e.target.value.toUpperCase())} dir="ltr" maxLength={6} /></Field>
          <Field label="بستن خودکار پس از حل (روز)" hint="۰ = غیرفعال"><input className="input ltr" type="number" min={0} value={s.auto_close_resolved_days} onChange={(e) => set('auto_close_resolved_days', Number(e.target.value))} /></Field>
          <Field label="مهلت بازگشایی تیکت بسته (روز)"><input className="input ltr" type="number" min={1} value={s.reopen_window_days} onChange={(e) => set('reopen_window_days', Number(e.target.value))} /></Field>
        </div>
        <Field label="محصولات / ماژول‌ها" hint="در فرم ثبت تیکت به مشتری نمایش داده می‌شود.">
          <div className="flex flex-wrap gap-1.5">
            {(s.products || []).map((p: string) => <span key={p} className="chip bg-slate-100 dark:bg-slate-800">{p}<button onClick={() => set('products', s.products.filter((x: string) => x !== p))} className="hover:text-rose-600"><X className="h-3 w-3" /></button></span>)}
          </div>
          <div className="mt-2 flex gap-1"><input className="input" placeholder="محصول جدید…" value={newProduct} onChange={(e) => setNewProduct(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (newProduct.trim()) { set('products', [...s.products, newProduct.trim()]); setNewProduct(''); } } }} /><button className="btn-secondary" onClick={() => { if (newProduct.trim()) { set('products', [...s.products, newProduct.trim()]); setNewProduct(''); } }}><Plus className="h-4 w-4" /></button></div>
        </Field>
        <Field label="ضریب SLA بر اساس اولویت" hint="مهلت بخش × ضریب. مثلاً فوری ۰٫۲۵ یعنی یک‌چهارم زمان عادی.">
          <div className="grid grid-cols-4 gap-2">
            {(['urgent', 'high', 'normal', 'low'] as const).map((k) => (
              <div key={k}><span className="mb-1 block text-[11px] text-slate-500">{{ urgent: 'فوری', high: 'زیاد', normal: 'عادی', low: 'کم' }[k]}</span><input className="input ltr" type="number" step="0.05" min="0.05" value={s.sla_priority_multiplier?.[k] ?? 1} onChange={(e) => set('sla_priority_multiplier', { ...s.sla_priority_multiplier, [k]: Number(e.target.value) })} /></div>
            ))}
          </div>
        </Field>
        <Toggle checked={!!s.notify_new_ticket_all_dept_agents} onChange={(v) => set('notify_new_ticket_all_dept_agents', v)} label="اطلاع‌رسانی تیکت جدید به همه کارشناسان بخش" description="در غیر این صورت فقط کارشناس تخصیص‌یافته مطلع می‌شود." />
        <Toggle checked={!!s.agents_see_all_departments} onChange={(v) => set('agents_see_all_departments', v)} label="کارشناسان همه بخش‌ها را ببینند" description="در حالت پیش‌فرض هر کارشناس فقط تیکت‌های بخش‌های خودش را می‌بیند." />
      </Section>

      <Section icon={<FileUp />} title="پیوست‌ها">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="حداکثر حجم هر فایل (مگابایت)"><input className="input ltr" type="number" min={1} max={2048} value={s.max_upload_mb} onChange={(e) => set('max_upload_mb', Number(e.target.value))} /></Field>
          <Field label="حداکثر تعداد فایل در هر پیام"><input className="input ltr" type="number" min={1} max={30} value={s.max_attachments} onChange={(e) => set('max_attachments', Number(e.target.value))} /></Field>
        </div>
        <Field label="پسوندهای مجاز" hint="با کاما جدا کنید. پیام صوتی همیشه مجاز است."><textarea className="input ltr min-h-[70px] text-xs" value={s.allowed_extensions} onChange={(e) => set('allowed_extensions', e.target.value)} dir="ltr" /></Field>
        <p className="text-xs text-slate-400">توجه: حداکثر حجم آپلود در Nginx (client_max_body_size) نیز باید متناسب تنظیم شود.</p>
      </Section>

      <Section icon={<ShieldCheck />} title="دسترسی">
        <Toggle checked={!!s.allow_registration} onChange={(v) => set('allow_registration', v)} label="ثبت‌نام آزاد مشتریان" description="در صورت غیرفعال بودن، فقط مدیر می‌تواند کاربر بسازد." />
      </Section>

      <Section icon={<Mail />} title="کانال‌های اطلاع‌رسانی">
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <div className={`rounded-xl border p-3 ${data.channels.email ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'}`}><div className="font-semibold">ایمیل (SMTP)</div><div className="text-xs text-slate-500">{data.channels.email ? 'فعال' : 'غیرفعال — متغیرهای SMTP_* را در فایل .env تنظیم کنید.'}</div></div>
          <div className={`rounded-xl border p-3 ${data.channels.sms ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'}`}><div className="font-semibold">پیامک (کاوه‌نگار)</div><div className="text-xs text-slate-500">{data.channels.sms ? 'فعال' : 'غیرفعال — SMS_PROVIDER=kavenegar و SMS_API_KEY را تنظیم کنید.'}</div></div>
        </div>
      </Section>

      <div className="flex justify-end"><button className="btn-primary" onClick={save} disabled={saving}>{saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />} ذخیره تغییرات</button></div>
    </div>
  );
}
