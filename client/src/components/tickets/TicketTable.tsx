import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Paperclip, AlertTriangle, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { faNum, formatDateTime, timeAgo, formatShortDate, formatTime } from '@/lib/format';
import { Avatar } from '@/components/ui';
import { StatusBadge, PriorityBadge, DeptIcon } from './badges';
import type { Ticket } from '@/lib/types';

/** Compact date cell: «۲۲ شهریور» over «۱۰:۱۸» */
function DateCell({ iso, relative }: { iso?: string | null; relative?: boolean }) {
  if (!iso) return <span className="text-slate-400">—</span>;
  return (
    <span className="block leading-5 num" title={formatDateTime(iso)}>
      {relative ? (
        <span className="block text-slate-600 dark:text-slate-300">{timeAgo(iso)}</span>
      ) : (
        <>
          <span className="block text-slate-700 dark:text-slate-200">{formatShortDate(iso)}</span>
          <span className="block text-[11px] text-slate-400">{formatTime(iso)}</span>
        </>
      )}
    </span>
  );
}

export type SortKey = 'number' | 'subject' | 'customer' | 'company' | 'department' | 'created' | 'updated' | 'assignee' | 'status';

interface TableProps {
  items: Ticket[];
  staff: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
  onSort?: (key: SortKey) => void;
}

function Th({ label, k, sort, order, onSort }: { label: string; k: SortKey; sort?: string; order?: 'asc' | 'desc'; onSort?: (k: SortKey) => void }) {
  const active = sort === k;
  return (
    <th className="px-4 py-2.5 text-right font-bold">
      <button type="button" onClick={() => onSort?.(k)} className={clsx('group/th inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition hover:text-brand', active && 'text-brand')} title="مرتب‌سازی">
        {label}
        {active ? (order === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />) : <ChevronsUpDown className="h-3.5 w-3.5 opacity-0 transition group-hover/th:opacity-60" />}
      </button>
    </th>
  );
}

/**
 * Ticket list in the classic "portal" layout (like hub.iranserver.com): one clean
 * row per ticket with clearly separated columns. Whole row opens the ticket;
 * column headers sort. Falls back to stacked cards on small screens.
 */
export function TicketTable({ items, staff, sort, order, onSort }: TableProps) {
  const navigate = useNavigate();
  const h = { sort, order, onSort };
  return (
    <div className="card overflow-hidden">
      {/* ---- Desktop table ---- */}
      <div className="hidden md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-[12px] font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
              <Th label="شماره تیکت" k="number" {...h} />
              <Th label="عنوان تیکت" k="subject" {...h} />
              {staff && <Th label="مشتری" k="customer" {...h} />}
              <Th label="شرکت / محصول" k="company" {...h} />
              <Th label="واحد" k="department" {...h} />
              <Th label="تاریخ ایجاد" k="created" {...h} />
              <Th label="آخرین به‌روزرسانی" k="updated" {...h} />
              {staff && <Th label="کارشناس" k="assignee" {...h} />}
              <Th label="وضعیت" k="status" {...h} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((t) => {
              const unread = t.unread > 0;
              return (
                <tr
                  key={t.id}
                  onClick={(e) => { if ((e.target as HTMLElement).closest('a')) return; navigate(`/tickets/${t.id}`); }}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/tickets/${t.id}`)}
                  tabIndex={0}
                  className={clsx('group cursor-pointer transition hover:bg-brand/[0.035] focus:outline-none focus-visible:bg-brand/[0.06] dark:hover:bg-brand/10', unread && 'bg-brand/[0.03] dark:bg-brand/[0.08]')}
                >
                  <td className="px-4 py-3.5 align-top">
                    <Link to={`/tickets/${t.id}`} className="num font-mono text-[13px] font-semibold text-slate-700 hover:text-brand dark:text-slate-200">
                      <bdi dir="ltr">{faNum(t.number)}</bdi>
                    </Link>
                  </td>
                  <td className="max-w-[320px] px-4 py-3.5 align-top">
                    <Link to={`/tickets/${t.id}`} className="block">
                      <span className={clsx('flex items-center gap-2 text-[14px] leading-6 text-slate-800 hover:text-brand dark:text-slate-100', unread ? 'font-extrabold' : 'font-semibold')} dir="rtl">
                        <bdi className="truncate">{t.subject}</bdi>
                        {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" title={`${faNum(t.unread)} پیام جدید`} />}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                        <PriorityBadge priority={t.priority} />
                        {!!t.attachment_count && <span className="inline-flex items-center gap-0.5"><Paperclip className="h-3 w-3" />{faNum(t.attachment_count)}</span>}
                        {staff && t.overdue && <span className="inline-flex items-center gap-0.5 text-rose-600"><AlertTriangle className="h-3 w-3" /> تأخیر</span>}
                      </span>
                    </Link>
                  </td>
                  {staff && (
                    <td className="px-4 py-3.5 align-top">
                      <span className="flex items-center gap-2">
                        <Avatar user={t.customer} size="xs" />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium">{t.customer.name}</span>
                          {t.customer.company && <span className="block truncate text-[11px] text-slate-400">{t.customer.company}</span>}
                        </span>
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3.5 align-top">
                    <span className="block text-[13px] font-medium text-brand">{t.company?.name || '—'}</span>
                    {t.product && <span className="block text-[11px] text-slate-400">{t.product}</span>}
                  </td>
                  <td className="px-4 py-3.5 align-top">
                    <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-700 dark:text-slate-200">
                      <DeptIcon name={t.department?.icon} className="h-3.5 w-3.5 text-slate-400" />
                      {t.department?.name}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 align-top text-[13px]"><DateCell iso={t.created_at} /></td>
                  <td className="px-4 py-3.5 align-top text-[13px]"><DateCell iso={t.updated_at} relative /></td>
                  {staff && (
                    <td className="px-4 py-3.5 align-top text-[13px]">
                      {t.assignee ? <span className="inline-flex items-center gap-1.5"><Avatar user={t.assignee} size="xs" />{t.assignee.name}</span> : <span className="text-amber-600">بدون کارشناس</span>}
                    </td>
                  )}
                  <td className="px-4 py-3.5 align-top"><StatusBadge status={t.status} customerView={!staff} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ---- Mobile cards ---- */}
      <div className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
        {items.map((t) => {
          const unread = t.unread > 0;
          return (
            <Link key={t.id} to={`/tickets/${t.id}`} className={clsx('block p-4 transition active:bg-slate-50 dark:active:bg-slate-800', unread && 'bg-brand/[0.03]')}>
              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                <span className="num font-mono"><bdi dir="ltr">{faNum(t.number)}</bdi></span>
                <StatusBadge status={t.status} customerView={!staff} />
              </div>
              <h3 className={clsx('mt-1.5 text-[14.5px] leading-6', unread ? 'font-extrabold' : 'font-semibold')} dir="rtl"><bdi>{t.subject}</bdi></h3>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px] text-slate-500">
                <span>شرکت: <span className="text-brand">{t.company?.name || '—'}</span></span>
                <span>واحد: {t.department?.name}</span>
                <span>ایجاد: {formatShortDate(t.created_at)}</span>
                <span>به‌روزرسانی: {timeAgo(t.updated_at)}</span>
                {staff && <span className="col-span-2">مشتری: {t.customer.name}</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** Minimal list for dashboards: subject + status + time, nothing else. */
export function TicketMiniList({ items, staff }: { items: Ticket[]; staff: boolean }) {
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {items.map((t) => {
        const unread = t.unread > 0;
        return (
          <li key={t.id}>
            <Link to={`/tickets/${t.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <span className={clsx('h-2 w-2 shrink-0 rounded-full', unread ? 'bg-brand' : 'bg-transparent')} />
              <span className="min-w-0 flex-1">
                <span className={clsx('block truncate text-[14px] leading-6', unread ? 'font-extrabold' : 'font-medium')} dir="rtl"><bdi>{t.subject}</bdi></span>
                <span className="block truncate text-[11px] text-slate-400">
                  <bdi dir="ltr">{faNum(t.number)}</bdi> · {t.company?.name ? `${t.company.name} · ` : ''}{t.department?.name}{staff ? ` · ${t.customer.name}` : ''}
                </span>
              </span>
              <span className="hidden text-[11px] text-slate-400 sm:block">{timeAgo(t.updated_at)}</span>
              <StatusBadge status={t.status} customerView={!staff} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
