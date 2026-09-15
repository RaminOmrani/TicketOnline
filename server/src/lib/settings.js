import { db } from '../db.js';

export const DEFAULT_SETTINGS = {
  company_name: 'میلیونر',
  company_name_en: 'Millionaire',
  slogan: 'میلیونر؛ هوشمندتر از همیشه',
  address: 'مشهد – خیابان راهنمایی – راهنمایی ۸ – پلاک ۵ – طبقه چهارم – واحد ۴۰۱',
  site_title: 'مرکز پشتیبانی میلیونر',
  tagline: 'پیشگام در حسابداری هوشمند ایران',
  logo: '',
  brand_color: '#8B0000',
  support_email: 'info@softmiliac.com',
  support_phone: '051-38473801-4',
  website: 'https://softmiliac.com',
  working_hours: 'شنبه تا پنجشنبه ۸:۳۰ الی ۱۷',
  products: ['نرم‌افزار حسابداری فروشگاهی', 'نرم‌افزار حسابداری شرکتی', 'نرم‌افزار حسابداری پخش مویرگی', 'نرم‌افزار حسابداری پخش مواد غذایی', 'سایر'],
  max_upload_mb: 100,
  max_attachments: 10,
  allowed_extensions: 'jpg,jpeg,png,gif,webp,bmp,heic,svg,mp4,webm,mov,mkv,avi,m4v,mp3,m4a,ogg,oga,wav,aac,opus,pdf,doc,docx,xls,xlsx,csv,ppt,pptx,txt,zip,rar,7z,json,xml,log,bak,sql,mdb,accdb',
  auto_close_resolved_days: 7,
  allow_registration: true,
  agents_see_all_departments: false,
  ticket_prefix: 'MLN',
  ticket_counter: 1000,
  welcome_message: 'به مرکز پشتیبانی میلیونر خوش آمدید. برای دریافت پاسخ سریع‌تر، لطفاً بخش مرتبط را انتخاب کرده و تا حد امکان جزئیات (نسخه نرم‌افزار، تصویر خطا و مراحل بازتولید) را ارسال کنید.',
  reopen_window_days: 30,
  otp_login_enabled: true,
  password_login_enabled: true,
  status_url: '',
  status_label: 'وضعیت سرویس‌ها و اختلالات',
  // SMS (admin panel; overrides SMS_* env vars) — never exposed publicly
  sms_provider: '',
  sms_api_key: '',
  sms_username: '',
  sms_password: '',
  sms_sender: '',
  sms_templates: { otp: '', ticket_created: '', ticket_reply: '', ticket_resolved: '', ticket_assigned: '' },
  notify_new_ticket_all_dept_agents: true,
  sla_priority_multiplier: { low: 2, normal: 1, high: 0.5, urgent: 0.25 },
};

const cache = new Map();

export function getSetting(key) {
  if (cache.has(key)) return cache.get(key);
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  const value = row ? JSON.parse(row.value) : DEFAULT_SETTINGS[key];
  cache.set(key, value);
  return value;
}

export function getAllSettings() {
  const out = {};
  for (const k of Object.keys(DEFAULT_SETTINGS)) out[k] = getSetting(k);
  return out;
}

export function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value));
  cache.set(key, value);
}

export function publicSettings() {
  const s = getAllSettings();
  return {
    company_name: s.company_name,
    company_name_en: s.company_name_en,
    site_title: s.site_title,
    tagline: s.tagline,
    slogan: s.slogan,
    address: s.address,
    logo: s.logo,
    brand_color: s.brand_color,
    support_email: s.support_email,
    support_phone: s.support_phone,
    website: s.website,
    working_hours: s.working_hours,
    products: s.products,
    max_upload_mb: s.max_upload_mb,
    max_attachments: s.max_attachments,
    allowed_extensions: s.allowed_extensions,
    allow_registration: s.allow_registration,
    welcome_message: s.welcome_message,
    reopen_window_days: s.reopen_window_days,
    otp_login_enabled: s.otp_login_enabled,
    password_login_enabled: s.password_login_enabled,
    status_url: s.status_url,
    status_label: s.status_label,
  };
}

export function nextTicketNumber(companyId) {
  const c = companyId ? db.prepare('SELECT id, ticket_prefix, ticket_counter FROM companies WHERE id = ?').get(companyId) : null;
  if (c) {
    const next = (Number(c.ticket_counter) || 1000) + 1;
    db.prepare('UPDATE companies SET ticket_counter = ? WHERE id = ?').run(next, c.id);
    return `${c.ticket_prefix || 'TKT'}-${next}`;
  }
  const prefix = getSetting('ticket_prefix');
  const current = Number(getSetting('ticket_counter')) || 1000;
  const next = current + 1;
  setSetting('ticket_counter', next);
  return `${prefix}-${next}`;
}
