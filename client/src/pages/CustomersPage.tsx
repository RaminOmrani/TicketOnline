import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, PlusCircle, Ticket } from 'lucide-react';
import { api } from '@/lib/api';
import { faNum, timeAgo } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { Avatar, EmptyState, Pagination, SearchInput, Skeleton } from '@/components/ui';
import type { User } from '@/lib/types';

export default function CustomersPage() {
  const { isAdmin } = useAuth();
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => { setDq(q); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, isLoading } = useQuery({ queryKey: ['customers', dq, page], queryFn: () => api.get<{ items: User[]; total: number; pages: number }>('/admin/customers', { q: dq, page, per_page: 25 }), placeholderData: (p) => p });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div><h1 className="flex items-center gap-2 text-xl font-extrabold"><Users className="h-5 w-5 text-brand" /> مشتریان</h1><p className="text-xs text-slate-500">{data ? `${faNum(data.total)} مشتری` : ''}</p></div>
        <div className="mr-auto flex items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="نام، شرکت، ایمیل، موبایل…" className="w-64" />
          {isAdmin && <Link to="/admin/users?new=customer" className="btn-primary"><PlusCircle className="h-4 w-4" /> مشتری جدید</Link>}
        </div>
      </div>
      {isLoading && !data ? (
        <Skeleton className="h-96" />
      ) : !data?.items.length ? (
        <div className="card"><EmptyState icon={<Users />} title="مشتری یافت نشد" /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">مشتری</th>
                  <th className="px-4 py-3 text-start font-medium">تماس</th>
                  <th className="px-4 py-3 text-center font-medium">تیکت‌ها</th>
                  <th className="px-4 py-3 text-center font-medium">باز</th>
                  <th className="px-4 py-3 text-start font-medium">آخرین فعالیت</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.items.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar user={c} size="sm" />
                        <div><div className="font-semibold">{c.name}</div>{c.company && <div className="text-xs text-slate-500">{c.company}</div>}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500"><div className="ltr text-right">{c.email}</div><div className="ltr text-right num">{faNum(c.mobile || '')}</div></td>
                    <td className="px-4 py-3 text-center num">{faNum(c.ticket_count || 0)}</td>
                    <td className="px-4 py-3 text-center num">{c.open_count ? <span className="chip bg-amber-100 text-amber-700">{faNum(c.open_count)}</span> : '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{c.last_seen_at ? timeAgo(c.last_seen_at) : '—'}</td>
                    <td className="px-4 py-3 text-end">
                      <div className="flex justify-end gap-1">
                        <Link to={`/tickets?customer_id=${c.id}`} className="btn-ghost btn-sm"><Ticket className="h-3.5 w-3.5" /> تیکت‌ها</Link>
                        <Link to={`/tickets/new?customer=${c.id}`} className="btn-secondary btn-sm">تیکت جدید</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 p-3 dark:border-slate-800"><Pagination page={page} pages={data.pages} onChange={setPage} total={data.total} /></div>
        </div>
      )}
    </div>
  );
}
