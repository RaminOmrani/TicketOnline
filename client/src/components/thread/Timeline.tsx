import { ArrowRightLeft, CheckCircle2, Clock, Flag, PlusCircle, RotateCcw, Star, Tag, UserCheck, UserX, AlertTriangle, Pencil, CalendarClock, Eye } from 'lucide-react';
import { faNum, formatDateTime, timeAgo } from '@/lib/format';
import { STATUS_META } from '@/components/tickets/badges';
import type { TicketEvent } from '@/lib/types';

export function describeEvent(e: TicketEvent, customerView = false): { icon: React.ReactNode; text: string; color: string } {
  const actor = e.actor?.name || 'سیستم';
  const d = e.data || {};
  switch (e.type) {
    case 'created':
      return { icon: <PlusCircle />, text: d.on_behalf ? `${actor} تیکت را از طرف مشتری ثبت کرد` : `${actor} تیکت را ثبت کرد`, color: 'text-brand' };
    case 'status_changed': {
      const to = customerView && d.to === 'waiting_customer' ? 'در انتظار پاسخ شما' : STATUS_META[d.to as keyof typeof STATUS_META]?.label || d.to;
      if (d.auto) return { icon: <Clock />, text: `وضعیت به‌صورت خودکار به «${to}» تغییر کرد${d.reason ? ` (${d.reason})` : ''}`, color: 'text-slate-500' };
      if (d.reopened) return { icon: <RotateCcw />, text: `${actor} تیکت را بازگشایی کرد`, color: 'text-amber-600' };
      return { icon: d.to === 'resolved' || d.to === 'closed' ? <CheckCircle2 /> : <ArrowRightLeft />, text: `${actor} وضعیت را به «${to}» تغییر داد`, color: d.to === 'resolved' ? 'text-emerald-600' : 'text-slate-600' };
    }
    case 'agent_viewed':
      return { icon: <Eye />, text: customerView ? 'کارشناس پشتیبانی تیکت شما را مشاهده کرد و در حال بررسی است' : `${actor} تیکت را مشاهده کرد`, color: 'text-brand' };
    case 'reopened':
      return { icon: <RotateCcw />, text: `${actor} با ارسال پیام، تیکت را بازگشایی کرد`, color: 'text-amber-600' };
    case 'assigned':
      return { icon: <UserCheck />, text: d.auto ? `تیکت به‌صورت خودکار به کارشناس تخصیص یافت` : `${actor} تیکت را به «${d.assignee_name}» تخصیص داد`, color: 'text-violet-600' };
    case 'unassigned':
      return { icon: <UserX />, text: `${actor} تخصیص کارشناس را برداشت`, color: 'text-slate-500' };
    case 'priority_changed':
      return { icon: <Flag />, text: `${actor} اولویت را از «${d.from_label}» به «${d.to_label}» تغییر داد`, color: 'text-orange-600' };
    case 'department_changed':
      return { icon: <ArrowRightLeft />, text: customerView ? `تیکت شما به بخش «${d.to}» ارجاع داده شد` : `${actor} تیکت را از بخش «${d.from}» به «${d.to}» ارجاع داد`, color: 'text-blue-600' };
    case 'subject_changed':
      return { icon: <Pencil />, text: `${actor} موضوع را به «${d.to}» تغییر داد`, color: 'text-slate-600' };
    case 'tags_changed':
      return { icon: <Tag />, text: `${actor} برچسب‌ها را به‌روز کرد${d.tags?.length ? `: ${d.tags.join('، ')}` : ''}`, color: 'text-slate-600' };
    case 'due_changed':
      return { icon: <CalendarClock />, text: `${actor} مهلت پاسخ‌گویی را ${d.due_at ? `به ${formatDateTime(d.due_at)} تغییر داد` : 'حذف کرد'}`, color: 'text-slate-600' };
    case 'rated':
      return { icon: <Star />, text: `${actor} امتیاز ${faNum(d.rating)} از ۵ ثبت کرد${d.comment ? `: «${d.comment}»` : ''}`, color: 'text-amber-500' };
    case 'sla_overdue':
      return { icon: <AlertTriangle />, text: 'تیکت از مهلت SLA عبور کرد', color: 'text-rose-600' };
    default:
      return { icon: <Clock />, text: `${actor}: ${e.type}`, color: 'text-slate-500' };
  }
}

export function EventLine({ e, customerView }: { e: TicketEvent; customerView?: boolean }) {
  const { icon, text, color } = describeEvent(e, customerView);
  return (
    <div className="flex items-center justify-center gap-2 text-[11.5px] text-slate-500" title={formatDateTime(e.created_at)}>
      <span className={`[&>svg]:h-3.5 [&>svg]:w-3.5 ${color}`}>{icon}</span>
      <span>{text}</span>
      <span className="text-slate-400">— {timeAgo(e.created_at)}</span>
    </div>
  );
}

export function Timeline({ events, customerView }: { events: TicketEvent[]; customerView?: boolean }) {
  if (!events.length) return null;
  return (
    <ol className="relative mr-2 border-r border-slate-200 dark:border-slate-700">
      {events.map((e) => {
        const { icon, text, color } = describeEvent(e, customerView);
        return (
          <li key={e.id} className="mb-4 mr-4">
            <span className={`absolute -right-[9px] flex h-4 w-4 items-center justify-center rounded-full bg-white dark:bg-slate-900 [&>svg]:h-3.5 [&>svg]:w-3.5 ${color}`}>{icon}</span>
            <div className="text-xs leading-5 text-slate-600 dark:text-slate-300">{text}</div>
            <div className="text-[11px] text-slate-400">{formatDateTime(e.created_at)}</div>
          </li>
        );
      })}
    </ol>
  );
}
