import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { PlusCircle, Inbox, Clock, AlertTriangle, CheckCircle2, BookOpen, ArrowLeft, UserCheck, MessageSquareWarning, Mic, FileUp, Video } from 'lucide-react';
import { api } from '@/lib/api';
import { faNum } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { useConfig } from '@/store/config';
import { Skeleton, EmptyState } from '@/components/ui';
import { DeptIcon } from '@/components/tickets/badges';
import { TicketRow } from './TicketsPage';
import type { Ticket, KbArticle } from '@/lib/types';

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

export default function DashboardPage() {
  const { user, isStaff } = useAuth();
  const { companies, settings } = useConfig();
  const { data: summary } = useQuery({ queryKey: ['summary'], queryFn: () => api.get('/tickets/summary') });
  const { data: recent, isLoading } = useQuery({ queryKey: ['tickets', { view: isStaff ? 'open' : undefined, per_page: 6, sort: 'updated' }], queryFn: () => api.get<{ items: Ticket[] }>('/tickets', { view: isStaff ? 'open' : undefined, per_page: 6, sort: 'updated' }) });
  const { data: unread } = useQuery({ queryKey: ['tickets', { view: 'unread', per_page: 5 }], queryFn: () => api.get<{ items: Ticket[] }>('/tickets', { view: 'unread', per_page: 5 }) });
  const { data: kb } = useQuery({ queryKey: ['kb', ''], queryFn: () => api.get<{ items: KbArticle[] }>('/kb') });

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'صبح بخیر' : hour < 17 ? 'ظهر بخیر' : 'عصر بخیر';

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">{greet}، {user?.name?.split(' ')[0]} 👋</h1>
          <p className="mt-1 text-sm text-slate-500">{isStaff ? 'خلاصه وضعیت صندوق پشتیبانی' : `به ${settings.site_title} خوش آمدید.`}</p>
        </div>
        <Link to="/tickets/new" className="btn-primary"><PlusCircle className="h-4 w-4" /> ثبت تیکت جدید</Link>
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
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-base font-bold"><span className="h-2 w-2 rounded-full bg-brand" /> پیام‌های خوانده‌نشده</h2>
              <div className="space-y-3">{unread.items.map((t) => <TicketRow key={t.id} t={t} staff={isStaff} compact />)}</div>
            </section>
          )}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-bold">{isStaff ? 'تیکت‌های در جریان' : 'آخرین تیکت‌ها'}</h2>
              <Link to="/tickets" className="flex items-center gap-1 text-xs text-brand hover:underline">مشاهده همه <ArrowLeft className="h-3.5 w-3.5" /></Link>
            </div>
            {isLoading ? (
              <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
            ) : !recent?.items.length ? (
              <div className="card"><EmptyState title="تیکتی وجود ندارد" description={isStaff ? 'همه تیکت‌ها رسیدگی شده‌اند. آفرین!' : 'برای ارتباط با بخش‌های مختلف، تیکت جدید ثبت کنید.'} action={!isStaff && <Link to="/tickets/new" className="btn-primary">ثبت تیکت</Link>} /></div>
            ) : (
              <div className="space-y-3">{recent.items.map((t) => <TicketRow key={t.id} t={t} staff={isStaff} compact />)}</div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          {!isStaff && (
            <section className="card p-4">
              <h2 className="mb-3 text-base font-bold">شرکت‌ها و بخش‌های پشتیبانی</h2>
              <div className="space-y-4">
                {companies.map((c) => (
                  <div key={c.id}>
                    <Link to={`/tickets/new?company=${c.id}`} className="mb-1 flex items-center gap-2 text-sm font-bold text-brand hover:underline">
                      {c.logo ? <img src={c.logo} alt="" className="h-6 w-auto object-contain" /> : null}
                      {c.name}
                    </Link>
                    <ul className="space-y-0.5">
                      {c.departments?.map((d) => (
                        <li key={d.id}>
                          <Link to={`/tickets/new?company=${c.id}&department=${d.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-slate-50 dark:hover:bg-slate-800">
                            <span className="text-brand"><DeptIcon name={d.icon} className="h-4 w-4" /></span>
                            <span className="text-sm">{d.name}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}
          {!isStaff && (
            <section className="card bg-gradient-to-br from-brand to-brand-dark p-4 text-white">
              <h2 className="text-base font-bold">امکانات ارسال</h2>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex items-center gap-2"><FileUp className="h-4 w-4" /> ارسال فایل، سند و نسخه پشتیبان</li>
                <li className="flex items-center gap-2"><Video className="h-4 w-4" /> ارسال تصویر و ویدیو از صفحه</li>
                <li className="flex items-center gap-2"><Mic className="h-4 w-4" /> ضبط پیام صوتی در مرورگر</li>
              </ul>
            </section>
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
          {settings.working_hours && (
            <section className="card p-4 text-sm">
              <h2 className="mb-1 font-bold">ساعات پاسخ‌گویی</h2>
              <p className="text-slate-500">{settings.working_hours}</p>
              {settings.support_phone && <p className="mt-2 ltr text-right num text-slate-600 dark:text-slate-300">{faNum(settings.support_phone)}</p>}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
