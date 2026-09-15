import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import { db, now } from '../db.js';
import { config } from '../config.js';
import { hashPassword, verifyPassword, signToken, setAuthCookie, clearAuthCookie, requireAuth, sanitizeUser, normalizeMobile } from '../lib/auth.js';
import { validate, z, str, optStr, asyncHandler } from '../lib/validate.js';
import { getSetting } from '../lib/settings.js';
import { sendEmail, emailLayout, sendSms, smsEnabled, emailEnabled } from '../lib/notify.js';

const router = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'تعداد تلاش‌های ورود بیش از حد مجاز است. لطفاً ۱۵ دقیقه بعد دوباره تلاش کنید.' } });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'تعداد درخواست‌ها بیش از حد مجاز است.' } });

const emailSchema = z.string().trim().toLowerCase().email('ایمیل معتبر نیست.').max(190);
const passwordSchema = z.string().min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد.').max(128);

function findUserByIdentifier(identifier) {
  const id = String(identifier || '').trim().toLowerCase();
  if (!id) return null;
  const mobile = normalizeMobile(id);
  if (mobile) return db.prepare('SELECT * FROM users WHERE mobile = ?').get(mobile);
  return db.prepare('SELECT * FROM users WHERE email = ?').get(id);
}

function fullUser(u) {
  const out = sanitizeUser(u, { full: true });
  if (u.role === 'agent' || u.role === 'admin') {
    out.departments = db.prepare('SELECT d.id, d.name, d.slug, d.color, d.icon FROM agent_departments ad JOIN departments d ON d.id = ad.department_id WHERE ad.user_id = ?').all(u.id);
  }
  return out;
}

router.post(
  '/register',
  registerLimiter,
  validate(
    z.object({
      name: str(2, 100),
      email: emailSchema.optional().or(z.literal('')).transform((v) => v || null),
      mobile: z.string().optional().or(z.literal('')).transform((v) => v || null),
      password: passwordSchema,
      company: optStr(150),
    })
  ),
  asyncHandler(async (req, res) => {
    if (!getSetting('allow_registration')) return res.status(403).json({ error: 'ثبت‌نام غیرفعال است. لطفاً با پشتیبانی تماس بگیرید.' });
    const { name, email, password, company } = req.body;
    const mobile = req.body.mobile ? normalizeMobile(req.body.mobile) : null;
    if (req.body.mobile && !mobile) return res.status(400).json({ error: 'شماره موبایل معتبر نیست (مثال: 09123456789).', field: 'mobile' });
    if (!email && !mobile) return res.status(400).json({ error: 'ایمیل یا شماره موبایل الزامی است.', field: 'email' });
    if (email && db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'این ایمیل قبلاً ثبت شده است.', field: 'email' });
    if (mobile && db.prepare('SELECT id FROM users WHERE mobile = ?').get(mobile)) return res.status(409).json({ error: 'این شماره موبایل قبلاً ثبت شده است.', field: 'mobile' });

    const info = db.prepare("INSERT INTO users (name, email, mobile, password_hash, role, company) VALUES (?, ?, ?, ?, 'customer', ?)").run(name, email, mobile, hashPassword(password), company);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    db.prepare('INSERT INTO audit_log (actor_id, action, target, ip) VALUES (?, ?, ?, ?)').run(user.id, 'register', `user:${user.id}`, req.ip);
    const token = signToken(user);
    setAuthCookie(res, token);
    if (email) {
      sendEmail(email, `خوش آمدید به مرکز پشتیبانی ${getSetting('company_name')}`, emailLayout({ title: `${name} عزیز، خوش آمدید!`, intro: getSetting('welcome_message'), cta: 'ورود به پنل پشتیبانی', ctaUrl: config.appUrl }), getSetting('welcome_message'));
    }
    res.status(201).json({ user: fullUser(user), token });
  })
);

router.post(
  '/login',
  loginLimiter,
  validate(z.object({ identifier: str(3, 190), password: z.string().min(1, 'رمز عبور را وارد کنید.').max(128), remember: z.boolean().optional() })),
  asyncHandler(async (req, res) => {
    const user = findUserByIdentifier(req.body.identifier);
    if (!user || !verifyPassword(req.body.password, user.password_hash)) {
      return res.status(401).json({ error: 'ایمیل/موبایل یا رمز عبور اشتباه است.' });
    }
    if (!user.is_active) return res.status(403).json({ error: 'حساب کاربری شما غیرفعال شده است. با پشتیبانی تماس بگیرید.' });
    const token = signToken(user);
    setAuthCookie(res, token);
    db.prepare('INSERT INTO audit_log (actor_id, action, target, ip) VALUES (?, ?, ?, ?)').run(user.id, 'login', `user:${user.id}`, req.ip);
    res.json({ user: fullUser(user), token });
  })
);

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: fullUser(req.user) });
});

router.patch(
  '/me',
  requireAuth,
  validate(
    z.object({
      name: str(2, 100).optional(),
      email: emailSchema.optional().or(z.literal('')).transform((v) => (v === undefined ? undefined : v || null)),
      mobile: z.string().optional().or(z.literal('')).transform((v) => (v === undefined ? undefined : v || null)),
      company: optStr(150).optional(),
      title: optStr(100).optional(),
      notify_email: z.boolean().optional(),
      notify_sms: z.boolean().optional(),
    })
  ),
  (req, res) => {
    const u = req.user;
    const b = req.body;
    const updates = {};
    if (b.name !== undefined) updates.name = b.name;
    if (b.company !== undefined) updates.company = b.company;
    if (b.title !== undefined) updates.title = b.title;
    if (b.notify_email !== undefined) updates.notify_email = b.notify_email ? 1 : 0;
    if (b.notify_sms !== undefined) updates.notify_sms = b.notify_sms ? 1 : 0;
    if (b.email !== undefined) {
      if (b.email && db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(b.email, u.id)) return res.status(409).json({ error: 'این ایمیل قبلاً ثبت شده است.', field: 'email' });
      updates.email = b.email;
    }
    if (b.mobile !== undefined) {
      const m = b.mobile ? normalizeMobile(b.mobile) : null;
      if (b.mobile && !m) return res.status(400).json({ error: 'شماره موبایل معتبر نیست.', field: 'mobile' });
      if (m && db.prepare('SELECT id FROM users WHERE mobile = ? AND id != ?').get(m, u.id)) return res.status(409).json({ error: 'این شماره موبایل قبلاً ثبت شده است.', field: 'mobile' });
      updates.mobile = m;
    }
    const finalEmail = updates.email !== undefined ? updates.email : u.email;
    const finalMobile = updates.mobile !== undefined ? updates.mobile : u.mobile;
    if (!finalEmail && !finalMobile) return res.status(400).json({ error: 'حداقل یکی از ایمیل یا موبایل باید ثبت شود.' });
    const keys = Object.keys(updates);
    if (keys.length) {
      db.prepare(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).run(...keys.map((k) => updates[k]), now(), u.id);
    }
    res.json({ user: fullUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id)) });
  }
);

router.post(
  '/me/password',
  requireAuth,
  validate(z.object({ current_password: z.string().min(1, 'رمز فعلی را وارد کنید.'), new_password: passwordSchema })),
  (req, res) => {
    if (!verifyPassword(req.body.current_password, req.user.password_hash)) return res.status(400).json({ error: 'رمز عبور فعلی اشتباه است.', field: 'current_password' });
    db.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = ? WHERE id = ?').run(hashPassword(req.body.new_password), now(), req.user.id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const token = signToken(user);
    setAuthCookie(res, token);
    res.json({ ok: true, token });
  }
);

router.post(
  '/forgot',
  registerLimiter,
  validate(z.object({ identifier: str(3, 190) })),
  asyncHandler(async (req, res) => {
    const user = findUserByIdentifier(req.body.identifier);
    // Always respond success to avoid user enumeration
    if (user && user.is_active) {
      const token = crypto.randomBytes(32).toString('hex');
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      db.prepare('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(user.id, hash, expires);
      const url = `${config.appUrl}/reset-password?token=${token}`;
      if (user.email) {
        await sendEmail(user.email, 'بازیابی رمز عبور', emailLayout({ title: 'بازیابی رمز عبور', intro: `${user.name} عزیز، برای تعیین رمز عبور جدید روی دکمه زیر کلیک کنید. این لینک تا یک ساعت معتبر است.`, cta: 'تعیین رمز عبور جدید', ctaUrl: url, footer: 'اگر شما این درخواست را ثبت نکرده‌اید، این ایمیل را نادیده بگیرید.' }), url);
      } else if (user.mobile) {
        // No e-mail on file: mobile users sign in with a one-time code instead of a reset link.
        return res.json({ ok: true, otp_hint: true, message: 'برای این شماره ایمیلی ثبت نشده است. لطفاً از «ورود با کد یک‌بارمصرف» استفاده کنید و سپس رمز عبور را از پروفایل تغییر دهید.' });
      }
      if (!config.isProd) console.log('[password reset link]', url);
    }
    res.json({ ok: true, message: 'در صورت وجود حساب کاربری، لینک بازیابی برای شما ارسال شد.' });
  })
);

router.post(
  '/reset',
  registerLimiter,
  validate(z.object({ token: str(10, 200), password: passwordSchema })),
  (req, res) => {
    const hash = crypto.createHash('sha256').update(req.body.token).digest('hex');
    const row = db.prepare('SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL').get(hash);
    if (!row || Date.parse(row.expires_at) < Date.now()) return res.status(400).json({ error: 'لینک بازیابی نامعتبر یا منقضی شده است.' });
    db.prepare('UPDATE password_resets SET used_at = ? WHERE id = ?').run(now(), row.id);
    db.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = ? WHERE id = ?').run(hashPassword(req.body.password), now(), row.user_id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
    const token = signToken(user);
    setAuthCookie(res, token);
    res.json({ ok: true, user: fullUser(user), token });
  }
);

/* ---------------- OTP login (SMS / email one-time code) ---------------- */
const otpLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false, message: { error: 'تعداد درخواست کد بیش از حد مجاز است. چند دقیقه بعد تلاش کنید.' } });

function otpChannel(identifierRaw) {
  const id = String(identifierRaw || '').trim().toLowerCase();
  const mobile = normalizeMobile(id);
  if (mobile) return { kind: 'mobile', value: mobile };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id)) return { kind: 'email', value: id };
  return null;
}

router.post(
  '/otp/request',
  otpLimiter,
  validate(z.object({ identifier: str(3, 190) })),
  asyncHandler(async (req, res) => {
    if (!getSetting('otp_login_enabled')) return res.status(403).json({ error: 'ورود با کد یک‌بارمصرف غیرفعال است.' });
    const ch = otpChannel(req.body.identifier);
    if (!ch) return res.status(400).json({ error: 'شماره موبایل یا ایمیل معتبر وارد کنید.' });
    if (ch.kind === 'mobile' && !smsEnabled() && config.isProd) return res.status(503).json({ error: 'ارسال پیامک روی سرور فعال نیست. با رمز عبور وارد شوید یا از ایمیل استفاده کنید.' });
    if (ch.kind === 'email' && !emailEnabled() && config.isProd) return res.status(503).json({ error: 'ارسال ایمیل روی سرور فعال نیست. با رمز عبور وارد شوید.' });
    // throttle: one code per 60s per identifier
    const recent = db.prepare("SELECT created_at FROM otp_codes WHERE identifier = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1").get(ch.value);
    if (recent && Date.now() - Date.parse(recent.created_at) < 60_000) return res.status(429).json({ error: 'کد قبلی هنوز معتبر است. یک دقیقه بعد دوباره درخواست کنید.' });
    const code = String(crypto.randomInt(100000, 999999));
    const hash = crypto.createHash('sha256').update(`${ch.value}:${code}`).digest('hex');
    db.prepare('UPDATE otp_codes SET used_at = ? WHERE identifier = ? AND used_at IS NULL').run(now(), ch.value);
    db.prepare('INSERT INTO otp_codes (identifier, code_hash, expires_at) VALUES (?, ?, ?)').run(ch.value, hash, new Date(Date.now() + 5 * 60_000).toISOString());
    const company = getSetting('company_name');
    if (ch.kind === 'mobile') await sendSms(ch.value, `${company}: کد ورود شما ${code}\nاعتبار: ۵ دقیقه`, { template: 'otp', args: [code] });
    else await sendEmail(ch.value, `کد ورود به پشتیبانی ${company}`, emailLayout({ title: 'کد ورود یک‌بارمصرف', intro: 'برای ورود، این کد را در صفحه ورود وارد کنید. اعتبار کد ۵ دقیقه است.', body: code, footer: 'اگر شما درخواست ورود نداده‌اید، این پیام را نادیده بگیرید.' }), `کد ورود: ${code}`);
    if (!config.isProd) console.log('[otp]', ch.value, code);
    const exists = !!(ch.kind === 'mobile' ? db.prepare('SELECT id FROM users WHERE mobile = ?').get(ch.value) : db.prepare('SELECT id FROM users WHERE email = ?').get(ch.value));
    res.json({ ok: true, channel: ch.kind, exists, expires_in: 300, dev_code: config.isProd ? undefined : code });
  })
);

router.post(
  '/otp/verify',
  otpLimiter,
  validate(z.object({ identifier: str(3, 190), code: z.string().trim().regex(/^[0-9۰-۹]{6}$/, 'کد ۶ رقمی را وارد کنید.'), name: optStr(100), company: optStr(150) })),
  asyncHandler(async (req, res) => {
    const ch = otpChannel(req.body.identifier);
    if (!ch) return res.status(400).json({ error: 'شناسه معتبر نیست.' });
    const code = req.body.code.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
    const row = db.prepare('SELECT * FROM otp_codes WHERE identifier = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1').get(ch.value);
    if (!row || Date.parse(row.expires_at) < Date.now()) return res.status(400).json({ error: 'کد منقضی شده است. کد جدید درخواست کنید.' });
    if (row.attempts >= 5) return res.status(429).json({ error: 'تعداد تلاش بیش از حد. کد جدید درخواست کنید.' });
    const hash = crypto.createHash('sha256').update(`${ch.value}:${code}`).digest('hex');
    if (hash !== row.code_hash) {
      db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?').run(row.id);
      return res.status(400).json({ error: 'کد وارد شده اشتباه است.' });
    }
    let user = ch.kind === 'mobile' ? db.prepare('SELECT * FROM users WHERE mobile = ?').get(ch.value) : db.prepare('SELECT * FROM users WHERE email = ?').get(ch.value);
    if (!user) {
      if (!getSetting('allow_registration')) return res.status(403).json({ error: 'حساب کاربری با این مشخصات وجود ندارد و ثبت‌نام غیرفعال است.' });
      if (!req.body.name) return res.status(404).json({ error: 'حساب کاربری یافت نشد. برای ساخت حساب، نام خود را وارد کنید.', need_name: true });
      const info = db
        .prepare("INSERT INTO users (name, email, mobile, password_hash, role, company) VALUES (?, ?, ?, ?, 'customer', ?)")
        .run(req.body.name, ch.kind === 'email' ? ch.value : null, ch.kind === 'mobile' ? ch.value : null, hashPassword(crypto.randomBytes(16).toString('hex')), req.body.company);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
      db.prepare('INSERT INTO audit_log (actor_id, action, target, ip) VALUES (?, ?, ?, ?)').run(user.id, 'register_otp', `user:${user.id}`, req.ip);
    }
    if (!user.is_active) return res.status(403).json({ error: 'حساب کاربری شما غیرفعال شده است.' });
    db.prepare('UPDATE otp_codes SET used_at = ? WHERE id = ?').run(now(), row.id);
    const token = signToken(user);
    setAuthCookie(res, token);
    db.prepare('INSERT INTO audit_log (actor_id, action, target, ip) VALUES (?, ?, ?, ?)').run(user.id, 'login_otp', `user:${user.id}`, req.ip);
    res.json({ user: fullUser(user), token });
  })
);

export default router;
