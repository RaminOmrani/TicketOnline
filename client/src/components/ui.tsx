import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { X, Loader2, ChevronRight, ChevronLeft, Inbox, Search } from 'lucide-react';
import { avatarColor, faNum, initials } from '@/lib/format';
import type { User } from '@/lib/types';

/* ---------------- Spinner ---------------- */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('animate-spin', className || 'h-5 w-5')} />;
}

export function PageLoader({ label = 'در حال بارگذاری…' }: { label?: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-500">
      <Spinner className="h-7 w-7 text-brand" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/* ---------------- Avatar ---------------- */
export function Avatar({ user, size = 'md', className, showStatus, online }: { user?: Partial<User> | null; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; className?: string; showStatus?: boolean; online?: boolean }) {
  const sizes = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg', xl: 'h-20 w-20 text-2xl' };
  const bg = avatarColor(user?.id ?? user?.name ?? 0);
  return (
    <span className={clsx('relative inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white', sizes[size], className)} style={{ background: bg }}>
      {user?.avatar ? <img src={user.avatar} alt="" className="h-full w-full rounded-full object-cover" /> : initials(user?.name)}
      {showStatus && <span className={clsx('absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900', online ? 'bg-emerald-500' : 'bg-slate-400')} />}
    </span>
  );
}

/* ---------------- Badge ---------------- */
export function Badge({ children, color = 'slate', className, dot }: { children: ReactNode; color?: string; className?: string; dot?: boolean }) {
  const map: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    red: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    purple: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    brand: 'bg-brand/10 text-brand',
  };
  return (
    <span className={clsx('chip', map[color] || map.slate, className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ---------------- Modal ---------------- */
export function Modal({ open, onClose, title, children, footer, size = 'md', closeOnBackdrop = true }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'; closeOnBackdrop?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-[96vw]' };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => closeOnBackdrop && e.target === e.currentTarget && onClose()}>
      <div className={clsx('card max-h-[92vh] w-full overflow-hidden rounded-b-none animate-fade-in sm:rounded-b-2xl', sizes[size])}>
        {title !== undefined && (
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
            <h3 className="text-base font-bold">{title}</h3>
            <button className="btn-icon" onClick={onClose} aria-label="بستن">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="max-h-[calc(92vh-8rem)] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmText = 'تأیید', danger, loading }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; message?: ReactNode; confirmText?: string; danger?: boolean; loading?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" footer={<><button className="btn-secondary" onClick={onClose}>انصراف</button><button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={loading}>{loading && <Spinner className="h-4 w-4" />}{confirmText}</button></>}>
      <div className="text-sm leading-7 text-slate-600 dark:text-slate-300">{message}</div>
    </Modal>
  );
}

/* ---------------- Dropdown ---------------- */
export function Dropdown({ trigger, children, align = 'end', width = 'w-56' }: { trigger: ReactNode; children: ReactNode | ((close: () => void) => ReactNode); align?: 'start' | 'end'; width?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div className={clsx('card absolute z-40 mt-2 overflow-hidden p-1.5 shadow-pop animate-fade-in', width, align === 'end' ? 'left-0' : 'right-0')}>
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon, children, onClick, danger, active }: { icon?: ReactNode; children: ReactNode; onClick?: () => void; danger?: boolean; active?: boolean }) {
  return (
    <button onClick={onClick} className={clsx('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm transition', danger ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800', active && 'bg-brand/10 text-brand')}>
      {icon && <span className="text-slate-400 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      <span className="flex-1">{children}</span>
    </button>
  );
}

/* ---------------- Empty state ---------------- */
export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 [&>svg]:h-8 [&>svg]:w-8">{icon || <Inbox />}</div>
      <h3 className="text-base font-bold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------------- Pagination ---------------- */
export function Pagination({ page, pages, onChange, total }: { page: number; pages: number; onChange: (p: number) => void; total?: number }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 text-sm text-slate-500">
      <span>{total !== undefined && `${faNum(total)} مورد — `}صفحه {faNum(page)} از {faNum(pages)}</span>
      <div className="flex items-center gap-1">
        <button className="btn-icon" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="قبلی">
          <ChevronRight className="h-5 w-5" />
        </button>
        <button className="btn-icon" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="بعدی">
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

/* ---------------- Field ---------------- */
export function Field({ label, error, hint, children, required }: { label?: string; error?: string; hint?: string; children: ReactNode; required?: boolean }) {
  return (
    <div>
      {label && (
        <label className="label">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      {children}
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label?: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span>
        {label && <span className="block text-sm font-medium">{label}</span>}
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </span>
      <span role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={clsx('relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition', checked ? 'bg-brand' : 'bg-slate-300 dark:bg-slate-700')}>
        <span className={clsx('inline-block h-5 w-5 rounded-full bg-white shadow transition', checked ? '-translate-x-0.5' : '-translate-x-[22px]')} />
      </span>
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = 'جستجو…', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={clsx('relative', className)}>
      <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input className="input pr-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {value && (
        <button className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => onChange('')}>
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode; count?: number }[] }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
      {items.map((it) => (
        <button key={it.value} onClick={() => onChange(it.value)} className={clsx('flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition', value === it.value ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200')}>
          {it.label}
          {it.count !== undefined && it.count > 0 && <span className={clsx('rounded-full px-1.5 text-[11px]', value === it.value ? 'bg-brand/10 text-brand' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300')}>{faNum(it.count)}</span>}
        </button>
      ))}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-lg bg-slate-200/80 dark:bg-slate-800', className)} />;
}

export { Fragment };
