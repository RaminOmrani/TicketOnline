import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Lock, RotateCcw, Info, Trash2, Printer, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { formatDayHeading } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { PageLoader, EmptyState, ConfirmDialog, Modal } from '@/components/ui';
import { StatusBadge, PriorityBadge, DeptChip, OverdueBadge } from '@/components/tickets/badges';
import { CompanyBadge } from '@/components/Logo';
import { TicketSidebar } from '@/components/tickets/TicketSidebar';
import { MessageBubble, EditMessageBox } from '@/components/thread/MessageBubble';
import { EventLine } from '@/components/thread/Timeline';
import { Composer } from '@/components/thread/Composer';
import type { Message, Ticket, TicketEvent } from '@/lib/types';

interface Detail {
  ticket: Ticket;
  messages: Message[];
  events: TicketEvent[];
  customer_stats?: any;
}

export default function TicketPage() {
  const { id } = useParams();
  const ticketId = Number(id);
  const { user, isStaff, isAdmin } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [typing, setTyping] = useState<{ name: string; at: number } | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [deleting, setDeleting] = useState<Message | null>(null);
  const [confirm, setConfirm] = useState<'close' | 'reopen' | 'delete' | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const isCustomer = user?.role === 'customer';

  const { data, isLoading, error } = useQuery<Detail>({ queryKey: ['ticket', ticketId], queryFn: () => api.get(`/tickets/${ticketId}`), enabled: !!ticketId });

  // join room + typing
  useEffect(() => {
    if (!ticketId) return;
    const s = getSocket();
    s.emit('ticket:join', ticketId);
    const onTyping = (e: any) => {
      if (e.ticket_id !== ticketId || e.user_id === user?.id) return;
      setTyping({ name: isCustomer && e.role !== 'customer' ? 'کارشناس پشتیبانی' : e.name, at: Date.now() });
    };
    s.on('typing', onTyping);
    const iv = setInterval(() => setTyping((t) => (t && Date.now() - t.at > 4000 ? null : t)), 1000);
    return () => {
      s.emit('ticket:leave', ticketId);
      s.off('typing', onTyping);
      clearInterval(iv);
    };
  }, [ticketId, user?.id, isCustomer]);

  const lastMsgId = data?.messages[data.messages.length - 1]?.id;
  useEffect(() => {
    if (!data) return;
    if (data.ticket.unread > 0 || data.messages.some((m) => (isCustomer ? !m.read_by_customer_at && m.sender?.id !== user?.id : !m.read_by_agent_at && m.sender?.id !== user?.id))) {
      api.post(`/tickets/${ticketId}/read`).then(() => {
        qc.invalidateQueries({ queryKey: ['summary'] });
        qc.invalidateQueries({ queryKey: ['notifications'] });
        qc.invalidateQueries({ queryKey: ['tickets'] });
      }).catch(() => {});
    }
  }, [lastMsgId, data?.ticket.unread]);

  // Newest first: composer sits on top, latest message right below it.
  const stream = useMemo(() => {
    if (!data) return [];
    const items: { kind: 'msg' | 'ev'; at: string; m?: Message; e?: TicketEvent }[] = [];
    data.messages.forEach((m) => items.push({ kind: 'msg', at: m.created_at, m }));
    data.events.filter((e) => e.type !== 'created' && e.type !== 'tags_changed').forEach((e) => items.push({ kind: 'ev', at: e.created_at, e }));
    items.sort((a, b) => b.at.localeCompare(a.at));
    return items;
  }, [data]);

  if (isLoading) return <PageLoader />;
  if (error || !data) return <EmptyState title="تیکت یافت نشد" description={(error as any)?.message} action={<Link to="/tickets" className="btn-primary">بازگشت به تیکت‌ها</Link>} />;
  const { ticket } = data;
  const canClose = ['open', 'in_progress', 'waiting_customer', 'resolved'].includes(ticket.status);
  const canReopen = ['resolved', 'closed'].includes(ticket.status);

  const patch = async (body: any, msg: string) => {
    try {
      await api.patch(`/tickets/${ticket.id}`, body);
      qc.invalidateQueries({ queryKey: ['ticket', ticket.id] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      toast.success(msg);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  let lastDay = '';

  return (
    <div className="mx-auto max-w-7xl" dir="rtl">
      {/* Header: title block on the right, actions on the left */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-2 text-right">
          <button className="btn-icon shrink-0" onClick={() => navigate(-1)} aria-label="بازگشت"><ArrowRight className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="num font-mono text-xs text-slate-400"><bdi dir="ltr">{ticket.number}</bdi></span>
              <StatusBadge status={ticket.status} customerView={isCustomer} />
              <PriorityBadge priority={ticket.priority} />
              {!isCustomer && ticket.overdue && <OverdueBadge />}
            </div>
            <h1 className="mt-1 text-right text-lg font-extrabold leading-7 sm:text-xl" dir="rtl"><bdi>{ticket.subject}</bdi></h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <CompanyBadge company={ticket.company} />
              <DeptChip department={ticket.department} />
              {ticket.product && <span className="chip bg-slate-100 dark:bg-slate-800">{ticket.product}</span>}
              {isStaff && ticket.tags.map((t) => <span key={t} className="chip bg-slate-100 text-slate-600 dark:bg-slate-800">#{t}</span>)}
              {isCustomer && ticket.agent_viewed && !['resolved', 'closed'].includes(ticket.status) && <span className="chip bg-brand/10 text-brand"><Eye className="h-3 w-3" /> کارشناس در حال بررسی</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">
          <button className="btn-icon lg:hidden" onClick={() => setShowInfo(true)} title="مشخصات"><Info className="h-5 w-5" /></button>
          {isStaff && <button className="btn-icon hidden sm:inline-flex" onClick={() => window.print()} title="چاپ"><Printer className="h-5 w-5" /></button>}
          {canReopen && <button className="btn btn-sm border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300" onClick={() => setConfirm('reopen')}><RotateCcw className="h-4 w-4" /> بازگشایی</button>}
          {canClose && <button className="btn btn-sm border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300" onClick={() => setConfirm('close')}><Lock className="h-4 w-4" /> بستن تیکت</button>}
          {isAdmin && <button className="btn-icon text-rose-500" onClick={() => setConfirm('delete')} title="حذف تیکت"><Trash2 className="h-5 w-5" /></button>}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Thread */}
        <div className="min-w-0">
          {isCustomer && ticket.status === 'waiting_customer' && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              کارشناس منتظر پاسخ شماست. پاسخ خود را در کادر زیر بنویسید.
            </div>
          )}
          {isCustomer && ticket.status === 'resolved' && !ticket.rated_at && (
            <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              این تیکت حل شده است. اگر مشکل همچنان ادامه دارد پیام بفرستید تا تیکت دوباره باز شود؛ در غیر این صورت لطفاً امتیاز دهید.
            </div>
          )}

          {/* Composer on top */}
          <div className="mb-4">
            <Composer ticket={ticket} onSent={() => qc.invalidateQueries({ queryKey: ['ticket', ticket.id] })} />
            {typing && (
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-400 animate-fade-in">
                <span className="flex gap-0.5"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:120ms]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:240ms]" /></span>
                {typing.name} در حال نوشتن…
              </div>
            )}
          </div>

          {/* Messages, newest first */}
          <div className="card space-y-4 p-4 sm:p-6">
            <div className="text-xs font-bold text-slate-500">گفتگو (جدیدترین در بالا)</div>
            {stream.map((it) => {
              const day = it.at.slice(0, 10);
              const showDay = day !== lastDay;
              lastDay = day;
              return (
                <div key={`${it.kind}-${it.m?.id ?? it.e?.id}`} className="space-y-4">
                  {showDay && (
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                      <span className="rounded-full bg-slate-100 px-3 py-0.5 dark:bg-slate-800">{formatDayHeading(it.at)}</span>
                      <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                    </div>
                  )}
                  {it.kind === 'msg' && it.m ? (
                    editing?.id === it.m.id ? (
                      <EditMessageBox initial={it.m.body} onCancel={() => setEditing(null)} onSave={async (b) => { try { await api.patch(`/tickets/${ticket.id}/messages/${it.m!.id}`, { body: b }); setEditing(null); qc.invalidateQueries({ queryKey: ['ticket', ticket.id] }); } catch (e: any) { toast.error(e.message); } }} />
                    ) : (
                      <MessageBubble m={it.m} onEdit={setEditing} onDelete={setDeleting} />
                    )
                  ) : (
                    it.e && <EventLine e={it.e} customerView={isCustomer} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pl-1">
            <TicketSidebar ticket={ticket} events={data.events} customerStats={data.customer_stats} />
          </div>
        </aside>
      </div>

      <Modal open={showInfo} onClose={() => setShowInfo(false)} title="مشخصات تیکت" size="md">
        <TicketSidebar ticket={ticket} events={data.events} customerStats={data.customer_stats} />
      </Modal>

      <ConfirmDialog open={confirm === 'close'} onClose={() => setConfirm(null)} title="بستن تیکت" message="آیا از بستن این تیکت مطمئن هستید؟ در صورت نیاز می‌توانید تا مدتی آن را بازگشایی کنید." confirmText="بستن تیکت" danger onConfirm={() => { setConfirm(null); patch({ status: 'closed' }, 'تیکت بسته شد'); }} />
      <ConfirmDialog open={confirm === 'reopen'} onClose={() => setConfirm(null)} title="بازگشایی تیکت" message="تیکت مجدداً باز می‌شود و کارشناسان مطلع خواهند شد." confirmText="بازگشایی" onConfirm={() => { setConfirm(null); patch({ status: 'open' }, 'تیکت بازگشایی شد'); }} />
      <ConfirmDialog open={confirm === 'delete'} onClose={() => setConfirm(null)} danger title="حذف تیکت" message="این عملیات غیرقابل بازگشت است و همه پیام‌ها و پیوست‌های تیکت حذف می‌شوند." confirmText="حذف قطعی" onConfirm={async () => { setConfirm(null); try { await api.del(`/tickets/${ticket.id}`); toast.success('تیکت حذف شد'); navigate('/tickets'); } catch (e: any) { toast.error(e.message); } }} />
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} danger title="حذف پیام" message="این پیام و پیوست‌های آن حذف می‌شود." confirmText="حذف" onConfirm={async () => { const m = deleting!; setDeleting(null); try { await api.del(`/tickets/${ticket.id}/messages/${m.id}`); qc.invalidateQueries({ queryKey: ['ticket', ticket.id] }); } catch (e: any) { toast.error(e.message); } }} />
    </div>
  );
}
