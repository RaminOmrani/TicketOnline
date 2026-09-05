import clsx from 'clsx';
import { useConfig } from '@/store/config';

/** Millionaire "M" monogram (matches softmiliac.com). */
export function LogoMark({ className, color = 'currentColor' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M10 54V10h9l13 20 13-20h9v44H44V28L32 46 20 28v26z" fill={color} />
      <path d="M14 10l20 30" stroke="#fff" strokeWidth="3" />
    </svg>
  );
}

export function Logo({ className, compact, light }: { className?: string; compact?: boolean; light?: boolean }) {
  const { settings } = useConfig();
  if (settings.logo) {
    return <img src={settings.logo} alt={settings.company_name} className={clsx('max-h-11 w-auto object-contain', className)} />;
  }
  return (
    <span className={clsx('inline-flex items-center gap-2.5', className)}>
      <LogoMark className="h-11 w-11 shrink-0" color={light ? '#fff' : 'rgb(var(--brand-rgb))'} />
      {!compact && (
        <span className="leading-tight">
          <span className={clsx('block text-[11px] font-medium', light ? 'text-white/80' : 'text-brand')}>گروه نرم‌افزاری</span>
          <span className={clsx('block text-[22px] font-extrabold tracking-tight', light ? 'text-white' : 'text-brand')}>{settings.company_name}</span>
        </span>
      )}
    </span>
  );
}
