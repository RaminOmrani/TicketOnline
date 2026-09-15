const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function faNum(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  return String(v).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export function enNum(v: string): string {
  return v.replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

const dateFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'long', day: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const shortDateFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'short', day: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' });
const weekdayFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long', day: 'numeric', month: 'long' });

export const formatDate = (iso?: string | null) => (iso ? dateFmt.format(new Date(iso)) : '');
export const formatDateTime = (iso?: string | null) => (iso ? dateTimeFmt.format(new Date(iso)) : '');
export const formatShortDate = (iso?: string | null) => (iso ? shortDateFmt.format(new Date(iso)) : '');
export const formatTime = (iso?: string | null) => (iso ? timeFmt.format(new Date(iso)) : '');
export const formatDayHeading = (iso?: string | null) => (iso ? weekdayFmt.format(new Date(iso)) : '');

export function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 90) return 'لحظاتی پیش';
  const m = Math.max(1, Math.round(s / 60));
  if (m < 60) return `${faNum(m)} دقیقه پیش`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${faNum(h)} ساعت پیش`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${faNum(d)} روز پیش`;
  if (d < 30) return `${faNum(Math.floor(d / 7))} هفته پیش`;
  return formatDate(iso);
}

export function timeLeft(iso?: string | null): { text: string; overdue: boolean; urgent: boolean } {
  if (!iso) return { text: '', overdue: false, urgent: false };
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const m = Math.floor(abs / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  let t: string;
  if (m < 60) t = `${faNum(m)} دقیقه`;
  else if (h < 24) t = `${faNum(h)} ساعت`;
  else t = `${faNum(d)} روز`;
  if (diff < 0) return { text: `${t} تأخیر`, overdue: true, urgent: true };
  return { text: `${t} مانده`, overdue: false, urgent: h < 4 };
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '۰ بایت';
  const units = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${faNum(n < 10 && i > 0 ? n.toFixed(1) : Math.round(n))} ${units[i]}`;
}

export function formatDuration(sec?: number | null): string {
  if (!sec || !isFinite(sec)) return '۰:۰۰';
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return faNum(`${m}:${String(r).padStart(2, '0')}`);
}

export function formatMinutes(min?: number | null): string {
  if (min === null || min === undefined) return '—';
  if (min < 60) return `${faNum(Math.round(min))} دقیقه`;
  const h = min / 60;
  if (h < 24) return `${faNum(Math.round(h * 10) / 10)} ساعت`;
  return `${faNum(Math.round((h / 24) * 10) / 10)} روز`;
}

export function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2);
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function shade(hex: string, amount: number): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)));
  return [f(r), f(g), f(b)];
}

/** Desaturate + lighten a colour so it stays readable on dark surfaces. */
export function softenForDark(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  const l = 0.299 * r + 0.587 * g + 0.114 * b;
  const mix = (c: number) => Math.round(c * 0.6 + l * 0.1 + 255 * 0.3); // 60% colour, a little grey, 30% white → muted brick tone
  return [mix(r), mix(g), mix(b)].map((c) => Math.max(0, Math.min(255, c))) as [number, number, number];
}

export function applyBrandColor(hex: string) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
  const root = document.documentElement;
  // Light theme: exact brand colour. Dark theme: a softer, desaturated tint (see index.css).
  root.style.setProperty('--brand-src-rgb', hexToRgb(hex).join(' '));
  root.style.setProperty('--brand-src-dark-rgb', shade(hex, -0.18).join(' '));
  root.style.setProperty('--brand-src-light-rgb', shade(hex, 0.35).join(' '));
  root.style.setProperty('--brand-src-deep-rgb', shade(hex, -0.65).join(' '));
  const soft = softenForDark(hex);
  root.style.setProperty('--brand-night-rgb', soft.join(' '));
  root.style.setProperty('--brand-night-dark-rgb', soft.map((c) => Math.round(c * 0.85)).join(' '));
  root.style.setProperty('--brand-night-light-rgb', soft.map((c) => Math.round(c + (255 - c) * 0.25)).join(' '));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', hex);
}

export function avatarColor(id: number | string): string {
  const palette = ['#A31A1A', '#6D1212', '#B45309', '#9F1239', '#7C2D12', '#4C0519', '#C2410C', '#57534E'];
  const n = typeof id === 'number' ? id : Array.from(String(id)).reduce((a, c) => a + c.charCodeAt(0), 0);
  return palette[n % palette.length];
}

export function linkify(text: string): string {
  const esc = text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
  return esc.replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
}

/** Minimal markdown → HTML for knowledge base articles (headings, lists, bold, code, links, blockquotes). */
export function renderMarkdown(md: string): string {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
  const inline = (s: string) =>
    esc(s)
      .replace(/!\[([^\]]*)\]\(((?:https?:\/\/|\/)[^\s)]+)\)/g, '<img src="$2" alt="$1" />')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
  const lines = md.replace(/\r/g, '').split('\n');
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      closeList();
      continue;
    }
    let m;
    if ((m = line.match(/^(#{1,3})\s+(.*)/))) {
      closeList();
      const lvl = m[1].length + 1;
      out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`);
    } else if ((m = line.match(/^>\s?(.*)/))) {
      closeList();
      out.push(`<blockquote>${inline(m[1])}</blockquote>`);
    } else if ((m = line.match(/^[-*]\s+(.*)/))) {
      if (list !== 'ul') {
        closeList();
        list = 'ul';
        out.push('<ul>');
      }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^\d+[.)]\s+(.*)/))) {
      if (list !== 'ol') {
        closeList();
        list = 'ol';
        out.push('<ol>');
      }
      out.push(`<li>${inline(m[1])}</li>`);
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join('\n');
}

/** Articles are stored either as legacy markdown or as (server-sanitized) HTML. */
export function renderArticle(body: string, format?: string): string {
  if (format === 'html' || (!format && /^\s*</.test(body))) return body;
  return renderMarkdown(body);
}
