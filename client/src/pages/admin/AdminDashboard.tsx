import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Download, Star, Timer, Users, Wifi, Inbox, AlertTriangle, UserCheck, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { faNum, formatMinutes, formatShortDate } from '@/lib/format';
import { Avatar, PageLoader, Tabs } from '@/components/ui';
import { useConfig } from '@/store/config';
import { CompanyBadge } from '@/components/Logo';
import { STATUS_META, PRIORITY_META, StatusBadge } from '@/components/tickets/badges';

function Kpi({ label, value, sub, icon, color }: { label: string; value: string; sub?: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="card flex items-center gap-4 p-4">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color} [&>svg]:h-6 [&>svg]:w-6`}>{icon}</span>
      <div><div className="text-2xl font-extrabold num">{value}</div><div className="text-xs text-slate-500">{label}</div>{sub && <div className="text-[11px] text-slate-400">{sub}</div>}</div>
    </div>
  );
}

const tooltipStyle = { borderRadius: 12, border: '1px solid #e2e8f0', fontFamily: 'Vazirmatn', fontSize: 12, direction: 'rtl' as const };

export default function AdminDashboard() {
  const [days, setDays] = useState<'7' | '30' | '90'>('30');
  const [companyId, setCompanyId] = useState<number>(0);
  const { companies } = useConfig();
  const { data, isLoading } = useQuery({ queryKey: ['admin-stats', days, companyId], queryFn: () => api.get(`/admin/stats?days=${days}${companyId ? `&company_id=${companyId}` : ''}`) });
  if (isLoading || !data) return <PageLoader />;
  const t = data.totals;
  const n = (v: any) => Number(v) || 0;
  const perDay = data.per_day.map((d: any) => ({ ...d, label: formatShortDate(d.day) }));
  const statusData = Object.entries(STATUS_META).map(([k, v]) => ({ name: v.label, value: n(t[k]), key: k }));
  const statusColors: Record<string, string> = { open: '#3b82f6', in_progress: '#8b5cf6', waiting_customer: '#f59e0b', resolved: '#10b981', closed: '#94a3b8' };
  const priorityData = Object.entries(PRIORITY_META).map(([k, v]) => ({ name: v.label, value: n(data.by_priority.find((p: any) => p.priority === k)?.c) }));
  const ratings = [1, 2, 3, 4, 5].map((r) => ({ name: `${faNum(r)} ستاره`, value: n(data.ratings.find((x: any) => x.rating === r)?.c) }));

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div><h1 className="flex items-center gap-2 text-xl font-extrabold"><BarChart3 className="h-5 w-5 text-brand" /> گزارش‌ها و آمار{companyId ? ` — ${companies.find((c) => c.id === companyId)?.name || ''}` : ''}</h1><p className="text-xs text-slate-500">{faNum(data.online)} کاربر آنلاین</p></div>
        <div className="mr-auto flex flex-wrap items-center gap-2">
          {companies.length > 1 && (
            <select className="input w-44" value={companyId} onChange={(e) => setCompanyId(Number(e.target.value))}>
              <option value={0}>همه شرکت‌ها</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <Tabs value={days} onChange={setDays} items={[{ value: '7', label: '۷ روز' }, { value: '30', label: '۳۰ روز' }, { value: '90', label: '۹۰ روز' }]} />
          <a href="/api/admin/export/tickets.csv" className="btn-secondary btn-sm"><Download className="h-4 w-4" /> خروجی CSV</a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="تیکت جدید در بازه" value={faNum(n(t.created_period))} sub={`مجموع کل: ${faNum(n(t.total))}`} icon={<Inbox />} color="bg-brand/10 text-brand" />
        <Kpi label="حل‌شده در بازه" value={faNum(n(t.resolved_period))} sub={`${faNum(n(t.open) + n(t.in_progress) + n(t.waiting_customer))} تیکت در جریان`} icon={<CheckCircle2 />} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15" />
        <Kpi label="میانگین اولین پاسخ" value={formatMinutes(t.avg_first_response_min)} sub={`میانگین حل: ${formatMinutes(t.avg_resolve_min)}`} icon={<Timer />} color="bg-violet-100 text-violet-600 dark:bg-violet-500/15" />
        <Kpi label="رضایت مشتری (CSAT)" value={t.avg_rating ? `${faNum(t.avg_rating)} / ۵` : '—'} sub={`${faNum(n(t.rated_count))} امتیاز ثبت‌شده`} icon={<Star />} color="bg-amber-100 text-amber-600 dark:bg-amber-500/15" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link to="/tickets?view=unassigned" className="card flex items-center gap-3 p-3 hover:border-brand/40"><UserCheck className="h-5 w-5 text-violet-500" /><span className="text-sm">تخصیص‌نیافته</span><span className="mr-auto font-bold num">{faNum(n(t.unassigned))}</span></Link>
        <Link to="/tickets?view=overdue" className="card flex items-center gap-3 p-3 hover:border-brand/40"><AlertTriangle className="h-5 w-5 text-rose-500" /><span className="text-sm">تأخیر SLA</span><span className="mr-auto font-bold num">{faNum(n(t.overdue))}</span></Link>
        <Link to="/customers" className="card flex items-center gap-3 p-3 hover:border-brand/40"><Users className="h-5 w-5 text-brand" /><span className="text-sm">مشتریان</span><span className="mr-auto font-bold num">{faNum(n(data.customers.total))} <span className="text-xs font-normal text-emerald-600">+{faNum(n(data.customers.new_period))}</span></span></Link>
        <Link to="/admin/users?role=agent" className="card flex items-center gap-3 p-3 hover:border-brand/40"><Wifi className="h-5 w-5 text-emerald-500" /><span className="text-sm">آنلاین</span><span className="mr-auto font-bold num">{faNum(data.online)}</span></Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-bold">روند تیکت‌ها (ایجاد / حل‌شده)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={perDay}>
              <defs>
                <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#A31A1A" stopOpacity={0.35} /><stop offset="95%" stopColor="#A31A1A" stopOpacity={0} /></linearGradient>
                <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.35} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fontFamily: 'Vazirmatn' }} reversed interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} orientation="right" />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'Vazirmatn' }} />
              <Area type="monotone" dataKey="created" name="ایجادشده" stroke="#A31A1A" fill="url(#gc)" strokeWidth={2} />
              <Area type="monotone" dataKey="resolved" name="حل‌شده" stroke="#10b981" fill="url(#gr)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4">
          <h3 className="mb-3 text-sm font-bold">وضعیت فعلی تیکت‌ها</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                {statusData.map((s) => <Cell key={s.key} fill={statusColors[s.key]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <ul className="mt-1 space-y-1 text-xs">
            {statusData.map((s) => <li key={s.key} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: statusColors[s.key] }} />{s.name}<span className="mr-auto num font-semibold">{faNum(s.value)}</span></li>)}
          </ul>
        </div>
      </div>

      {!companyId && data.by_company?.length > 1 && (
        <div className="card p-4">
          <h3 className="mb-3 text-sm font-bold">مقایسه شرکت‌ها / برندها</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500"><tr><th className="py-2 text-start font-medium">شرکت</th><th className="py-2 text-center font-medium">کل تیکت</th><th className="py-2 text-center font-medium">باز</th><th className="py-2 text-center font-medium">جدید در بازه</th><th className="py-2 text-center font-medium">امتیاز</th><th className="py-2"></th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.by_company.map((c: any) => (
                  <tr key={c.id}>
                    <td className="py-2"><CompanyBadge company={c} /></td>
                    <td className="py-2 text-center num">{faNum(n(c.total))}</td>
                    <td className="py-2 text-center num">{faNum(n(c.open))}</td>
                    <td className="py-2 text-center num">{faNum(n(c.created_period))}</td>
                    <td className="py-2 text-center">{c.avg_rating ? <span className="inline-flex items-center gap-1 text-amber-600"><Star className="h-3 w-3 fill-current" />{faNum(c.avg_rating)}</span> : '—'}</td>
                    <td className="py-2 text-end"><button className="text-xs text-brand hover:underline" onClick={() => setCompanyId(c.id)}>گزارش جداگانه</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-bold">عملکرد بخش‌ها</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500"><tr><th className="py-2 text-start font-medium">بخش</th><th className="py-2 text-center font-medium">تیکت</th><th className="py-2 text-center font-medium">باز</th><th className="py-2 text-center font-medium">اولین پاسخ</th><th className="py-2 text-center font-medium">امتیاز</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.by_department.map((d: any) => (
                  <tr key={d.id}>
                    <td className="py-2">{d.name}</td>
                    <td className="py-2 text-center num">{faNum(n(d.total))}</td>
                    <td className="py-2 text-center num">{faNum(n(d.open))}</td>
                    <td className="py-2 text-center">{formatMinutes(d.avg_first_response_min)}</td>
                    <td className="py-2 text-center">{d.avg_rating ? <span className="inline-flex items-center gap-1 text-amber-600"><Star className="h-3 w-3 fill-current" />{faNum(d.avg_rating)}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card p-4">
          <h3 className="mb-3 text-sm font-bold">اولویت تیکت‌های بازه</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={priorityData}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'Vazirmatn' }} reversed />
              <YAxis hide allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" name="تعداد" radius={[8, 8, 0, 0]}>
                {['#94a3b8', '#7f1d1d', '#f97316', '#ef4444'].map((c, i) => <Cell key={i} fill={c} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <h3 className="mb-2 mt-4 text-sm font-bold">توزیع امتیازها</h3>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={ratings} layout="vertical">
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fontFamily: 'Vazirmatn' }} width={60} orientation="right" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" name="تعداد" fill="#f59e0b" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-3 text-sm font-bold">عملکرد کارشناسان</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500"><tr><th className="py-2 text-start font-medium">کارشناس</th><th className="py-2 text-center font-medium">باز</th><th className="py-2 text-center font-medium">حل‌شده</th><th className="py-2 text-center font-medium">پاسخ‌ها</th><th className="py-2 text-center font-medium">امتیاز</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.by_agent.map((a: any) => (
                  <tr key={a.id}>
                    <td className="py-2"><span className="inline-flex items-center gap-2"><Avatar user={a} size="xs" />{a.name}</span></td>
                    <td className="py-2 text-center num">{faNum(n(a.open))}</td>
                    <td className="py-2 text-center num">{faNum(n(a.resolved_period))}</td>
                    <td className="py-2 text-center num">{faNum(n(a.replies_period))}</td>
                    <td className="py-2 text-center">{a.avg_rating ? <span className="inline-flex items-center gap-1 text-amber-600"><Star className="h-3 w-3 fill-current" />{faNum(a.avg_rating)}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card p-4">
          <h3 className="mb-3 text-sm font-bold">آخرین تیکت‌ها</h3>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.recent.map((r: any) => (
              <li key={r.id}>
                <Link to={`/tickets/${r.id}`} className="flex items-center gap-3 py-2 hover:text-brand">
                  <span className="num font-mono text-[11px] text-slate-400" dir="ltr">{r.number}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{r.subject}</span>
                  <StatusBadge status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
