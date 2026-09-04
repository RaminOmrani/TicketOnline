import clsx from 'clsx';
import { useConfig } from '@/store/config';

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  const { settings } = useConfig();
  if (settings.logo) {
    return <img src={settings.logo} alt={settings.company_name} className={clsx('max-h-10 w-auto object-contain', className)} />;
  }
  return (
    <span className={clsx('inline-flex items-center gap-2.5', className)}>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
        <svg viewBox="0 0 64 64" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 44V22l14 14 14-14v22" />
        </svg>
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">{settings.company_name}</span>
          <span className="block text-[11px] font-medium text-slate-500">مرکز پشتیبانی</span>
        </span>
      )}
    </span>
  );
}
