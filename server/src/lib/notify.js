import nodemailer from 'nodemailer';
import { db } from '../db.js';
import { config } from '../config.js';
import { getSetting } from './settings.js';
import { emitToUser } from './realtime.js';

let transporter = null;
function getTransporter() {
  if (transporter !== null) return transporter;
  if (!config.smtp.host) {
    transporter = false;
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  return transporter;
}

export const emailEnabled = () => !!config.smtp.host;

/**
 * Effective SMS configuration: values saved in the admin panel (settings table)
 * take precedence over environment variables, so nothing needs to be edited in .env.
 */
export function smsConfig() {
  const s = (k) => {
    const v = getSetting(k);
    return v === undefined || v === null ? '' : String(v).trim();
  };
  const tplSaved = getSetting('sms_templates') || {};
  const templates = {};
  for (const k of Object.keys(config.sms.templates || {})) templates[k] = String(tplSaved[k] || config.sms.templates[k] || '').trim();
  return {
    provider: s('sms_provider') || config.sms.provider || '',
    apiKey: s('sms_api_key') || config.sms.apiKey || '',
    username: s('sms_username') || config.sms.username || '',
    password: s('sms_password') || config.sms.password || '',
    sender: s('sms_sender') || config.sms.sender || '',
    templates,
  };
}

export const smsEnabled = () => {
  const c = smsConfig();
  if (c.provider === 'kavenegar') return !!c.apiKey;
  if (c.provider === 'melipayamak') return !!c.apiKey || !!(c.username && c.password);
  return false;
};

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function emailLayout({ title, intro, body, cta, ctaUrl, footer }) {
  const brand = getSetting('brand_color') || '#A31A1A';
  const company = getSetting('company_name') || 'میلیونر';
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#f3f4f6;font-family:Tahoma,'Segoe UI',Arial,sans-serif;direction:rtl">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 8px">
<tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)">
<tr><td style="background:${brand};padding:22px 28px;color:#fff;font-size:20px;font-weight:bold">${escapeHtml(company)} — مرکز پشتیبانی</td></tr>
<tr><td style="padding:28px;color:#111827;font-size:15px;line-height:1.9">
<h2 style="margin:0 0 12px;font-size:18px">${escapeHtml(title)}</h2>
${intro ? `<p style="margin:0 0 14px;color:#374151">${escapeHtml(intro)}</p>` : ''}
${body ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:0 0 18px;white-space:pre-wrap">${escapeHtml(body)}</div>` : ''}
${cta && ctaUrl ? `<p style="margin:0 0 6px"><a href="${ctaUrl}" style="display:inline-block;background:${brand};color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold">${escapeHtml(cta)}</a></p>` : ''}
${footer ? `<p style="margin:18px 0 0;color:#6b7280;font-size:13px">${escapeHtml(footer)}</p>` : ''}
</td></tr>
<tr><td style="padding:16px 28px;background:#f9fafb;color:#9ca3af;font-size:12px;text-align:center">این ایمیل به‌صورت خودکار از سامانه پشتیبانی ${escapeHtml(company)} ارسال شده است. لطفاً به آن پاسخ ندهید.</td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendEmail(to, subject, html, text) {
  if (!to) return false;
  const t = getTransporter();
  if (!t) {
    if (!config.isProd) console.log(`[email:disabled] to=${to} subject=${subject}`);
    return false;
  }
  try {
    await t.sendMail({ from: config.smtp.from, to, subject, html, text });
    return true;
  } catch (e) {
    console.error('email send failed:', e.message);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  SMS                                                                */
/*                                                                     */
/*  sendSms(mobile, text)                      → plain text message    */
/*  sendSms(mobile, text, { template, args })  → pattern/template send */
/*                                                                     */
/*  Template keys map to env vars SMS_TPL_<KEY> holding the pattern    */
/*  (bodyId) number approved in the provider panel. When a template id */
/*  is missing the plain text is sent instead (needs a dedicated line).*/
/* ------------------------------------------------------------------ */
export const SMS_TEMPLATES = {
  otp: { env: 'SMS_TPL_OTP', args: ['کد'], text: 'کد ورود شما به پشتیبانی میلیونر: {0}\nاعتبار کد ۵ دقیقه است.' },
  ticket_created: { env: 'SMS_TPL_TICKET_CREATED', args: ['شماره تیکت'], text: 'میلیونر\nتیکت شما با شماره {0} ثبت شد. کارشناسان ما در اسرع وقت پاسخ می‌دهند.\nپیگیری: support.softmiliac.com' },
  ticket_reply: { env: 'SMS_TPL_TICKET_REPLY', args: ['شماره تیکت'], text: 'میلیونر\nپاسخ جدیدی برای تیکت {0} ثبت شد.\nمشاهده: support.softmiliac.com' },
  ticket_resolved: { env: 'SMS_TPL_TICKET_RESOLVED', args: ['شماره تیکت'], text: 'میلیونر\nتیکت {0} حل شد. لطفاً به کیفیت پشتیبانی امتیاز دهید.\nsupport.softmiliac.com' },
  ticket_assigned: { env: 'SMS_TPL_TICKET_ASSIGNED', args: ['شماره تیکت'], text: 'میلیونر\nتیکت {0} به شما تخصیص یافت.\nsupport.softmiliac.com' },
};

function templateId(key) {
  const t = SMS_TEMPLATES[key];
  if (!t) return null;
  const v = smsConfig().templates[key] || process.env[t.env];
  return v ? String(v).trim() : null;
}

/** Melli Payamak args must be single-line and free of ';' (REST separator). */
function cleanArg(a) {
  return String(a ?? '').replace(/[\r\n;]+/g, ' ').trim().slice(0, 60);
}

async function sendKavenegar(mobile, text) {
  const c = smsConfig();
  const url = `https://api.kavenegar.com/v1/${encodeURIComponent(c.apiKey)}/sms/send.json`;
  const params = new URLSearchParams({ receptor: mobile, message: text });
  if (c.sender) params.set('sender', c.sender);
  const res = await fetch(url, { method: 'POST', body: params, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  return res.ok;
}

async function sendMelipayamak(mobile, text, tpl) {
  const c = smsConfig();
  const bodyId = tpl?.template ? templateId(tpl.template) : null;
  const args = (tpl?.args || []).map(cleanArg);
  // 1) Pattern send through the shared service (no dedicated line needed)
  if (bodyId && c.apiKey) {
    const res = await fetch(`https://console.melipayamak.com/api/send/shared/${encodeURIComponent(c.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bodyId: Number(bodyId), to: mobile, args }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data.recId || data.status)) return true;
    console.error('melipayamak pattern send failed:', res.status, data);
    return false;
  }
  // 2) Pattern send through the legacy REST API (username/password)
  if (bodyId && c.username && c.password) {
    const res = await fetch('https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: c.username, password: c.password, text: args.join(';'), to: mobile, bodyId: Number(bodyId) }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && Number(data.RetStatus) === 1) return true;
    console.error('melipayamak REST pattern send failed:', res.status, data);
    return false;
  }
  // 3) Plain text (requires a dedicated sender line)
  if (c.apiKey) {
    const res = await fetch(`https://console.melipayamak.com/api/send/simple/${encodeURIComponent(c.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: c.sender || undefined, to: mobile, text }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data.recId || data.status)) return true;
    console.error('melipayamak simple send failed:', res.status, data);
    return false;
  }
  if (c.username && c.password) {
    const res = await fetch('https://rest.payamak-panel.com/api/SendSMS/SendSMS', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: c.username, password: c.password, from: c.sender, to: mobile, text }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok && Number(data.RetStatus) === 1;
  }
  return false;
}

export async function sendSms(mobile, text, tpl = null) {
  if (!mobile || !smsEnabled()) {
    if (!config.isProd && mobile) console.log(`[sms:disabled] to=${mobile}: ${text}${tpl ? ` (template ${tpl.template}: ${JSON.stringify(tpl.args)})` : ''}`);
    return false;
  }
  try {
    if (smsConfig().provider === 'melipayamak') return await sendMelipayamak(mobile, text, tpl);
    return await sendKavenegar(mobile, text);
  } catch (e) {
    console.error('sms send failed:', e.message);
    return false;
  }
}

export function createNotification({ userId, type, title, body = null, ticketId = null }) {
  const info = db
    .prepare('INSERT INTO notifications (user_id, type, title, body, ticket_id) VALUES (?, ?, ?, ?, ?)')
    .run(userId, type, title, body, ticketId);
  const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(info.lastInsertRowid);
  emitToUser(userId, 'notification:new', row);
  return row;
}

/**
 * Notify a user through all enabled channels.
 * opts: { type, title, body, ticket, email: {subject, intro, body, cta}, sms: string | { text, template, args } }
 */
export async function notifyUser(user, opts) {
  if (!user || !user.is_active) return;
  createNotification({ userId: user.id, type: opts.type, title: opts.title, body: opts.body || null, ticketId: opts.ticket?.id || null });
  const ticketUrl = opts.ticket ? `${config.appUrl}/tickets/${opts.ticket.id}` : config.appUrl;
  if (user.notify_email && user.email && opts.email) {
    const html = emailLayout({
      title: opts.email.subject || opts.title,
      intro: opts.email.intro,
      body: opts.email.body,
      cta: opts.email.cta || 'مشاهده تیکت',
      ctaUrl: ticketUrl,
      footer: opts.email.footer,
    });
    sendEmail(user.email, opts.email.subject || opts.title, html, `${opts.title}\n${opts.email.body || ''}\n${ticketUrl}`);
  }
  if (user.notify_sms && user.mobile && opts.sms) {
    if (typeof opts.sms === 'string') sendSms(user.mobile, opts.sms);
    else sendSms(user.mobile, opts.sms.text, { template: opts.sms.template, args: opts.sms.args });
  }
}
