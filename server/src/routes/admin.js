import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import multer from 'multer';
import sharp from 'sharp';
import { db, now } from '../db.js';
import { config } from '../config.js';
import { requireRole, hashPassword, sanitizeUser, normalizeMobile } from '../lib/auth.js';
import { validate, z, str, optStr, idParam, asyncHandler } from '../lib/validate.js';
import { getAllSettings, setSetting, DEFAULT_SETTINGS } from '../lib/settings.js';
import { onlineUserIds } from '../lib/realtime.js';
import { sendEmail, emailLayout, emailEnabled, smsEnabled } from '../lib/notify.js';

const router = Router();

/* =========== Customer search (agents + admins) =========== */
router.get('/customers', requireRole('agent', 'admin'), (req, res) => {
  const q = String(req.query.q || '').trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.min(100, Number(req.query.per_page) || 20);
  const where = ["u.role = 'customer'"];
  const params = [];
  if (q) {
    where.push('(u.name LIKE ? OR u.email LIKE ? OR u.mobile LIKE ? OR u.company LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  const base = `FROM users u WHERE ${where.join(' AND ')}`;
  const total = db.prepare(`SELECT COUNT(*) c ${base}`).get(...params).c;
  const rows = db
    .prepare(`SELECT u.*, (SELECT COUNT(*) FROM tickets t WHERE t.customer_id = u.id) AS ticket_count, (SELECT COUNT(*) FROM tickets t WHERE t.customer_id = u.id AND t.status NOT IN ('resolved','closed')) AS open_count ${base} ORDER BY u.id DESC LIMIT ? OFFSET ?`)
    .all(...params, perPage, (page - 1) * perPage);
  res.json({ items: rows.map((r) => ({ ...sanitizeUser(r, { full: true }), ticket_count: r.ticket_count, open_count: r.open_count })), total, page, pages: Math.max(1, Math.ceil(total / perPage)) });
});

/* =========== Staff list (agents + admins can see colleagues) =========== */
router.get('/staff', requireRole('agent', 'admin'), (req, res) => {
  const online = onlineUserIds();
  const rows = db.prepare("SELECT * FROM users WHERE role IN ('agent','admin') ORDER BY role DESC, name").all();
  res.json({
    items: rows.map((r) => ({
      ...sanitizeUser(r, { full: true }),
      online: online.has(r.id),
      departments: db.prepare('SELECT d.id, d.name, d.color FROM agent_departments ad JOIN departments d ON d.id = ad.department_id WHERE ad.user_id = ?').all(r.id),
      load: db.prepare("SELECT COUNT(*) c FROM tickets WHERE assignee_id = ? AND status NOT IN ('resolved','closed')").get(r.id).c,
    })),
  });
});

/* Everything below is admin-only */
router.use(requireRole('admin'));

/* =========== Dashboard stats =========== */
router.get('/stats', (req, res) => {
  const days = Math.min(365, Math.max(7, Number(req.query.days) || 30));
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const t = now();
  const totals = db
    .prepare(
      `SELECT COUNT(*) total,
        COALESCE(SUM(status='open'),0) open, COALESCE(SUM(status='in_progress'),0) in_progress, COALESCE(SUM(status='waiting_customer'),0) waiting_customer,
        COALESCE(SUM(status='resolved'),0) resolved, COALESCE(SUM(status='closed'),0) closed,
        COALESCE(SUM(assignee_id IS NULL AND status NOT IN ('resolved','closed')),0) unassigned,
        COALESCE(SUM(due_at IS NOT NULL AND due_at < ? AND status NOT IN ('resolved','closed')),0) overdue,
        COALESCE(SUM(created_at >= ?),0) created_period,
        COALESCE(SUM(resolved_at >= ?),0) resolved_period,
        ROUND(AVG(CASE WHEN first_response_at IS NOT NULL AND created_at >= ? THEN (julianday(first_response_at)-julianday(created_at))*24*60 END)) avg_first_response_min,
        ROUND(AVG(CASE WHEN resolved_at IS NOT NULL AND created_at >= ? THEN (julianday(resolved_at)-julianday(created_at))*24*60 END)) avg_resolve_min,
        ROUND(AVG(CASE WHEN rated_at >= ? THEN rating END),2) avg_rating,
        COALESCE(SUM(rated_at >= ?),0) rated_count
       FROM tickets`
    )
    .get(t, since, since, since, since, since, since);

  const perDay = db
    .prepare(`SELECT substr(created_at,1,10) day, COUNT(*) created FROM tickets WHERE created_at >= ? GROUP BY day ORDER BY day`)
    .all(since);
  const resolvedPerDay = db.prepare(`SELECT substr(resolved_at,1,10) day, COUNT(*) resolved FROM tickets WHERE resolved_at >= ? GROUP BY day ORDER BY day`).all(since);
  const dayMap = new Map();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    dayMap.set(d, { day: d, created: 0, resolved: 0 });
  }
  perDay.forEach((r) => dayMap.has(r.day) && (dayMap.get(r.day).created = r.created));
  resolvedPerDay.forEach((r) => dayMap.has(r.day) && (dayMap.get(r.day).resolved = r.resolved));

  const byDepartment = db
    .prepare(
      `SELECT d.id, d.name, d.color, COUNT(t.id) total, COALESCE(SUM(t.status NOT IN ('resolved','closed')),0) open,
        ROUND(AVG(CASE WHEN t.first_response_at IS NOT NULL THEN (julianday(t.first_response_at)-julianday(t.created_at))*24*60 END)) avg_first_response_min,
        ROUND(AVG(t.rating),2) avg_rating
       FROM departments d LEFT JOIN tickets t ON t.department_id = d.id AND t.created_at >= ? GROUP BY d.id ORDER BY d.sort_order`
    )
    .all(since);
  const byPriority = db.prepare(`SELECT priority, COUNT(*) c FROM tickets WHERE created_at >= ? GROUP BY priority`).all(since);
  const byAgent = db
    .prepare(
      `SELECT u.id, u.name, u.avatar,
        (SELECT COUNT(*) FROM tickets t WHERE t.assignee_id = u.id AND t.status NOT IN ('resolved','closed')) open,
        (SELECT COUNT(*) FROM tickets t WHERE t.assignee_id = u.id AND t.resolved_at >= ?) resolved_period,
        (SELECT COUNT(*) FROM messages m JOIN tickets t ON t.id = m.ticket_id WHERE m.sender_id = u.id AND m.type = 'message' AND m.created_at >= ?) replies_period,
        (SELECT ROUND(AVG(rating),2) FROM tickets t WHERE t.assignee_id = u.id AND t.rated_at >= ?) avg_rating
       FROM users u WHERE u.role IN ('agent','admin') AND u.is_active = 1 ORDER BY resolved_period DESC`
    )
    .all(since, since, since);
  const ratings = db.prepare(`SELECT rating, COUNT(*) c FROM tickets WHERE rated_at >= ? GROUP BY rating`).all(since);
  const customers = db.prepare("SELECT COUNT(*) total, COALESCE(SUM(created_at >= ?),0) new_period FROM users WHERE role = 'customer'").get(since);
  const recent = db.prepare('SELECT id, number, subject, status, priority, created_at, customer_id, department_id FROM tickets ORDER BY id DESC LIMIT 8').all().map((r) => ({
    ...r,
    customer: sanitizeUser(db.prepare('SELECT * FROM users WHERE id = ?').get(r.customer_id)),
    department: db.prepare('SELECT id, name, color FROM departments WHERE id = ?').get(r.department_id),
  }));
  res.json({ days, totals, per_day: [...dayMap.values()], by_department: byDepartment, by_priority: byPriority, by_agent: byAgent, ratings, customers, recent, online: onlineUserIds().size });
});

/* =========== Departments =========== */
router.get('/departments', (req, res) => {
  const rows = db.prepare('SELECT * FROM departments ORDER BY sort_order, id').all();
  res.json({
    items: rows.map((d) => ({
      ...d,
      agents: db.prepare('SELECT u.id, u.name, u.avatar FROM agent_departments ad JOIN users u ON u.id = ad.user_id WHERE ad.department_id = ? ORDER BY u.name').all(d.id),
      open_tickets: db.prepare("SELECT COUNT(*) c FROM tickets WHERE department_id = ? AND status NOT IN ('resolved','closed')").get(d.id).c,
    })),
  });
});

const deptSchema = z.object({
  name: str(2, 80),
  slug: optStr(60),
  description: optStr(300),
  icon: optStr(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'رنگ معتبر نیست.').optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  sla_first_response_minutes: z.number().int().min(5).max(100000).optional(),
  sla_resolve_minutes: z.number().int().min(15).max(1000000).optional(),
  auto_assign: z.boolean().optional(),
  agent_ids: z.array(z.number().int()).optional(),
});

function slugify(s) {
  return String(s).trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || `dept-${Date.now()}`;
}

router.post('/departments', validate(deptSchema), (req, res) => {
  const b = req.body;
  let slug = b.slug || slugify(b.name);
  if (db.prepare('SELECT id FROM departments WHERE slug = ?').get(slug)) slug = `${slug}-${Date.now().toString(36)}`;
  const info = db
    .prepare('INSERT INTO departments (name, slug, description, icon, color, is_active, sort_order, sla_first_response_minutes, sla_resolve_minutes, auto_assign) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(b.name, slug, b.description, b.icon || 'life-buoy', b.color || '#A31A1A', b.is_active === false ? 0 : 1, b.sort_order ?? 0, b.sla_first_response_minutes ?? 240, b.sla_resolve_minutes ?? 2880, b.auto_assign === false ? 0 : 1);
  const id = info.lastInsertRowid;
  if (b.agent_ids) {
    const ins = db.prepare('INSERT OR IGNORE INTO agent_departments (user_id, department_id) VALUES (?, ?)');
    b.agent_ids.forEach((uid) => ins.run(uid, id));
  }
  res.status(201).json({ item: db.prepare('SELECT * FROM departments WHERE id = ?').get(id) });
});

router.patch('/departments/:id', validate(idParam, 'params'), validate(deptSchema.partial()), (req, res) => {
  const d = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'بخش یافت نشد.' });
  const b = req.body;
  const merged = {
    name: b.name ?? d.name,
    slug: b.slug ?? d.slug,
    description: b.description === undefined ? d.description : b.description,
    icon: b.icon ?? d.icon,
    color: b.color ?? d.color,
    is_active: b.is_active === undefined ? d.is_active : b.is_active ? 1 : 0,
    sort_order: b.sort_order ?? d.sort_order,
    sla_first_response_minutes: b.sla_first_response_minutes ?? d.sla_first_response_minutes,
    sla_resolve_minutes: b.sla_resolve_minutes ?? d.sla_resolve_minutes,
    auto_assign: b.auto_assign === undefined ? d.auto_assign : b.auto_assign ? 1 : 0,
  };
  if (merged.slug !== d.slug && db.prepare('SELECT id FROM departments WHERE slug = ? AND id != ?').get(merged.slug, d.id)) return res.status(409).json({ error: 'این نامک قبلاً استفاده شده است.' });
  db.prepare('UPDATE departments SET name=?, slug=?, description=?, icon=?, color=?, is_active=?, sort_order=?, sla_first_response_minutes=?, sla_resolve_minutes=?, auto_assign=? WHERE id=?').run(
    merged.name, merged.slug, merged.description, merged.icon, merged.color, merged.is_active, merged.sort_order, merged.sla_first_response_minutes, merged.sla_resolve_minutes, merged.auto_assign, d.id
  );
  if (b.agent_ids) {
    db.transaction(() => {
      db.prepare('DELETE FROM agent_departments WHERE department_id = ?').run(d.id);
      const ins = db.prepare('INSERT OR IGNORE INTO agent_departments (user_id, department_id) VALUES (?, ?)');
      b.agent_ids.forEach((uid) => ins.run(uid, d.id));
    })();
  }
  res.json({ item: db.prepare('SELECT * FROM departments WHERE id = ?').get(d.id) });
});

router.delete('/departments/:id', validate(idParam, 'params'), (req, res) => {
  const count = db.prepare('SELECT COUNT(*) c FROM tickets WHERE department_id = ?').get(req.params.id).c;
  if (count > 0) return res.status(400).json({ error: `این بخش ${count} تیکت دارد. به‌جای حذف، آن را غیرفعال کنید.` });
  db.prepare('DELETE FROM departments WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

/* =========== Users =========== */
router.get('/users', (req, res) => {
  const q = String(req.query.q || '').trim();
  const role = String(req.query.role || '');
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.min(100, Number(req.query.per_page) || 25);
  const where = ['1=1'];
  const params = [];
  if (role && ['customer', 'agent', 'admin'].includes(role)) {
    where.push('u.role = ?');
    params.push(role);
  }
  if (q) {
    where.push('(u.name LIKE ? OR u.email LIKE ? OR u.mobile LIKE ? OR u.company LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  const base = `FROM users u WHERE ${where.join(' AND ')}`;
  const total = db.prepare(`SELECT COUNT(*) c ${base}`).get(...params).c;
  const rows = db.prepare(`SELECT u.*, (SELECT COUNT(*) FROM tickets t WHERE t.customer_id = u.id OR t.assignee_id = u.id) AS ticket_count ${base} ORDER BY u.id DESC LIMIT ? OFFSET ?`).all(...params, perPage, (page - 1) * perPage);
  const online = onlineUserIds();
  res.json({
    items: rows.map((r) => ({
      ...sanitizeUser(r, { full: true }),
      ticket_count: r.ticket_count,
      online: online.has(r.id),
      departments: db.prepare('SELECT d.id, d.name, d.color FROM agent_departments ad JOIN departments d ON d.id = ad.department_id WHERE ad.user_id = ?').all(r.id),
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / perPage)),
  });
});

const userSchema = z.object({
  name: str(2, 100),
  email: z.string().trim().toLowerCase().email('ایمیل معتبر نیست.').optional().or(z.literal('')).transform((v) => v || null),
  mobile: z.string().optional().or(z.literal('')).transform((v) => v || null),
  password: z.string().min(8, 'رمز عبور حداقل ۸ کاراکتر.').max(128).optional().or(z.literal('')).transform((v) => v || undefined),
  role: z.enum(['customer', 'agent', 'admin']).default('customer'),
  company: optStr(150),
  title: optStr(100),
  is_active: z.boolean().optional(),
  notify_email: z.boolean().optional(),
  notify_sms: z.boolean().optional(),
  department_ids: z.array(z.number().int()).optional(),
  send_welcome: z.boolean().optional(),
});

router.post('/users', validate(userSchema), asyncHandler(async (req, res) => {
  const b = req.body;
  const mobile = b.mobile ? normalizeMobile(b.mobile) : null;
  if (b.mobile && !mobile) return res.status(400).json({ error: 'شماره موبایل معتبر نیست.', field: 'mobile' });
  if (!b.email && !mobile) return res.status(400).json({ error: 'ایمیل یا موبایل الزامی است.', field: 'email' });
  if (b.email && db.prepare('SELECT id FROM users WHERE email = ?').get(b.email)) return res.status(409).json({ error: 'این ایمیل قبلاً ثبت شده است.', field: 'email' });
  if (mobile && db.prepare('SELECT id FROM users WHERE mobile = ?').get(mobile)) return res.status(409).json({ error: 'این موبایل قبلاً ثبت شده است.', field: 'mobile' });
  const password = b.password || crypto.randomBytes(6).toString('base64url');
  const info = db
    .prepare('INSERT INTO users (name, email, mobile, password_hash, role, company, title, is_active, notify_email, notify_sms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(b.name, b.email, mobile, hashPassword(password), b.role, b.company, b.title, b.is_active === false ? 0 : 1, b.notify_email === false ? 0 : 1, b.notify_sms === false ? 0 : 1);
  const id = info.lastInsertRowid;
  if (b.department_ids && b.role !== 'customer') {
    const ins = db.prepare('INSERT OR IGNORE INTO agent_departments (user_id, department_id) VALUES (?, ?)');
    b.department_ids.forEach((d) => ins.run(id, d));
  }
  db.prepare('INSERT INTO audit_log (actor_id, action, target, ip) VALUES (?, ?, ?, ?)').run(req.user.id, 'user_create', `user:${id}`, req.ip);
  if (b.send_welcome !== false && b.email) {
    await sendEmail(b.email, 'حساب کاربری شما در مرکز پشتیبانی میلیونر', emailLayout({ title: `${b.name} عزیز، حساب شما ایجاد شد`, intro: 'اطلاعات ورود شما به سامانه پشتیبانی:', body: `نام کاربری: ${b.email || mobile}\nرمز عبور: ${password}`, cta: 'ورود به سامانه', ctaUrl: `${config.appUrl}/login`, footer: 'توصیه می‌کنیم پس از ورود، رمز عبور خود را تغییر دهید.' }));
  }
  res.status(201).json({ user: sanitizeUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id), { full: true }), generated_password: b.password ? undefined : password });
}));

router.patch('/users/:id', validate(idParam, 'params'), validate(userSchema.partial()), (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'کاربر یافت نشد.' });
  const b = req.body;
  const updates = {};
  if (b.name !== undefined) updates.name = b.name;
  if (b.company !== undefined) updates.company = b.company;
  if (b.title !== undefined) updates.title = b.title;
  if (b.role !== undefined) {
    if (u.id === req.user.id && b.role !== 'admin') return res.status(400).json({ error: 'نمی‌توانید نقش خودتان را تغییر دهید.' });
    updates.role = b.role;
  }
  if (b.is_active !== undefined) {
    if (u.id === req.user.id && !b.is_active) return res.status(400).json({ error: 'نمی‌توانید حساب خودتان را غیرفعال کنید.' });
    updates.is_active = b.is_active ? 1 : 0;
    if (!b.is_active) updates.token_version = u.token_version + 1;
  }
  if (b.notify_email !== undefined) updates.notify_email = b.notify_email ? 1 : 0;
  if (b.notify_sms !== undefined) updates.notify_sms = b.notify_sms ? 1 : 0;
  if (b.email !== undefined) {
    if (b.email && db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(b.email, u.id)) return res.status(409).json({ error: 'این ایمیل قبلاً ثبت شده است.', field: 'email' });
    updates.email = b.email;
  }
  if (b.mobile !== undefined) {
    const m = b.mobile ? normalizeMobile(b.mobile) : null;
    if (b.mobile && !m) return res.status(400).json({ error: 'شماره موبایل معتبر نیست.', field: 'mobile' });
    if (m && db.prepare('SELECT id FROM users WHERE mobile = ? AND id != ?').get(m, u.id)) return res.status(409).json({ error: 'این موبایل قبلاً ثبت شده است.', field: 'mobile' });
    updates.mobile = m;
  }
  if (b.password) {
    updates.password_hash = hashPassword(b.password);
    updates.token_version = (updates.token_version ?? u.token_version) + 1;
  }
  const keys = Object.keys(updates);
  if (keys.length) db.prepare(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).run(...keys.map((k) => updates[k]), now(), u.id);
  if (b.department_ids) {
    db.transaction(() => {
      db.prepare('DELETE FROM agent_departments WHERE user_id = ?').run(u.id);
      const ins = db.prepare('INSERT OR IGNORE INTO agent_departments (user_id, department_id) VALUES (?, ?)');
      b.department_ids.forEach((d) => ins.run(u.id, d));
    })();
  }
  db.prepare('INSERT INTO audit_log (actor_id, action, target, data, ip) VALUES (?, ?, ?, ?, ?)').run(req.user.id, 'user_update', `user:${u.id}`, JSON.stringify(Object.keys(b)), req.ip);
  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(u.id);
  res.json({ user: { ...sanitizeUser(fresh, { full: true }), departments: db.prepare('SELECT d.id, d.name, d.color FROM agent_departments ad JOIN departments d ON d.id = ad.department_id WHERE ad.user_id = ?').all(u.id) } });
});

router.delete('/users/:id', validate(idParam, 'params'), (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'کاربر یافت نشد.' });
  if (u.id === req.user.id) return res.status(400).json({ error: 'نمی‌توانید حساب خودتان را حذف کنید.' });
  const tickets = db.prepare('SELECT COUNT(*) c FROM tickets WHERE customer_id = ?').get(u.id).c;
  if (tickets > 0) return res.status(400).json({ error: `این کاربر ${tickets} تیکت دارد. به‌جای حذف، حساب را غیرفعال کنید.` });
  db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
  db.prepare('INSERT INTO audit_log (actor_id, action, target, ip) VALUES (?, ?, ?, ?)').run(req.user.id, 'user_delete', `user:${u.id}`, req.ip);
  res.json({ ok: true });
});

/* =========== Settings =========== */
router.get('/settings', (req, res) => {
  res.json({ settings: getAllSettings(), channels: { email: emailEnabled(), sms: smsEnabled() }, defaults: DEFAULT_SETTINGS });
});

const settingsSchema = z.object({
  company_name: str(1, 80).optional(),
  company_name_en: optStr(80).optional(),
  site_title: str(1, 120).optional(),
  tagline: optStr(200).optional(),
  slogan: optStr(120).optional(),
  address: optStr(300).optional(),
  brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  support_email: optStr(120).optional(),
  support_phone: optStr(60).optional(),
  website: optStr(200).optional(),
  working_hours: optStr(200).optional(),
  products: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  max_upload_mb: z.number().int().min(1).max(2048).optional(),
  max_attachments: z.number().int().min(1).max(30).optional(),
  allowed_extensions: z.string().max(2000).optional(),
  auto_close_resolved_days: z.number().int().min(0).max(365).optional(),
  allow_registration: z.boolean().optional(),
  agents_see_all_departments: z.boolean().optional(),
  ticket_prefix: z.string().trim().regex(/^[A-Za-z]{1,6}$/, 'پیشوند فقط حروف انگلیسی (حداکثر ۶ حرف).').optional(),
  welcome_message: optStr(1000).optional(),
  reopen_window_days: z.number().int().min(1).max(365).optional(),
  notify_new_ticket_all_dept_agents: z.boolean().optional(),
  sla_priority_multiplier: z.object({ low: z.number().positive(), normal: z.number().positive(), high: z.number().positive(), urgent: z.number().positive() }).optional(),
});

router.put('/settings', validate(settingsSchema), (req, res) => {
  for (const [k, v] of Object.entries(req.body)) {
    if (v === undefined) continue;
    setSetting(k, v);
  }
  db.prepare('INSERT INTO audit_log (actor_id, action, target, data, ip) VALUES (?, ?, ?, ?, ?)').run(req.user.id, 'settings_update', 'settings', JSON.stringify(Object.keys(req.body)), req.ip);
  res.json({ settings: getAllSettings() });
});

const brandingDir = path.join(config.dataDir, 'branding');
fs.mkdirSync(brandingDir, { recursive: true });
const logoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/settings/logo', (req, res, next) => logoUpload.single('logo')(req, res, (err) => (err ? res.status(400).json({ error: 'حجم لوگو حداکثر ۵ مگابایت.' }) : next())), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'فایل لوگو ارسال نشده است.' });
  const isSvg = req.file.mimetype === 'image/svg+xml';
  let name;
  if (isSvg) {
    name = `logo-${Date.now()}.svg`;
    fs.writeFileSync(path.join(brandingDir, name), req.file.buffer);
  } else {
    name = `logo-${Date.now()}.png`;
    try {
      await sharp(req.file.buffer).resize({ width: 800, height: 400, fit: 'inside', withoutEnlargement: true }).png().toFile(path.join(brandingDir, name));
    } catch {
      return res.status(400).json({ error: 'فایل تصویر معتبر نیست.' });
    }
  }
  const url = `/branding/${name}`;
  setSetting('logo', url);
  res.json({ logo: url });
}));

router.delete('/settings/logo', (req, res) => {
  setSetting('logo', '');
  res.json({ ok: true });
});

/* =========== Audit log =========== */
router.get('/audit', (req, res) => {
  const rows = db.prepare('SELECT a.*, u.name AS actor_name FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT 200').all();
  res.json({ items: rows });
});

/* =========== Export tickets CSV =========== */
router.get('/export/tickets.csv', (req, res) => {
  const rows = db
    .prepare(
      `SELECT t.number, t.subject, t.status, t.priority, d.name department, c.name customer, c.company, c.email, c.mobile, a.name assignee, t.created_at, t.first_response_at, t.resolved_at, t.closed_at, t.rating
       FROM tickets t JOIN departments d ON d.id = t.department_id JOIN users c ON c.id = t.customer_id LEFT JOIN users a ON a.id = t.assignee_id ORDER BY t.id DESC`
    )
    .all();
  const header = ['شماره', 'موضوع', 'وضعیت', 'اولویت', 'بخش', 'مشتری', 'شرکت', 'ایمیل', 'موبایل', 'کارشناس', 'ایجاد', 'اولین پاسخ', 'حل', 'بستن', 'امتیاز'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = '﻿' + [header.map(esc).join(','), ...rows.map((r) => Object.values(r).map(esc).join(','))].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="tickets-${Date.now()}.csv"`);
  res.send(csv);
});

export default router;
