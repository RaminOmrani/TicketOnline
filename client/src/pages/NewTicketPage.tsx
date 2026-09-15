import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Mic, Send, Info, Check, Search, Lightbulb, ChevronLeft, ChevronRight, HelpCircle, BookOpen, MessageSquarePlus, Building2, LifeBuoy, FileText, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { faNum, formatBytes } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { useConfig } from '@/store/config';
import { Field, Spinner, SearchInput } from '@/components/ui';
import { LogoMark } from '@/components/Logo';
import { DeptIcon, PRIORITY_META } from '@/components/tickets/badges';
import { useAttachments } from '@/components/thread/useAttachments';
import { AttachButtons, DropOverlay, PendingList } from '@/components/thread/AttachmentPicker';
import { VoiceRecorder } from '@/components/thread/VoiceRecorder';
import type { Priority, User, KbArticle } from '@/lib/types';

type Step = 'faq' | 'company' | 'dept' | 'form';

function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

/* ---------- Step 1: FAQ + knowledge base search ---------- */
function FaqStep({ companyId, deptId, companyName, deptName, onContinue, onBack }: { companyId: number; deptId: number; companyName?: string; deptName?: string; onContinue: () => void; onBack: () => void }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  // Articles of this department first, then company-wide, then general ones.
  const { data: faq, isLoading } = useQuery({ queryKey: ['kb', 'scoped', companyId, deptId], queryFn: () => api.get<{ items: KbArticle[] }>('/kb', { company_id: companyId, department_id: deptId, limit: 8 }) });
  const { data: results, isFetching } = useQuery({ queryKey: ['kb', 'search', companyId, dq], queryFn: () => api.get<{ items: KbArticle[] }>('/kb', { q: dq, company_id: companyId, limit: 8 }), enabled: dq.trim().length >= 2 });
  const searching = dq.trim().length >= 2;
  const list = (searching ? results?.items : faq?.items) || [];
  // Nothing written for this department yet → go straight to the form.
  useEffect(() => {
    if (faq && faq.items.length === 0) onContinue();
  }, [faq]);
  if (isLoading || (faq && faq.items.length === 0)) return <div className="card p-6 text-center text-sm text-slate-400"><Spinner className="mx-auto h-5 w-5" /></div>;

  return (
    <div className="card p-5 sm:p-7 animate-fade-in">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-500/15"><HelpCircle className="h-6 w-6" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold">شاید پاسخ شما همین‌جا باشد</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">راهنما و سوالات متداول <span className="font-bold text-slate-700 dark:text-slate-200">{deptName}</span>{companyName ? ` (${companyName})` : ''}. اگر پاسخ نگرفتید، تیکت ثبت کنید تا کارشناسان همین بخش پاسخ دهند.</p>
        </div>
        <button type="button" className="btn-secondary btn-sm shrink-0" onClick={onBack}>{deptName} <span className="text-brand">· تغییر</span></button>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-sm font-bold"><span className="flex items-center gap-2"><HelpCircle className="h-4 w-4 text-brand" /> سوالات متداول و راهنمای {deptName}</span><Link to={`/kb?company=${companyId}`} target="_blank" className="text-xs font-normal text-brand hover:underline">راهنمای کامل {companyName}</Link></div>
        {!searching && (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
            {list.map((a) => (
              <li key={a.id}>
                <Link to={`/kb/${a.slug}`} target="_blank" className="flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800">
                  <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{a.title}</span>
                    {a.summary && <span className="block truncate text-xs text-slate-500">{a.summary}</span>}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><Eye className="h-3 w-3" />{faNum(a.views)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold"><BookOpen className="h-4 w-4 text-brand" /> جستجو در راهنمای {companyName || 'پایگاه دانش'}</div>
        <SearchInput value={q} onChange={setQ} placeholder="مثلاً: پشتیبان‌گیری، فاکتور، خطای اتصال…" />
        {searching && (
          <div className="mt-3">
            {isFetching && !results ? (
              <div className="flex items-center gap-2 text-xs text-slate-400"><Spinner className="h-4 w-4" /> در حال جستجو…</div>
            ) : !list.length ? (
              <p className="text-xs text-slate-400">مقاله‌ای برای «{dq}» پیدا نشد.</p>
            ) : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                {list.map((a) => (
                  <li key={a.id}>
                    <Link to={`/kb/${a.slug}`} target="_blank" className="flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800">
                      <Lightbulb className="h-4 w-4 shrink-0 text-amber-500" />
                      <span className="min-w-0 flex-1"><span className="block truncate font-medium">{a.title}</span>{a.summary && <span className="block truncate text-xs text-slate-500">{a.summary}</span>}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="mt-7 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-brand/40 bg-brand/[0.04] p-5 text-center">
        <span className="text-sm font-bold">پاسخ خود را پیدا نکردید؟</span>
        <span className="text-xs text-slate-500">کارشناسان ما آماده پاسخ‌گویی هستند.</span>
        <button type="button" className="btn-primary mt-2 px-6" onClick={onContinue}><MessageSquarePlus className="h-4 w-4" /> پاسخم را نگرفتم، تیکت ثبت می‌کنم</button>
      </div>
    </div>
  );
}

export default function NewTicketPage() {
  const { isStaff } = useAuth();
  const { companies, settings } = useConfig();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const att = useAttachments();
  const paramDept = Number(params.get('department')) || 0;
  const paramCompany = Number(params.get('company')) || 0;
  const [companyId, setCompanyId] = useState<number>(paramCompany);
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
  const dSubject = useDebounced(subject, 400);
  const { data: kbHints } = useQuery({ queryKey: ['kb-hint', dSubject], queryFn: () => api.get<{ items: any[] }>('/kb', { q: dSubject, limit: 3 }), enabled: dSubject.trim().length >= 4 });

  const hasCompanyStep = companies.length > 1;
  // Order: company → department → FAQ of that department (customers only) → form.
  const [step, setStep] = useState<Step>(() => (paramDept ? (isStaff ? 'form' : 'faq') : paramCompany ? 'dept' : companies.length > 1 ? 'company' : 'dept'));

  // Single company → auto select. Department from URL → infer company.
  useEffect(() => {
    if (companies.length === 1 && !companyId) setCompanyId(companies[0].id);
    if (paramDept && !companyId) {
      const c = companies.find((x) => x.departments?.some((d) => d.id === paramDept));
      if (c) setCompanyId(c.id);
    }
    if (isStaff && step === 'company' && companies.length === 1) setStep('dept');
  }, [companies, paramDept]);

  const company = useMemo(() => companies.find((c) => c.id === companyId) || null, [companies, companyId]);
  const departments = company?.departments || [];
  const products = (company?.products as string[]) || [];
  const department = departments.find((d) => d.id === dept) || null;
  useEffect(() => {
    setProduct(products[0] || '');
    if (dept && !departments.some((d) => d.id === dept)) setDept(0);
  }, [companyId]);

  const pickCompany = (id: number) => { setCompanyId(id); setStep('dept'); };
  const pickDept = (id: number) => { setDept(id); setStep(isStaff ? 'form' : 'faq'); };

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

  const steps: { key: Step; label: string; icon: React.ReactNode }[] = [
    ...(hasCompanyStep ? [{ key: 'company' as Step, label: 'شرکت', icon: <Building2 /> }] : []),
    { key: 'dept', label: 'بخش', icon: <LifeBuoy /> },
    ...(!isStaff ? [{ key: 'faq' as Step, label: 'راهنما', icon: <HelpCircle /> }] : []),
    { key: 'form', label: 'شرح درخواست', icon: <FileText /> },
  ];
  const stepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="mx-auto max-w-6xl" dir="rtl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">ایجاد تیکت جدید</h1>
          <p className="mt-1 text-sm text-slate-500">{settings.welcome_message}</p>
        </div>
      </div>

      {/* Stepper */}
      <ol className="mb-6 flex items-center gap-2 overflow-x-auto">
        {steps.map((s, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <li key={s.key} className="flex items-center gap-2">
              <button
                type="button"
                disabled={!done}
                onClick={() => done && setStep(s.key)}
                className={clsx('flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition [&>svg]:h-4 [&>svg]:w-4', active ? 'border-brand bg-brand text-white' : done ? 'border-brand/40 bg-brand/5 text-brand hover:bg-brand/10' : 'border-slate-200 text-slate-400 dark:border-slate-700')}
              >
                <span className={clsx('flex h-5 w-5 items-center justify-center rounded-full text-[11px]', active ? 'bg-white/20' : done ? 'bg-brand text-white' : 'bg-slate-100 dark:bg-slate-800')}>{done ? <Check className="h-3 w-3" /> : faNum(i + 1)}</span>
                {s.label}
              </button>
              {i < steps.length - 1 && <ChevronLeft className="h-4 w-4 text-slate-300" />}
            </li>
          );
        })}
      </ol>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {step === 'faq' && <FaqStep companyId={companyId} deptId={dept} companyName={company?.name} deptName={department?.name} onContinue={() => setStep('form')} onBack={() => setStep('dept')} />}

          {step === 'company' && (
            <div className="card p-5 sm:p-7 animate-fade-in">
              <h2 className="text-lg font-extrabold">تیکت برای کدام شرکت / محصول است؟</h2>
              <p className="mt-1 text-sm text-slate-500">هر شرکت کارشناسان و بخش‌های مخصوص خودش را دارد.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {companies.map((c) => (
                  <button type="button" key={c.id} onClick={() => pickCompany(c.id)} className={clsx('group relative flex items-center gap-4 rounded-2xl border-2 p-5 text-start transition hover:shadow-pop', companyId === c.id ? 'border-brand bg-brand/5' : 'border-slate-200 hover:border-brand/50 dark:border-slate-700')} style={c.color ? ({ '--co': c.color } as any) : undefined}>
                    <span className="flex h-16 w-24 shrink-0 items-center justify-center rounded-xl bg-white p-2 ring-1 ring-slate-200 dark:ring-slate-700">
                      {c.logo ? <img src={c.logo} alt={c.name} className="max-h-full max-w-full object-contain" /> : <LogoMark className="h-12 w-12" color={c.color || 'rgb(var(--brand-rgb))'} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-extrabold" style={c.color ? { color: c.color } : undefined}>{c.name}</span>
                      {c.description && <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-slate-500">{c.description}</span>}
                      <span className="mt-1 block text-[11px] text-slate-400">{faNum(c.departments?.length || 0)} بخش پشتیبانی</span>
                    </span>
                    <ChevronLeft className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:text-brand" />
                    {companyId === c.id && <span className="absolute left-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white"><Check className="h-3 w-3" /></span>}
                  </button>
                ))}
              </div>
              {err('company_id') && <p className="mt-2 text-xs text-rose-600">{err('company_id')}</p>}
            </div>
          )}

          {step === 'dept' && (
            <div className="card p-5 sm:p-7 animate-fade-in">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold">بخش مربوطه را انتخاب کنید</h2>
                  <p className="mt-1 text-sm text-slate-500">با انتخاب بخش درست، تیکت مستقیماً به کارشناس همان حوزه می‌رسد.</p>
                </div>
                {hasCompanyStep && company && (
                  <button type="button" className="btn-secondary btn-sm" onClick={() => setStep('company')}>
                    {company.logo ? <img src={company.logo} alt="" className="h-4 w-auto" /> : null}
                    {company.name} <span className="text-brand">· تغییر</span>
                  </button>
                )}
              </div>
              {!company ? (
                <p className="mt-5 text-sm text-slate-400">ابتدا شرکت را انتخاب کنید.</p>
              ) : (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {departments.map((d) => (
                    <button type="button" key={d.id} onClick={() => pickDept(d.id)} className={clsx('group relative flex items-start gap-4 rounded-2xl border-2 p-4 text-start transition hover:shadow-pop', dept === d.id ? 'border-brand bg-brand/5' : 'border-slate-200 hover:border-brand/50 dark:border-slate-700')}>
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand"><DeptIcon name={d.icon} className="h-6 w-6" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-bold">{d.name}</span>
                        <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-slate-500">{d.description}</span>
                      </span>
                      <ChevronLeft className="mt-3 h-5 w-5 shrink-0 text-slate-300 transition group-hover:text-brand" />
                    </button>
                  ))}
                  {!departments.length && <div className="text-sm text-slate-400">بخشی برای این شرکت تعریف نشده است.</div>}
                </div>
              )}
              {err('department_id') && <p className="mt-2 text-xs text-rose-600">{err('department_id')}</p>}
            </div>
          )}

          {step === 'form' && (
            <form onSubmit={submit} className="card space-y-5 p-5 sm:p-7 animate-fade-in">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold">شرح درخواست</h2>
                  <p className="mt-1 text-sm text-slate-500">هرچه جزئیات کامل‌تر باشد، پاسخ سریع‌تر و دقیق‌تر است.</p>
                </div>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setStep('dept')}>
                  {department && <DeptIcon name={department.icon} className="h-4 w-4 text-brand" />}
                  {company?.name}{department ? ` › ${department.name}` : ''} <span className="text-brand">· تغییر</span>
                </button>
              </div>

              {isStaff && (
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
              )}

              <Field label="موضوع" required error={err('subject')}>
                <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="مثلاً: خطا هنگام ثبت سند حسابداری" maxLength={200} dir="rtl" autoFocus />
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
                  <textarea className="block min-h-[180px] w-full resize-y rounded-xl bg-transparent px-4 py-3 text-right text-sm leading-7 outline-none" value={body} onChange={(e) => setBody(e.target.value)} onPaste={(e) => { const f = Array.from(e.clipboardData.files || []); if (f.length) { e.preventDefault(); att.addFiles(f); } }} dir="rtl" placeholder="توضیحات…" />
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

              {/* Sticky action bar: stays visible while the form scrolls */}
              <div className="sticky bottom-0 -mx-5 -mb-5 flex items-center justify-between gap-2 rounded-b-2xl border-t border-slate-100 bg-white/90 px-5 py-3 backdrop-blur dark:border-slate-800 dark:bg-[#1c2029]/90 sm:-mx-7 sm:-mb-7 sm:px-7">
                <button type="button" className="btn-ghost" onClick={() => setStep(isStaff ? 'dept' : 'faq')} disabled={sending}><ChevronRight className="h-4 w-4" /> مرحله قبل</button>
                <div className="flex items-center gap-2">
                  <button type="button" className="btn-secondary" onClick={() => navigate(-1)} disabled={sending}>انصراف</button>
                  <button className="btn-primary px-6" disabled={sending}>
                    {sending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4 -scale-x-100" />}
                    ثبت تیکت
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Side panel: summary + tips */}
        <aside className="space-y-4">
          <div className="card p-4">
            <h3 className="mb-3 text-sm font-bold">خلاصه انتخاب شما</h3>
            <dl className="space-y-2 text-sm">
              {hasCompanyStep && (
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500">شرکت</dt>
                  <dd className="flex items-center gap-1.5 font-medium">{company?.logo && <img src={company.logo} alt="" className="h-4 w-auto" />}{company?.name || <span className="text-slate-400">—</span>}</dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">بخش</dt>
                <dd className="flex items-center gap-1.5 font-medium">{department ? <><DeptIcon name={department.icon} className="h-4 w-4 text-brand" />{department.name}</> : <span className="text-slate-400">—</span>}</dd>
              </div>
              {step === 'form' && (
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500">اولویت</dt>
                  <dd className={clsx('font-medium', PRIORITY_META[priority].color)}>{PRIORITY_META[priority].label}</dd>
                </div>
              )}
            </dl>
          </div>
          <div className="card p-4 text-sm">
            <h3 className="mb-2 flex items-center gap-1.5 font-bold"><Lightbulb className="h-4 w-4 text-amber-500" /> نکات ثبت تیکت بهتر</h3>
            <ul className="list-disc space-y-1.5 pr-4 text-xs leading-6 text-slate-500">
              <li>برای هر موضوع یک تیکت جداگانه ثبت کنید.</li>
              <li>نسخه نرم‌افزار و متن دقیق خطا را بنویسید.</li>
              <li>از صفحه خطا تصویر یا ویدیو بگیرید و پیوست کنید.</li>
              <li>اگر توضیح سخت است، پیام صوتی ضبط کنید.</li>
              <li>اولویت «فوری» فقط برای توقف کامل کار.</li>
            </ul>
          </div>
          {settings.working_hours && (
            <div className="card p-4 text-xs text-slate-500">
              <div className="mb-1 font-bold text-slate-700 dark:text-slate-200">ساعات پاسخ‌گویی</div>
              {settings.working_hours}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
