import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  LayoutDashboard, Ticket, PlusCircle, BookOpen, Settings, Users, Building2, Building, MessageSquareText, BarChart3, LogOut, Bell, Menu, X, Moon, Sun, User as UserIcon, ChevronDown, Inbox, ScrollText, CheckCheck, ShieldCheck, Activity, ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/store/auth';
import { useConfig } from '@/store/config';
import { useRealtime } from '@/store/realtime';
import { api } from '@/lib/api';
import { faNum, timeAgo } from '@/lib/format';
import { Logo } from '@/components/Logo';
import { Avatar, Dropdown, MenuItem, EmptyState } from '@/components/ui';
import type { Notification } from '@/lib/types';

function NavItem({ to, icon, label, badge, end }: { to: string; icon: React.ReactNode; label: string; badge?: number; end?: boolean }) {
  const location = useLocation();
  const [toPath, toSearch = ''] = to.split('?');
  const active = toSearch
    ? location.pathname === toPath && location.search === `?${toSearch}`
    : end
      ? location.pathname === toPath && !location.search
      : location.pathname === toPath || (location.pathname.startsWith(toPath + '/') && location.pathname !== '/tickets/new');
  return (
    <Link to={to} className={clsx('nav-item', active && 'active')}>
      <span className="[&>svg]:h-5 [&>svg]:w-5">{icon}</span>
      <span className="flex-1">{label}</span>
      {!!badge && <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">{faNum(badge)}</span>}
    </Link>
  );
}

function NotificationBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  // Read notifications are only kept for 5 minutes by the server, so poll a bit more often.
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: () => api.get<{ items: Notification[]; unread: number }>('/notifications?limit=25'), refetchInterval: 45_000 });
  const unread = data?.unread || 0;
  const open = async (n: Notification, close: () => void) => {
    close();
    if (!n.is_read) api.post(`/notifications/${n.id}/read`).then(() => qc.invalidateQueries({ queryKey: ['notifications'] }));
    if (n.ticket_id) navigate(`/tickets/${n.ticket_id}`);
  };
  const readAll = () => api.post('/notifications/read-all').then(() => qc.invalidateQueries({ queryKey: ['notifications'] }));
  return (
    <Dropdown
      width="w-80 sm:w-96"
      trigger={
        <button className="btn-icon relative" aria-label="اعلان‌ها">
          <Bell className="h-5 w-5" />
          {unread > 0 && <span className="absolute -left-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{faNum(unread > 99 ? '99+' : unread)}</span>}
        </button>
      }
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-sm font-bold">اعلان‌ها</span>
            {unread > 0 && (
              <button className="flex items-center gap-1 text-xs text-brand" onClick={readAll}>
                <CheckCheck className="h-3.5 w-3.5" /> خواندن همه
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {!data?.items.length ? (
              <EmptyState icon={<Bell />} title="اعلان جدیدی ندارید" />
            ) : (
              data.items.map((n) => (
                <button key={n.id} onClick={() => open(n, close)} className={clsx('flex w-full gap-3 rounded-lg px-2.5 py-2.5 text-start transition hover:bg-slate-100 dark:hover:bg-slate-800', !n.is_read ? 'bg-brand/5' : 'opacity-60')}>
                  <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.is_read ? 'bg-transparent' : 'bg-brand')} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{n.title}</span>
                    {n.body && <span className="block truncate text-xs text-slate-500">{n.body}</span>}
                    <span className="block text-[11px] text-slate-400">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
          <div className="border-t border-slate-100 px-2 pt-1.5 text-[10.5px] text-slate-400 dark:border-slate-800">اعلان‌های خوانده‌شده پس از ۵ دقیقه به‌طور خودکار حذف می‌شوند.</div>
        </div>
      )}
    </Dropdown>
  );
}

export default function AppShell() {
  const { user, logout, isStaff, isAdmin } = useAuth();
  const { theme, toggleTheme, settings } = useConfig();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  useRealtime();

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      const t = setTimeout(() => Notification.requestPermission().catch(() => {}), 4000);
      return () => clearTimeout(t);
    }
  }, []);

  const { data: summary } = useQuery({ queryKey: ['summary'], queryFn: () => api.get('/tickets/summary'), enabled: !!user, refetchInterval: 90_000 });

  const nav = (
    <nav className="flex flex-1 flex-col gap-1">
      <NavItem to="/" end icon={<LayoutDashboard />} label="داشبورد" />
      {isStaff ? (
        <>
          <NavItem to="/tickets" end icon={<Inbox />} label="صندوق تیکت‌ها" badge={summary?.unread} />
          <NavItem to="/tickets?view=mine" icon={<Ticket />} label="تیکت‌های من" badge={summary?.mine} />
          <NavItem to="/tickets?view=unassigned" icon={<ShieldCheck />} label="تخصیص‌نیافته" badge={summary?.unassigned} />
        </>
      ) : (
        <NavItem to="/tickets" icon={<Ticket />} label="سوابق تیکت‌ها" badge={summary?.unread} />
      )}
      <NavItem to="/tickets/new" icon={<PlusCircle />} label="ایجاد تیکت جدید" />
      <NavItem to="/kb" icon={<BookOpen />} label="راهنما و مقالات" />
      {settings.status_url && (
        <a href={settings.status_url} target="_blank" rel="noopener noreferrer" className="nav-item">
          <span className="[&>svg]:h-5 [&>svg]:w-5"><Activity /></span>
          <span className="flex-1">{settings.status_label || 'وضعیت سرویس‌ها'}</span>
          <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
        </a>
      )}
      {isStaff && <NavItem to="/customers" icon={<Users />} label="مشتریان" />}
      {isStaff && <NavItem to="/canned" icon={<MessageSquareText />} label="پاسخ‌های آماده" />}
      {isAdmin && (
        <>
          <div className="mt-4 mb-1 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">مدیریت</div>
          <NavItem to="/admin" end icon={<BarChart3 />} label="گزارش‌ها و آمار" />
          <NavItem to="/admin/companies" icon={<Building />} label="شرکت‌ها و برندها" />
          <NavItem to="/admin/departments" icon={<Building2 />} label="بخش‌ها" />
          <NavItem to="/admin/users" icon={<Users />} label="کاربران و کارشناسان" />
          <NavItem to="/admin/kb" icon={<ScrollText />} label="مدیریت مقالات" />
          <NavItem to="/admin/settings" icon={<Settings />} label="تنظیمات" />
        </>
      )}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-l border-slate-200 bg-white px-3 py-4 dark:border-slate-800 dark:bg-surface lg:flex">
        <div className="mb-6 px-2">
          <Logo />
        </div>
        {nav}
        <div className="mt-auto rounded-2xl bg-gradient-to-br from-brand-deep to-brand p-3.5 text-xs text-white/85 dark:from-slate-800 dark:to-slate-700 dark:text-slate-300">
          <div className="mb-1 font-bold text-white">{settings.slogan || settings.company_name}</div>
          {settings.working_hours && <div className="leading-5">{settings.working_hours}</div>}
          {settings.support_phone && <div className="mt-1 num">{faNum(settings.support_phone)}</div>}
          {settings.support_email && <div className="mt-0.5 ltr text-right">{settings.support_email}</div>}
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute right-0 top-0 flex h-full w-72 flex-col bg-white px-3 py-4 shadow-pop dark:bg-surface animate-fade-in">
            <div className="mb-6 flex items-center justify-between px-2">
              <Logo />
              <button className="btn-icon" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur dark:border-slate-800 dark:bg-surface/85 sm:px-6">
          <button className="btn-icon lg:hidden" onClick={() => setOpen(true)} aria-label="منو">
            <Menu className="h-5 w-5" />
          </button>
          <div className="lg:hidden">
            <Logo compact />
          </div>
          <div className="flex-1" />
          <button className="btn-icon" onClick={toggleTheme} aria-label="تغییر تم">
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <NotificationBell />
          <Dropdown
            trigger={
              <button className="flex items-center gap-2 rounded-xl px-1.5 py-1 transition hover:bg-slate-100 dark:hover:bg-slate-800">
                <Avatar user={user} size="sm" />
                <span className="hidden text-start sm:block">
                  <span className="block max-w-[140px] truncate text-sm font-semibold leading-4">{user?.name}</span>
                  <span className="block text-[11px] text-slate-500">{user?.role === 'admin' ? 'مدیر' : user?.role === 'agent' ? 'کارشناس' : user?.company || 'مشتری'}</span>
                </span>
                <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
              </button>
            }
          >
            {(close) => (
              <>
                <MenuItem icon={<UserIcon />} onClick={() => { close(); navigate('/profile'); }}>پروفایل و تنظیمات</MenuItem>
                <MenuItem icon={<LogOut />} danger onClick={() => { close(); logout().then(() => navigate('/login')); }}>خروج از حساب</MenuItem>
              </>
            )}
          </Dropdown>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
