import clsx from 'clsx';
import {
  AlertTriangle, ArrowDown, ArrowUp, Flame, Minus,
  Wrench, Calculator, Code, ShoppingBag, GraduationCap, MessageSquareHeart, LifeBuoy, Headphones, Landmark, Database, Server, ShieldCheck, Briefcase, FileText, Package, Settings, Phone, CreditCard, Bug, Lightbulb,
} from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  'wrench': Wrench, 'calculator': Calculator, 'code': Code, 'shopping-bag': ShoppingBag, 'graduation-cap': GraduationCap, 'message-square-heart': MessageSquareHeart, 'life-buoy': LifeBuoy, 'headphones': Headphones, 'landmark': Landmark, 'database': Database, 'server': Server, 'shield-check': ShieldCheck, 'briefcase': Briefcase, 'file-text': FileText, 'package': Package, 'settings': Settings, 'phone': Phone, 'credit-card': CreditCard, 'bug': Bug, 'lightbulb': Lightbulb,
};
export const DEPT_ICONS = Object.keys(ICON_MAP);
import type { Department, Priority, Status } from '@/lib/types';

export const STATUS_META: Record<Status, { label: string; color: string; dot: string }> = {
  open: { label: 'باز', color: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300', dot: 'bg-blue-500' },
  in_progress: { label: 'در حال بررسی', color: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300', dot: 'bg-violet-500' },
  waiting_customer: { label: 'در انتظار پاسخ مشتری', color: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', dot: 'bg-amber-500' },
  resolved: { label: 'حل شده', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', dot: 'bg-emerald-500' },
  closed: { label: 'بسته شده', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', dot: 'bg-slate-400' },
};

export const PRIORITY_META: Record<Priority, { label: string; color: string; icon: any }> = {
  low: { label: 'کم', color: 'text-slate-500', icon: ArrowDown },
  normal: { label: 'عادی', color: 'text-blue-600', icon: Minus },
  high: { label: 'زیاد', color: 'text-orange-600', icon: ArrowUp },
  urgent: { label: 'فوری', color: 'text-rose-600', icon: Flame },
};

export function StatusBadge({ status, customerView, className }: { status: Status; customerView?: boolean; className?: string }) {
  const m = STATUS_META[status];
  const label = customerView && status === 'waiting_customer' ? 'در انتظار پاسخ شما' : m.label;
  return (
    <span className={clsx('chip', m.color, className)}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', m.dot)} />
      {label}
    </span>
  );
}

export function PriorityBadge({ priority, className, short }: { priority: Priority; className?: string; short?: boolean }) {
  const m = PRIORITY_META[priority];
  const Icon = m.icon;
  return (
    <span className={clsx('inline-flex items-center gap-1 text-xs font-medium', m.color, className)} title={`اولویت ${m.label}`}>
      <Icon className="h-3.5 w-3.5" />
      {!short && m.label}
    </span>
  );
}

export function DeptIcon({ name, className }: { name?: string | null; className?: string }) {
  const Icon = ICON_MAP[name || 'life-buoy'] || LifeBuoy;
  return <Icon className={className || 'h-5 w-5'} />;
}

export function DeptChip({ department, className }: { department?: Department | null; className?: string }) {
  if (!department) return null;
  return (
    <span className={clsx('chip border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200', className)}>
      <DeptIcon name={department.icon} className="h-3.5 w-3.5 text-brand" />
      {department.name}
    </span>
  );
}

export function OverdueBadge({ className }: { className?: string }) {
  return (
    <span className={clsx('chip bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', className)}>
      <AlertTriangle className="h-3.5 w-3.5" />
      تأخیر
    </span>
  );
}
