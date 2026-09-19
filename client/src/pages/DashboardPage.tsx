import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { PlusCircle, Inbox, Clock, AlertTriangle, CheckCircle2, BookOpen, ArrowLeft, UserCheck, MessageSquareWarning, ChevronDown, Activity, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { faNum } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { useConfig } from '@/store/config';
import { Skeleton, EmptyState } from '@/components/ui';
import { DeptIcon } from '@/components/tickets/badges';
import { LogoMark } from '@/components/Logo';
import { TicketMiniList } from '@/components/tickets/TicketTable';
import type { Ticket, KbArticle, Company } from '@/lib/types';

function Stat({ label, value, icon, to, color = 'brand' }: { label: string; value?: number; icon: React.ReactNode; to: string; color?: string }) {
  const colors: Record<string, string> = { brand: 'bg-brand/10 text-brand', amber: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15', rose: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15', green: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15', violet: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15' };
  return (
    <Link to={to} className="card flex items-center gap-4 p-4 transition hover:border-brand/40 hover:shadow-pop">
      <span className={clsx('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl [&>svg]:h-6 [&>svg]:w-6', colors[color])}>{icon}</span>
      <span>
        <span className="block text-2xl font-extrabold num">{value === undefined ? '…' : faNum(value)}</span>
        <span className="block text-xs text-slate-500">{label}</span>
      </span>
    </Link>
  );
}

/** Company tiles (2×2). Clicking a tile expands its departments. */
function CompanyGrid({ companies }: { companies: Company[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const open = companies.find((c) => c.id === openId) || null;
  return (
    <section className="card p-4">
      <h2 className="mb-3 text-base font-bold">شرکت‌ها و بخش‌های پشتیبانی</h2>
      <div className="grid grid-cols-2 gap-2.5">
        {companies.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setOpenId((v) => (v === c.id ? null : c.id))}
            className={clsx('flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition hover:border-brand/50 hover:shadow-pop', openId === c.id ? 'border-brand bg-brand/5 ring-4 ring-brand/10' : 'border-slate-200 dark:border-slate-700')}
            style={c.color && openId === c.id ? { borderColor: c.color } : undefined}
          >
            <span className="logo-well flex h-12 w-full items-center justify-center rounded-xl px-2 dark:bg-white">
              {c.logo ? <img src={c.logo} alt={c.name} className="max-h-12 max-w-[85%] object-contain" /> : <LogoMark className="h-10 w-10" color={c.color || 'rgb(var(--brand-rgb))'} />}
            </span>
            <span className="flex items-center gap-1 text-[13px] font-bold leading-5">
              {c.name}
              <ChevronDown className={clsx('h-3.5 w-3.5 text-slate-400 transition', openId === c.id && 'rotate-180')} />
            </span>
          </button>
        ))}
      </div>
      {open && (
        <div className="mt-3 rounded-2xl border border-slate-200 p-2 animate-fade-in dark:border-slate-700">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-bold text-slate-500">بخش‌های {open.name}</span>
            <Link to={`/tickets/new?company=${open.id}`} className="text-[11px] text-brand hover:underline">ثبت تیکت برای {open.name}</Link>
          </div>
          <ul className="space-y-0.5">
            {open.departments?.map((d) => (
              <li key={d.id}>
                <Link to={`/tickets/new?company=${open.id}&department=${d.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-slate-50 dark:hover:bg-slate-800">
                  <span className="text-brand"><DeptIcon name={d.icon} className="h-4 w-4" /></span>
                  <span className="text-sm">{d.name}</span>
                </Link>
              </li>
            ))}
            {!open.departments?.length && <li className="px-2 py-1 text-xs text-slate-400">بخشی تعریف نشده است.</li>}
          </ul>
        </div>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const { user, isStaff } = useAuth();
  const { companies, settings } = useConfig();
  const { data: summary } = useQuery({ queryKey: ['summary'], queryFn: () => api.get('/tickets/summary') });
  const { data: recent, isLoading } = useQuery({ queryKey: ['tickets', { view: isStaff ? 'open' : undefined, per_page: 8, sort: 'updated' }], queryFn: () => api.get<{ items: Ticket[] }>('/tickets', { view: isStaff ? 'open' : undefined, per_page: 8, sort: 'updated' }) });
  const { data: unread } = useQuery({ queryKey: ['tickets', { view: 'unread', per_page: 5 }], queryFn: () => api.get<{ items: Ticket[] }>('/tickets', { view: 'unread', per_page: 5 }) });
  const { data: kb } = useQuery({ queryKey: ['kb', 'dash'], queryFn: () => api.get<{ items: KbArticle[] }>('/kb', { limit: 6, sort: 'views' }) });

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'صبح بخیر' : hour < 17 ? 'ظهر بخیر' : 'عصر بخیر';

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">{greet}، {user?.name?.split(' ')[0]} 👋</h1>
          <p className="mt-1 text-sm text-slate-500">{isStaff ? 'خلاصه وضعیت صندوق پشتیبانی' : `به ${settings.site_title} خوش آمدید.`}</p>
        </div>
        <Link to="/tickets/new" className="btn-primary"><PlusCircle className="h-4 w-4" /> ایجاد تیکت جدید</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isStaff ? (
          <>
            <Stat label="در جریان" value={summary ? summary.open + summary.in_progress + summary.waiting_customer : undefined} icon={<Inbox />} to="/tickets?view=open" />
            <Stat label="تخصیص‌نیافته" value={summary?.unassigned} icon={<UserCheck />} to="/tickets?view=unassigned" color="violet" />
            <Stat label="تیکت‌های من" value={summary?.mine} icon={<MessageSquareWarning />} to="/tickets?view=mine" color="amber" />
            <Stat label="تأخیر SLA" value={summary?.overdue} icon={<AlertTriangle />} to="/tickets?view=overdue" color="rose" />
          </>
        ) : (
          <>
            <Stat label="در جریان" value={summary ? summary.open + summary.in_progress + summary.waiting_customer : undefined} icon={<Inbox />} to="/tickets?view=open" />
            <Stat label="منتظر پاسخ شما" value={summary?.waiting_customer} icon={<Clock />} to="/tickets?status=waiting_customer" color="amber" />
            <Stat label="پاسخ جدید" value={summary?.unread} icon={<MessageSquareWarning />} to="/tickets?view=unread" color="violet" />
            <Stat label="حل‌شده" value={summary?.resolved} icon={<CheckCircle2 />} to="/tickets?view=resolved" color="green" />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {unread && unread.items.length > 0 && (
            <section className="card overflow-hidden">
              <h2 className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-base font-bold dark:border-slate-800"><span className="h-2 w-2 rounded-full bg-brand" /> پیام‌های خوانده‌نشده</h2>
              <TicketMiniList items={unread.items} staff={isStaff} />
            </section>
          )}
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <h2 className="text-base font-bold">{isStaff ? 'تیکت‌های در جریان' : 'آخرین تیکت‌ها'}</h2>
              <Link to="/tickets" className="flex items-center gap-1 text-xs text-brand hover:underline">مشاهده همه <ArrowLeft className="h-3.5 w-3.5" /></Link>
            </div>
            {isLoading ? (
              <div className="space-y-2 p-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : !recent?.items.length ? (
              <EmptyState title="تیکتی وجود ندارد" description={isStaff ? 'همه تیکت‌ها رسیدگی شده‌اند. آفرین!' : 'برای ارتباط با بخش‌های مختلف، تیکت جدید ثبت کنید.'} action={!isStaff && <Link to="/tickets/new" className="btn-primary">ثبت تیکت</Link>} />
            ) : (
              <TicketMiniList items={recent.items} staff={isStaff} />
            )}
          </section>
        </div>

        <div className="space-y-6">
          {!isStaff && companies.length > 0 && <CompanyGrid companies={companies} />}
          {settings.status_url && (
            <a href={settings.status_url} target="_blank" rel="noopener noreferrer" className="card flex items-center gap-3 p-4 transition hover:border-brand/40 hover:shadow-pop">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15"><Activity className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{settings.status_label || 'وضعیت سرویس‌ها'}</span>
                <span className="block text-[11px] text-slate-500">آخرین اختلالات، قطعی‌ها و اطلاعیه‌های فنی</span>
              </span>
              <ExternalLink className="h-4 w-4 text-slate-400" />
            </a>
          )}
          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-bold"><BookOpen className="h-4 w-4 text-brand" /> راهنما</h2>
              <Link to="/kb" className="text-xs text-brand hover:underline">همه مقالات</Link>
            </div>
            {!kb?.items.length ? (
              <p className="text-xs text-slate-400">مقاله‌ای منتشر نشده است.</p>
            ) : (
              <ul className="space-y-1">
                {kb.items.slice(0, 6).map((a) => (
                  <li key={a.id}><Link to={`/kb/${a.slug}`} className="block rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">{a.title}</Link></li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
