import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { PlusCircle, Filter, X } from 'lucide-react';
import { api } from '@/lib/api';
import { faNum } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { useConfig } from '@/store/config';
import { EmptyState, Pagination, SearchInput, Skeleton, Tabs } from '@/components/ui';
import { STATUS_META, PRIORITY_META } from '@/components/tickets/badges';
import { TicketTable } from '@/components/tickets/TicketTable';
import type { Ticket, User } from '@/lib/types';

interface ListResp {
  items: Ticket[];
  total: number;
  page: number;
  pages: number;
}

function useDebounced<T>(v: T, ms = 350) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export default function TicketsPage() {
  const { isStaff, user } = useAuth();
  const { departments, companies } = useConfig();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const dq = useDebounced(q);
  const [showFilters, setShowFilters] = useState(false);

  const get = (k: string) => params.get(k) || '';
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    v ? p.set(k, v) : p.delete(k);
    if (k !== 'page') p.delete('page');
    setParams(p, { replace: true });
  };
  useEffect(() => set('q', dq), [dq]);

  const view = (get('view') || 'all') as any;
  const query = useMemo(() => ({ view: view === 'all' ? undefined : view, status: get('status'), priority: get('priority'), department_id: get('department_id'), company_id: get('company_id'), assignee_id: get('assignee_id'), customer_id: get('customer_id'), q: get('q'), sort: get('sort') || 'updated', page: get('page') || 1, per_page: 20 }), [params]);
  const { data, isLoading } = useQuery<ListResp>({ queryKey: ['tickets', query], queryFn: () => api.get('/tickets', query), placeholderData: (prev) => prev });
  const { data: summary } = useQuery({ queryKey: ['summary'], queryFn: () => api.get('/tickets/summary') });
  const { data: staff } = useQuery({ queryKey: ['staff'], queryFn: () => api.get<{ items: User[] }>('/admin/staff'), enabled: isStaff });

  const tabs = isStaff
    ? [
        { value: 'all', label: 'همه', count: summary?.total },
        { value: 'open', label: 'باز', count: summary ? summary.open + summary.in_progress + summary.waiting_customer : 0 },
        { value: 'unread', label: 'خوانده‌نشده', count: summary?.unread },
        { value: 'mine', label: 'تیکت‌های من', count: summary?.mine },
        { value: 'unassigned', label: 'تخصیص‌نیافته', count: summary?.unassigned },
        { value: 'overdue', label: 'تأخیردار', count: summary?.overdue },
        { value: 'resolved', label: 'حل‌شده', count: summary?.resolved },
        { value: 'closed', label: 'بسته', count: summary?.closed },
      ]
    : [
        { value: 'all', label: 'همه', count: summary?.total },
        { value: 'open', label: 'در جریان', count: summary ? summary.open + summary.in_progress + summary.waiting_customer : 0 },
        { value: 'unread', label: 'پاسخ جدید', count: summary?.unread },
        { value: 'resolved', label: 'حل‌شده', count: summary?.resolved },
        { value: 'closed', label: 'بسته', count: summary?.closed },
      ];

  const activeFilters = ['status', 'priority', 'department_id', 'company_id', 'assignee_id', 'customer_id'].filter((k) => get(k)).length;
  const companyFilter = get('company_id');
  // Departments grouped by company so same-named departments (e.g. «فنی») are never ambiguous.
  const deptGroups = companies
    .filter((c) => !companyFilter || String(c.id) === companyFilter)
    .map((c) => ({ company: c, depts: departments.filter((d) => d.company_id === c.id) }))
    .filter((g) => g.depts.length);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-extrabold">{isStaff ? 'صندوق تیکت‌ها' : 'سوابق تیکت‌ها'}</h1>
          <p className="text-xs text-slate-500">{data ? `${faNum(data.total)} تیکت` : ' '}</p>
        </div>
        <div className="mr-auto flex items-center gap-2">
          <Link to="/tickets/new" className="btn-primary"><PlusCircle className="h-4 w-4" /> ایجاد تیکت جدید</Link>
        </div>
      </div>

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <Tabs value={view} onChange={(v) => set('view', v === 'all' ? '' : v)} items={tabs as any} />
        </div>
        <div className="flex items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="جستجو در عنوان یا شماره تیکت…" className="w-full sm:w-64" />
          <button className={clsx('btn-secondary relative', showFilters && 'ring-2 ring-brand/30')} onClick={() => setShowFilters((s) => !s)}>
            <Filter className="h-4 w-4" /> فیلتر
            {activeFilters > 0 && <span className="absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] text-white">{faNum(activeFilters)}</span>}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6 animate-fade-in">
          {companies.length > 1 && (
            <select className="input" value={companyFilter} onChange={(e) => { const p = new URLSearchParams(params); e.target.value ? p.set('company_id', e.target.value) : p.delete('company_id'); p.delete('department_id'); p.delete('page'); setParams(p, { replace: true }); }}>
              <option value="">همه شرکت‌ها</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <select className="input" value={get('status')} onChange={(e) => set('status', e.target.value)}>
            <option value="">همه وضعیت‌ها</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="input" value={get('priority')} onChange={(e) => set('priority', e.target.value)}>
            <option value="">همه اولویت‌ها</option>
            {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="input" value={get('department_id')} onChange={(e) => set('department_id', e.target.value)}>
            <option value="">همه بخش‌ها</option>
            {deptGroups.length > 1
              ? deptGroups.map((g) => (
                  <optgroup key={g.company.id} label={g.company.name}>
                    {g.depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </optgroup>
                ))
              : deptGroups[0]?.depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {isStaff && (
            <select className="input" value={get('assignee_id')} onChange={(e) => set('assignee_id', e.target.value)}>
              <option value="">همه کارشناسان</option>
              <option value="me">من ({user?.name})</option>
              <option value="none">بدون کارشناس</option>
              {staff?.items.filter((s) => s.id !== user?.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <select className="input" value={get('sort') || 'updated'} onChange={(e) => set('sort', e.target.value)}>
            <option value="updated">آخرین به‌روزرسانی</option>
            <option value="created">تاریخ ایجاد</option>
            <option value="priority">اولویت</option>
            {isStaff && <option value="due">مهلت پاسخ‌گویی</option>}
          </select>
          {(activeFilters > 0 || get('customer_id')) && (
            <button className="btn-ghost btn-sm sm:col-span-2 lg:col-span-6 justify-self-start" onClick={() => setParams(new URLSearchParams(get('view') ? { view: get('view') } : {}), { replace: true })}>
              <X className="h-4 w-4" /> حذف فیلترها
            </button>
          )}
        </div>
      )}

      {isLoading && !data ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : !data?.items.length ? (
        <div className="card">
          <EmptyState title="تیکتی یافت نشد" description={get('q') || activeFilters ? 'فیلترها یا عبارت جستجو را تغییر دهید.' : isStaff ? 'هنوز تیکتی در این دسته وجود ندارد.' : 'اولین تیکت خود را ثبت کنید تا کارشناسان ما پاسخ دهند.'} action={!isStaff && <Link to="/tickets/new" className="btn-primary"><PlusCircle className="h-4 w-4" /> ایجاد تیکت جدید</Link>} />
        </div>
      ) : (
        <div className="space-y-3">
          <TicketTable items={data.items} staff={isStaff} />
          <Pagination page={data.page} pages={data.pages} total={data.total} onChange={(p) => set('page', String(p))} />
        </div>
      )}
    </div>
  );
}
