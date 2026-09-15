import { useState } from 'react';
import clsx from 'clsx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Star, Mail, Phone, Building2, Clock, Tag, X, Plus, ExternalLink, History, CalendarClock, MessageSquare, Paperclip, Hash } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { faNum, formatDateTime, timeAgo, timeLeft, formatMinutes } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { useConfig } from '@/store/config';
import { Avatar, Modal } from '@/components/ui';
import { CompanyBadge } from '@/components/Logo';
import { STATUS_META, PRIORITY_META, StatusBadge, DeptChip } from './badges';
import { Timeline } from '@/components/thread/Timeline';
import type { Ticket, TicketEvent, User } from '@/lib/types';

interface Props {
  ticket: Ticket;
  events: TicketEvent[];
  customerStats?: { total: number; open: number; avg_rating: number | null; recent: { id: number; number: string; subject: string; status: string; created_at: string }[] };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 text-end font-medium">{children}</span>
    </div>
  );
}

export function RatingWidget({ ticket }: { ticket: Ticket }) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(ticket.rating || 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  if (ticket.rated_at) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
        <div className="flex items-center gap-1 text-amber-500">
          {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={clsx('h-5 w-5', i <= (ticket.rating || 0) && 'fill-current')} />)}
        </div>
        <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">از بازخورد شما سپاسگزاریم.</p>
        {ticket.rating_comment && <p className="mt-1 text-xs text-slate-500">«{ticket.rating_comment}»</p>}
      </div>
    );
  }
  const submit = async () => {
    if (!rating) return toast.error('لطفاً امتیاز را انتخاب کنید.');
    setSaving(true);
    try {
      await api.post(`/tickets/${ticket.id}/rate`, { rating, comment: comment || null });
      qc.invalidateQueries({ queryKey: ['ticket', ticket.id] });
      toast.success('امتیاز شما ثبت شد. متشکریم!');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
      <div className="text-sm font-bold">کیفیت پشتیبانی چطور بود؟</div>
      <div className="mt-2 flex items-center gap-1" dir="ltr" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} onMouseEnter={() => setHover(i)} onClick={() => setRating(i)} className="p-0.5 transition hover:scale-110" aria-label={`${i} ستاره`}>
            <Star className={clsx('h-7 w-7 transition', i <= (hover || rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
          </button>
        ))}
      </div>
      <textarea className="input mt-3 min-h-[70px] text-xs" placeholder="نظر شما (اختیاری)" value={comment} onChange={(e) => setComment(e.target.value)} />
      <button className="btn-primary btn-sm mt-2 w-full" onClick={submit} disabled={saving}>ثبت امتیاز</button>
    </div>
  );
}

export function TicketSidebar({ ticket, events, customerStats }: Props) {
  const { isStaff, isAdmin, user } = useAuth();
  const cfg = useConfig();
  const departments = cfg.departments;
  const products = ((cfg.companies.find((c) => c.id === ticket.company?.id)?.products as string[]) || []);
  const qc = useQueryClient();
  const [tagInput, setTagInput] = useState('');
  const [showTimeline, setShowTimeline] = useState(false);
  const [dueOpen, setDueOpen] = useState(false);
  const [dueVal, setDueVal] = useState('');
  const { data: agents } = useQuery({ queryKey: ['ticket-agents', ticket.id, ticket.department.id], queryFn: () => api.get<{ agents: (User & { load: number; in_department: boolean })[] }>(`/tickets/${ticket.id}/agents`), enabled: isStaff });

  const update = async (patch: any, msg = 'به‌روزرسانی شد') => {
    try {
      await api.patch(`/tickets/${ticket.id}`, patch);
      qc.invalidateQueries({ queryKey: ['ticket', ticket.id] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      toast.success(msg);
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (ticket.tags.includes(t)) return setTagInput('');
    update({ tags: [...ticket.tags, t] }, 'برچسب افزوده شد');
    setTagInput('');
  };
  const sla = timeLeft(ticket.due_at);
  const active = !['resolved', 'closed'].includes(ticket.status);
  const isCustomer = user?.role === 'customer';

  return (
    <div className="space-y-4">
      {isCustomer && ['resolved', 'closed'].includes(ticket.status) && <RatingWidget ticket={ticket} />}

      {/* Properties */}
      <div className="card p-4">
        <h3 className="mb-1 text-sm font-bold">{isStaff ? 'مدیریت تیکت' : 'مشخصات تیکت'}</h3>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <Row label="شماره تیکت"><span className="num inline-flex items-center gap-1 font-mono text-[13px] font-bold text-brand"><Hash className="h-3 w-3" /><bdi dir="ltr">{faNum(ticket.number)}</bdi></span></Row>
          {!isStaff && <Row label="وضعیت"><StatusBadge status={ticket.status} customerView /></Row>}
          {!isStaff && <Row label="اولویت"><span className={PRIORITY_META[ticket.priority].color}>{PRIORITY_META[ticket.priority].label}</span></Row>}
          {ticket.company && <Row label="شرکت"><CompanyBadge company={ticket.company} /></Row>}
          {isStaff && <Row label="وضعیت">
            {isStaff ? (
              <select className="input py-1 text-xs" value={ticket.status} onChange={(e) => update({ status: e.target.value }, 'وضعیت تغییر کرد')}>
                {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            ) : (
              <StatusBadge status={ticket.status} customerView />
            )}
          </Row>}
          {isStaff && <Row label="اولویت">
            {isStaff ? (
              <select className="input py-1 text-xs" value={ticket.priority} onChange={(e) => update({ priority: e.target.value }, 'اولویت تغییر کرد')}>
                {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            ) : (
              <span className={PRIORITY_META[ticket.priority].color}>{PRIORITY_META[ticket.priority].label}</span>
            )}
          </Row>}
          <Row label="بخش">
            {isStaff ? (
              <select className="input py-1 text-xs" value={ticket.department.id} onChange={(e) => update({ department_id: Number(e.target.value) }, 'تیکت ارجاع داده شد')}>
                {cfg.companies.map((c) => (
                  <optgroup key={c.id} label={c.name}>
                    {departments.filter((d) => d.company_id === c.id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </optgroup>
                ))}
              </select>
            ) : (
              <DeptChip department={ticket.department} />
            )}
          </Row>
          {isStaff && (
            <Row label="کارشناس">
              <select className="input py-1 text-xs" value={ticket.assignee?.id || ''} onChange={(e) => update({ assignee_id: e.target.value ? Number(e.target.value) : null }, 'تخصیص به‌روز شد')}>
                <option value="">— بدون کارشناس —</option>
                {agents?.agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}{a.in_department ? '' : ' (خارج از بخش)'} — {faNum(a.load)} تیکت</option>
                ))}
              </select>
            </Row>
          )}
          {!isStaff && (
            <Row label="وضعیت بررسی">
              {['resolved', 'closed'].includes(ticket.status) ? <span className="text-slate-500">پایان‌یافته</span> : ticket.agent_viewed ? <span className="text-brand">کارشناس در حال بررسی است</span> : <span className="text-slate-500">در صف بررسی</span>}
            </Row>
          )}
          <Row label="محصول">
            {isStaff ? (
              <select className="input py-1 text-xs" value={ticket.product || ''} onChange={(e) => update({ product: e.target.value || null })}>
                <option value="">—</option>
                {products.map((p) => <option key={p} value={p}>{p}</option>)}
                {ticket.product && !products.includes(ticket.product) && <option value={ticket.product}>{ticket.product}</option>}
              </select>
            ) : (
              ticket.product || '—'
            )}
          </Row>
          <Row label="تاریخ ایجاد"><span className="num text-xs" title={timeAgo(ticket.created_at)}>{formatDateTime(ticket.created_at)}</span></Row>
          <Row label="آخرین به‌روزرسانی"><span className="num text-xs" title={formatDateTime(ticket.updated_at)}>{timeAgo(ticket.updated_at)}</span></Row>
          {isStaff && ticket.first_response_at && <Row label="اولین پاسخ">{formatMinutes((Date.parse(ticket.first_response_at) - Date.parse(ticket.created_at)) / 60000)} بعد از ثبت</Row>}
          {ticket.resolved_at && <Row label="حل شده">{formatDateTime(ticket.resolved_at)}</Row>}
          {ticket.closed_at && <Row label="بسته شده">{formatDateTime(ticket.closed_at)}</Row>}
          <Row label="پیام / پیوست"><span className="inline-flex items-center gap-2"><span className="inline-flex items-center gap-0.5"><MessageSquare className="h-3.5 w-3.5 text-slate-400" />{faNum(ticket.message_count || 0)}</span><span className="inline-flex items-center gap-0.5"><Paperclip className="h-3.5 w-3.5 text-slate-400" />{faNum(ticket.attachment_count || 0)}</span></span></Row>
        </div>
      </div>

      {/* SLA (staff only) */}
      {isStaff && ticket.due_at && (
        <div className={clsx('card p-4', active && sla.overdue && 'border-rose-300 bg-rose-50 dark:border-rose-500/40 dark:bg-rose-500/10', active && !sla.overdue && sla.urgent && 'border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10')}>
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-bold"><Clock className="h-4 w-4" /> مهلت پاسخ‌گویی (SLA)</h3>
            {isStaff && (
              <button className="text-xs text-brand" onClick={() => { setDueVal(ticket.due_at ? new Date(ticket.due_at).toISOString().slice(0, 16) : ''); setDueOpen(true); }}>
                <CalendarClock className="inline h-3.5 w-3.5" /> ویرایش
              </button>
            )}
          </div>
          <div className="mt-2 space-y-1.5 text-sm">
            {active && !ticket.first_response_at && ticket.first_response_due_at && (() => { const fr = timeLeft(ticket.first_response_due_at); return <div><span className="text-xs text-slate-500">اولین پاسخ: </span><span className={clsx('font-bold', fr.overdue ? 'text-rose-600' : fr.urgent ? 'text-amber-600' : 'text-emerald-600')}>{fr.text}</span><span className="mr-1 text-[11px] text-slate-400">({formatDateTime(ticket.first_response_due_at)})</span></div>; })()}
            <div>
              <span className="text-xs text-slate-500">حل تیکت: </span>
              {active ? <span className={clsx('font-bold', sla.overdue ? 'text-rose-600' : sla.urgent ? 'text-amber-600' : 'text-emerald-600')}>{sla.text}</span> : <span className="text-slate-500">تیکت {ticket.status === 'resolved' ? 'حل شده' : 'بسته شده'} است</span>}
              <span className="mr-1 text-[11px] text-slate-400">({formatDateTime(ticket.due_at)})</span>
            </div>
            <div className="text-[11px] text-slate-400">بر اساس ساعات کاری شرکت/بخش محاسبه می‌شود.</div>
          </div>
        </div>
      )}

      {/* Tags (staff) */}
      {isStaff && (
        <div className="card p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold"><Tag className="h-4 w-4" /> برچسب‌ها</h3>
          <div className="flex flex-wrap gap-1.5">
            {ticket.tags.map((t) => (
              <span key={t} className="chip bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {t}
                <button onClick={() => update({ tags: ticket.tags.filter((x) => x !== t) }, 'برچسب حذف شد')} className="hover:text-rose-600"><X className="h-3 w-3" /></button>
              </span>
            ))}
            {!ticket.tags.length && <span className="text-xs text-slate-400">بدون برچسب</span>}
          </div>
          <div className="mt-2 flex gap-1">
            <input className="input py-1.5 text-xs" placeholder="برچسب جدید…" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} />
            <button className="btn-secondary btn-sm" onClick={addTag}><Plus className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      {/* Customer (staff) */}
      {isStaff && (
        <div className="card p-4">
          <h3 className="mb-3 text-sm font-bold">مشتری</h3>
          <div className="flex items-center gap-3">
            <Avatar user={ticket.customer} size="lg" />
            <div className="min-w-0">
              <div className="truncate font-bold">{ticket.customer.name}</div>
              {ticket.customer.company && <div className="flex items-center gap-1 truncate text-xs text-slate-500"><Building2 className="h-3 w-3" />{ticket.customer.company}</div>}
            </div>
          </div>
          <div className="mt-3 space-y-1.5 text-xs">
            {ticket.customer.email && <a href={`mailto:${ticket.customer.email}`} className="flex items-center gap-2 text-slate-600 hover:text-brand dark:text-slate-300"><Mail className="h-3.5 w-3.5" /><span className="ltr">{ticket.customer.email}</span></a>}
            {ticket.customer.mobile && <a href={`tel:${ticket.customer.mobile}`} className="flex items-center gap-2 text-slate-600 hover:text-brand dark:text-slate-300"><Phone className="h-3.5 w-3.5" /><span className="ltr num">{faNum(ticket.customer.mobile)}</span></a>}
          </div>
          {customerStats && (
            <>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800"><div className="text-lg font-bold">{faNum(customerStats.total)}</div><div className="text-[10px] text-slate-500">کل تیکت‌ها</div></div>
                <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800"><div className="text-lg font-bold">{faNum(customerStats.open)}</div><div className="text-[10px] text-slate-500">باز</div></div>
                <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800"><div className="text-lg font-bold">{customerStats.avg_rating ? faNum(customerStats.avg_rating) : '—'}</div><div className="text-[10px] text-slate-500">میانگین امتیاز</div></div>
              </div>
              {customerStats.recent.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-[11px] font-semibold text-slate-500">تیکت‌های اخیر</div>
                  <ul className="space-y-1">
                    {customerStats.recent.map((r) => (
                      <li key={r.id}>
                        <Link to={`/tickets/${r.id}`} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs hover:bg-slate-50 dark:hover:bg-slate-800">
                          <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_META[r.status as keyof typeof STATUS_META]?.dot)} />
                          <span className="truncate">{r.subject}</span>
                          <ExternalLink className="mr-auto h-3 w-3 shrink-0 text-slate-300" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Link to={`/tickets?customer_id=${ticket.customer.id}`} className="mt-2 block text-center text-xs text-brand hover:underline">همه تیکت‌های این مشتری</Link>
            </>
          )}
        </div>
      )}

      {/* Timeline */}
      {events.length > 0 && <div className="card p-4">
        <button className="flex w-full items-center justify-between text-sm font-bold" onClick={() => setShowTimeline((s) => !s)}>
          <span className="flex items-center gap-1.5"><History className="h-4 w-4" /> تاریخچه ({faNum(events.length)})</span>
          <span className="text-xs font-normal text-brand">{showTimeline ? 'بستن' : 'نمایش'}</span>
        </button>
        {showTimeline && <div className="mt-4"><Timeline events={events} customerView={isCustomer} /></div>}
      </div>}

      <Modal open={dueOpen} onClose={() => setDueOpen(false)} title="ویرایش مهلت پاسخ‌گویی" size="sm" footer={<><button className="btn-secondary" onClick={() => setDueOpen(false)}>انصراف</button><button className="btn-primary" onClick={() => { update({ due_at: dueVal ? new Date(dueVal).toISOString() : null }, 'مهلت به‌روز شد'); setDueOpen(false); }}>ذخیره</button></>}>
        <input type="datetime-local" className="input ltr" value={dueVal} onChange={(e) => setDueVal(e.target.value)} />
        <p className="mt-2 text-xs text-slate-400">برای حذف مهلت، فیلد را خالی بگذارید.</p>
      </Modal>
      {isAdmin && null}
    </div>
  );
}
