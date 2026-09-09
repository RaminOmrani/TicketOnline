import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Mic, Send, Info, Check, Search, Lightbulb, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { faNum, formatBytes } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { useConfig } from '@/store/config';
import { Field, Spinner } from '@/components/ui';
import { LogoMark } from '@/components/Logo';
import { DeptIcon, PRIORITY_META } from '@/components/tickets/badges';
import { useAttachments } from '@/components/thread/useAttachments';
import { AttachButtons, DropOverlay, PendingList } from '@/components/thread/AttachmentPicker';
import { VoiceRecorder } from '@/components/thread/VoiceRecorder';
import type { Priority, User } from '@/lib/types';

export default function NewTicketPage() {
  const { isStaff } = useAuth();
  const { companies, settings } = useConfig();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const att = useAttachments();
  const paramDept = Number(params.get('department')) || 0;
  const [companyId, setCompanyId] = useState<number>(() => Number(params.get('company')) || 0);
  const [dept, setDept] = useState<number>(paramDept);
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [product, setProduct] = useState('');
  const [body, setBody] = useState('');
  const [recording, setRecording] = useState(false);
  const [drag, setDrag] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<{ message: string; field?: string }>({ message: '' });
  const [custQ, setCustQ] = useState('');
  const [customer, setCustomer] = useState<User | null>(null);
  const { data: custResults } = useQuery({ queryKey: ['customers-search', custQ], queryFn: () => api.get<{ items: User[] }>('/admin/customers', { q: custQ, per_page: 8 }), enabled: isStaff && custQ.length >= 2 });
  const { data: kbHints } = useQuery({ queryKey: ['kb-hint', subject], queryFn: () => api.get<{ items: any[] }>('/kb', { q: subject }), enabled: subject.trim().length >= 4 });

  // Single company → auto select. Department from URL → infer company.
  useEffect(() => {
    if (companies.length === 1 && !companyId) setCompanyId(companies[0].id);
    if (paramDept && !companyId) {
      const c = companies.find((x) => x.departments?.some((d) => d.id === paramDept));
      if (c) setCompanyId(c.id);
    }
  }, [companies, paramDept]);

  const company = useMemo(() => companies.find((c) => c.id === companyId) || null, [companies, companyId]);
  const departments = company?.departments || [];
  const products = (company?.products as string[]) || [];
  useEffect(() => {
    setProduct(products[0] || '');
    if (dept && !departments.some((d) => d.id === dept)) setDept(0);
  }, [companyId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return setError({ message: 'لطفاً شرکت / محصول مربوطه را انتخاب کنید.', field: 'company_id' });
    if (!dept) return setError({ message: 'لطفاً بخش مربوطه را انتخاب کنید.', field: 'department_id' });
    if (subject.trim().length < 3) return setError({ message: 'موضوع را کامل‌تر بنویسید.', field: 'subject' });
    if (!body.trim() && !att.hasAny) return setError({ message: 'شرح مشکل یا حداقل یک پیوست الزامی است.', field: 'body' });
    if (isStaff && !customer) return setError({ message: 'مشتری را انتخاب کنید.', field: 'customer_id' });
    setError({ message: '' });
    setSending(true);
    try {
      const form = new FormData();
      form.append('subject', subject.trim());
      form.append('department_id', String(dept));
      form.append('priority', priority);
      if (product) form.append('product', product);
      form.append('body', body.trim());
      if (customer) form.append('customer_id', String(customer.id));
      att.appendTo(form);
      const r = await api.upload('/tickets', form, setProgress);
      toast.success(`تیکت ${r.ticket.number} ثبت شد`);
      att.clear();
      navigate(`/tickets/${r.ticket.id}`);
    } catch (err: any) {
      setError({ message: err.message, field: err.field });
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const err = (f: string) => (error.field === f ? error.message : undefined);
  const hasCompanyStep = companies.length > 1;

  return (
    <div className="mx-auto max-w-4xl" dir="rtl">
      <h1 className="text-xl font-extrabold">ثبت تیکت جدید</h1>
      <p className="mt-1 text-sm text-slate-500">{settings.welcome_message}</p>

      <form onSubmit={submit} className="mt-5 space-y-5">
        {isStaff && (
          <div className="card p-4">
            <Field label="مشتری" required error={err('customer_id')} hint="تیکت از طرف این مشتری ثبت می‌شود.">
              {customer ? (
                <div className="flex items-center justify-between rounded-xl border border-brand/40 bg-brand/5 px-3 py-2 text-sm">
                  <span>{customer.name}{customer.company ? ` — ${customer.company}` : ''} <span className="ltr text-xs text-slate-400">{customer.email || customer.mobile}</span></span>
                  <button type="button" className="text-xs text-brand" onClick={() => setCustomer(null)}>تغییر</button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input className="input pr-9" placeholder="جستجوی نام، شرکت، ایمیل یا موبایل مشتری…" value={custQ} onChange={(e) => setCustQ(e.target.value)} />
                  {custQ.length >= 2 && custResults && (
                    <div className="card absolute z-20 mt-1 w-full p-1 shadow-pop">
                      {!custResults.items.length && <div className="px-3 py-2 text-xs text-slate-400">مشتری یافت نشد. <Link to="/admin/users" className="text-brand">ایجاد کاربر</Link></div>}
                      {custResults.items.map((c) => (
                        <button key={c.id} type="button" className="block w-full rounded-lg px-3 py-2 text-start text-sm hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => { setCustomer(c); setCustQ(''); }}>
                          {c.name} {c.company && <span className="text-slate-400">— {c.company}</span>} <span className="ltr text-xs text-slate-400">{c.email || c.mobile}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Field>
          </div>
        )}

        {/* Step 1: company */}
        {hasCompanyStep && (
          <div>
            <label className="label">۱. تیکت برای کدام شرکت / محصول است؟ <span className="text-rose-500">*</span></label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {companies.map((c) => (
                <button type="button" key={c.id} onClick={() => setCompanyId(c.id)} className={clsx('card relative flex flex-col items-center gap-2 p-4 text-center transition hover:border-brand/50', companyId === c.id && 'border-brand ring-4 ring-brand/15')}>
                  <span className="flex h-14 w-full items-center justify-center">
                    {c.logo ? <img src={c.logo} alt={c.name} className="max-h-14 max-w-[80%] object-contain" /> : <LogoMark className="h-12 w-12" color="rgb(var(--brand-rgb))" />}
                  </span>
                  <span className="font-bold">{c.name}</span>
                  {c.description && <span className="line-clamp-2 text-[11px] leading-5 text-slate-500">{c.description}</span>}
                  {companyId === c.id && <span className="absolute left-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white"><Check className="h-3 w-3" /></span>}
                </button>
              ))}
            </div>
            {err('company_id') && <p className="mt-1 text-xs text-rose-600">{err('company_id')}</p>}
          </div>
        )}

        {/* Step 2: department */}
        {company && (
          <div className="animate-fade-in">
            <label className="label">{hasCompanyStep ? '۲. ' : ''}بخش مربوطه <span className="text-rose-500">*</span></label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {departments.map((d) => (
                <button type="button" key={d.id} onClick={() => setDept(d.id)} className={clsx('card relative flex items-start gap-3 p-4 text-start transition hover:border-brand/50', dept === d.id && 'border-brand ring-4 ring-brand/15')}>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand"><DeptIcon name={d.icon} className="h-6 w-6" /></span>
                  <span className="min-w-0">
                    <span className="block font-bold">{d.name}</span>
                    <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-slate-500">{d.description}</span>
                  </span>
                  {dept === d.id && <span className="absolute left-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white"><Check className="h-3 w-3" /></span>}
                </button>
              ))}
              {!departments.length && <div className="text-sm text-slate-400">بخشی برای این شرکت تعریف نشده است.</div>}
            </div>
            {err('department_id') && <p className="mt-1 text-xs text-rose-600">{err('department_id')}</p>}
          </div>
        )}

        {company && dept > 0 && (
          <div className="card space-y-4 p-4 sm:p-6 animate-fade-in">
            <Field label="موضوع" required error={err('subject')}>
              <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="مثلاً: خطا هنگام ثبت سند حسابداری" maxLength={200} dir="rtl" />
            </Field>
            {kbHints && kbHints.items.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-500/30 dark:bg-amber-500/10">
                <div className="mb-1 flex items-center gap-1 font-bold text-amber-800 dark:text-amber-200"><Lightbulb className="h-4 w-4" /> شاید این مقالات به شما کمک کند:</div>
                <ul className="space-y-0.5">
                  {kbHints.items.slice(0, 3).map((a) => <li key={a.id}><Link to={`/kb/${a.slug}`} target="_blank" className="text-brand hover:underline">{a.title}</Link></li>)}
                </ul>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="اولویت">
                <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                  {(Object.keys(PRIORITY_META) as Priority[]).map((p) => {
                    const Icon = PRIORITY_META[p].icon;
                    return (
                      <button type="button" key={p} onClick={() => setPriority(p)} className={clsx('flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium transition', priority === p ? 'bg-white shadow-sm dark:bg-slate-900 ' + PRIORITY_META[p].color : 'text-slate-500')}>
                        <Icon className="h-3.5 w-3.5" /> {PRIORITY_META[p].label}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="محصول / خدمت">
                <select className="input" value={product} onChange={(e) => setProduct(e.target.value)}>
                  {!products.length && <option value="">—</option>}
                  {products.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
            </div>
            {priority === 'urgent' && <p className="flex items-center gap-1 text-xs text-rose-600"><Info className="h-3.5 w-3.5" /> اولویت «فوری» فقط برای مواردی است که فعالیت مجموعه شما متوقف شده است.</p>}

            <Field label="شرح کامل درخواست" required error={err('body')} hint="نسخه نرم‌افزار، متن خطا و مراحل بروز مشکل را بنویسید. می‌توانید تصویر را مستقیماً Paste کنید.">
              <div className={clsx('relative rounded-xl border bg-white dark:bg-slate-900', err('body') ? 'border-rose-400' : 'border-slate-300 dark:border-slate-700', drag && 'ring-4 ring-brand/20')} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); e.dataTransfer.files.length && att.addFiles(e.dataTransfer.files); }}>
                <DropOverlay active={drag} />
                <textarea className="block min-h-[160px] w-full resize-y rounded-xl bg-transparent px-4 py-3 text-right text-sm leading-7 outline-none" value={body} onChange={(e) => setBody(e.target.value)} onPaste={(e) => { const f = Array.from(e.clipboardData.files || []); if (f.length) { e.preventDefault(); att.addFiles(f); } }} dir="rtl" placeholder="توضیحات…" />
                {(att.files.length > 0 || att.voice) && <div className="px-3 pb-3"><PendingList files={att.files} voice={att.voice} onRemove={att.remove} onRemoveVoice={() => att.setVoice(null)} /></div>}
                {recording && <div className="px-3 pb-3"><VoiceRecorder onDone={(c) => { att.setVoice(c); setRecording(false); }} onCancel={() => setRecording(false)} /></div>}
                <div className="flex flex-wrap items-center gap-1 border-t border-slate-100 px-2 py-1.5 dark:border-slate-800">
                  <AttachButtons onFiles={att.addFiles} disabled={sending} />
                  <button type="button" className={clsx('btn-icon', recording && 'bg-rose-100 text-rose-600')} title="ضبط پیام صوتی" onClick={() => setRecording((r) => !r)} disabled={sending || !!att.voice}><Mic className="h-5 w-5" /></button>
                  <span className="mr-auto text-[11px] text-slate-400">حداکثر {faNum(settings.max_attachments)} فایل، هر کدام تا {faNum(settings.max_upload_mb)} مگابایت{att.hasAny ? ` — مجموع ${formatBytes(att.totalSize)}` : ''}</span>
                </div>
              </div>
            </Field>

            {sending && progress > 0 && progress < 100 && (
              <div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} /></div>
                <div className="mt-1 text-xs text-slate-400">در حال بارگذاری پیوست‌ها… {faNum(progress)}٪</div>
              </div>
            )}
            {error.message && !error.field && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error.message}</div>}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => navigate(-1)} disabled={sending}>انصراف</button>
              <button className="btn-primary" disabled={sending}>
                {sending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4 -scale-x-100" />}
                ثبت تیکت
              </button>
            </div>
          </div>
        )}
        {company && !dept && <p className="flex items-center gap-1 text-xs text-slate-400"><ChevronRight className="h-3.5 w-3.5" /> برای ادامه، بخش را انتخاب کنید.</p>}
      </form>
    </div>
  );
}
