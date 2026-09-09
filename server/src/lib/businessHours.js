/**
 * Business-hours aware time arithmetic (Iran time, UTC+03:30 — no DST since 2022).
 * schedule = { sat: [["08:30","17:00"]], sun: [...], ..., fri: [] }
 */
const TZ_OFFSET_MIN = 210;
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']; // getUTCDay() order

export const DEFAULT_BUSINESS_HOURS = {
  sat: [['08:30', '17:00']],
  sun: [['08:30', '17:00']],
  mon: [['08:30', '17:00']],
  tue: [['08:30', '17:00']],
  wed: [['08:30', '17:00']],
  thu: [['08:30', '17:00']],
  fri: [],
};

export const DAY_LABELS = { sat: 'شنبه', sun: 'یکشنبه', mon: 'دوشنبه', tue: 'سه‌شنبه', wed: 'چهارشنبه', thu: 'پنجشنبه', fri: 'جمعه' };

function toMin(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
}

export function normalizeSchedule(s) {
  if (!s || typeof s !== 'object') return null;
  const out = {};
  let any = false;
  for (const k of DAY_KEYS) {
    const arr = Array.isArray(s[k]) ? s[k] : [];
    out[k] = arr
      .filter((iv) => Array.isArray(iv) && iv.length === 2 && /^\d{1,2}:\d{2}$/.test(iv[0]) && /^\d{1,2}:\d{2}$/.test(iv[1]) && toMin(iv[0]) < toMin(iv[1]))
      .map((iv) => [iv[0], iv[1]])
      .sort((a, b) => toMin(a[0]) - toMin(b[0]));
    if (out[k].length) any = true;
  }
  return any ? out : null;
}

/** Add `minutes` of business time to `start`. Falls back to calendar time when schedule is empty. */
export function addBusinessMinutes(start, minutes, schedule) {
  const sched = normalizeSchedule(schedule);
  const startMs = start instanceof Date ? start.getTime() : Date.parse(start);
  if (!sched || minutes <= 0) return new Date(startMs + Math.max(0, minutes) * 60_000);

  let t = startMs + TZ_OFFSET_MIN * 60_000; // shifted "local" epoch
  let remaining = minutes;
  for (let guard = 0; guard < 400; guard++) {
    const d = new Date(t);
    const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const mod = Math.floor((t - dayStart) / 60_000);
    const intervals = sched[DAY_KEYS[d.getUTCDay()]] || [];
    let advanced = false;
    for (const [a, b] of intervals) {
      const s = toMin(a);
      const e = toMin(b);
      if (mod >= e) continue;
      const from = Math.max(mod, s);
      const available = e - from;
      const use = Math.min(available, remaining);
      const at = dayStart + (from + use) * 60_000;
      remaining -= use;
      if (remaining <= 0) return new Date(at - TZ_OFFSET_MIN * 60_000);
      t = at;
      advanced = true;
    }
    // move to next day 00:00
    t = dayStart + 86_400_000;
    if (!advanced && guard > 370) break;
  }
  return new Date(startMs + minutes * 60_000);
}

/** Is `date` inside business hours? */
export function isBusinessTime(date, schedule) {
  const sched = normalizeSchedule(schedule);
  if (!sched) return true;
  const t = (date instanceof Date ? date.getTime() : Date.parse(date)) + TZ_OFFSET_MIN * 60_000;
  const d = new Date(t);
  const mod = Math.floor((t - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) / 60_000);
  return (sched[DAY_KEYS[d.getUTCDay()]] || []).some(([a, b]) => mod >= toMin(a) && mod < toMin(b));
}

export function scheduleToText(schedule) {
  const s = normalizeSchedule(schedule);
  if (!s) return '';
  const order = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
  const groups = [];
  for (const k of order) {
    const sig = JSON.stringify(s[k]);
    const last = groups[groups.length - 1];
    if (last && last.sig === sig) last.days.push(k);
    else groups.push({ sig, days: [k], iv: s[k] });
  }
  return groups
    .filter((g) => g.iv.length)
    .map((g) => `${g.days.length > 1 ? `${DAY_LABELS[g.days[0]]} تا ${DAY_LABELS[g.days[g.days.length - 1]]}` : DAY_LABELS[g.days[0]]} ${g.iv.map(([a, b]) => `${a} تا ${b}`).join(' و ')}`)
    .join('، ');
}
