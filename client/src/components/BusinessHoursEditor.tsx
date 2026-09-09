import { Plus, X } from 'lucide-react';
import type { BusinessHours } from '@/lib/types';

const DAYS: { key: keyof BusinessHours; label: string }[] = [
  { key: 'sat', label: 'شنبه' },
  { key: 'sun', label: 'یکشنبه' },
  { key: 'mon', label: 'دوشنبه' },
  { key: 'tue', label: 'سه‌شنبه' },
  { key: 'wed', label: 'چهارشنبه' },
  { key: 'thu', label: 'پنجشنبه' },
  { key: 'fri', label: 'جمعه' },
];

export const DEFAULT_HOURS: BusinessHours = { sat: [['08:30', '17:00']], sun: [['08:30', '17:00']], mon: [['08:30', '17:00']], tue: [['08:30', '17:00']], wed: [['08:30', '17:00']], thu: [['08:30', '17:00']], fri: [] };

export function BusinessHoursEditor({ value, onChange }: { value: BusinessHours | null; onChange: (v: BusinessHours) => void }) {
  const v: BusinessHours = value || DEFAULT_HOURS;
  const set = (k: keyof BusinessHours, iv: [string, string][]) => onChange({ ...v, [k]: iv });
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      {DAYS.map((d) => {
        const ivs = v[d.key] || [];
        const on = ivs.length > 0;
        return (
          <div key={d.key} className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2 last:border-0 dark:border-slate-800">
            <label className="flex w-24 cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={on} onChange={(e) => set(d.key, e.target.checked ? [['08:30', '17:00']] : [])} className="accent-[rgb(var(--brand-rgb))]" />
              {d.label}
            </label>
            {on ? (
              <div className="flex flex-wrap items-center gap-2">
                {ivs.map((iv, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-xs dark:bg-slate-800">
                    <input type="text" inputMode="numeric" pattern="[0-9]{1,2}:[0-9]{2}" placeholder="08:30" dir="ltr" className="input w-20 py-0.5 text-center text-xs" value={iv[0]} onChange={(e) => set(d.key, ivs.map((x, j) => (j === i ? [e.target.value, x[1]] : x)) as [string, string][])} />
                    <span>تا</span>
                    <input type="text" inputMode="numeric" pattern="[0-9]{1,2}:[0-9]{2}" placeholder="17:00" dir="ltr" className="input w-20 py-0.5 text-center text-xs" value={iv[1]} onChange={(e) => set(d.key, ivs.map((x, j) => (j === i ? [x[0], e.target.value] : x)) as [string, string][])} />
                    {ivs.length > 1 && <button type="button" className="text-slate-400 hover:text-rose-600" onClick={() => set(d.key, ivs.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5" /></button>}
                  </span>
                ))}
                {ivs.length < 3 && <button type="button" className="btn-ghost btn-sm" onClick={() => set(d.key, [...ivs, ['13:00', '17:00']])}><Plus className="h-3.5 w-3.5" /> بازه</button>}
              </div>
            ) : (
              <span className="text-xs text-slate-400">تعطیل</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
