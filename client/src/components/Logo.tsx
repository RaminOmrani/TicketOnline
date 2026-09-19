import clsx from 'clsx';
import { useConfig } from '@/store/config';

/** Millionaire "M" monogram (approximation of the official logo). */
export function LogoMark({ className, color = 'currentColor' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d="M8 90V10h18l24 30 24-30h18v80H74V38L50 68 26 38v52z" fill={color} /><path d="M26 10v80M74 10v80" fill="none" stroke="#fff" strokeWidth="2" strokeOpacity="0.55" />
    </svg>
  );
}

export function Logo({ className, compact, light }: { className?: string; compact?: boolean; light?: boolean }) {
  const { settings } = useConfig();
  if (settings.logo) {
    return <img src={settings.logo} alt={settings.company_name} className={clsx('max-h-12 w-auto object-contain', light && 'rounded-xl bg-white/95 px-3 py-1.5', className)} />;
  }
  return (
    <span className={clsx('inline-flex items-center gap-2.5', className)} dir="rtl">
      <LogoMark className="h-12 w-12 shrink-0" color={light ? '#fff' : 'rgb(var(--brand-rgb))'} />
      {!compact && (
        <span className="text-right leading-tight">
          <span className={clsx('block text-[11px] font-medium', light ? 'text-white/80' : 'text-brand')}>گروه نرم افزاری</span>
          <span className={clsx('block text-[24px] font-extrabold tracking-tight', light ? 'text-white' : 'text-brand')}>{settings.company_name}</span>
        </span>
      )}
    </span>
  );
}

/** Small logo/name chip for a company (brand). */
export function CompanyBadge({ company, size = 'sm', className }: { company?: { name: string; logo?: string | null } | null; size?: 'xs' | 'sm' | 'md'; className?: string }) {
  if (!company) return null;
  const h = size === 'xs' ? 'h-4' : size === 'sm' ? 'h-5' : 'h-7';
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200', className)}>
      {company.logo ? <img src={company.logo} alt="" className={clsx(h, 'logo-well w-auto rounded object-contain px-0.5')} /> : <LogoMark className={clsx(h, 'w-auto')} color="rgb(var(--brand-rgb))" />}
      {company.name}
    </span>
  );
}
