import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import sharp from 'sharp';
import { db } from '../db.js';
import { config } from '../config.js';
import { requireRole } from '../lib/auth.js';
import { validate, z, str, optStr, idParam, asyncHandler } from '../lib/validate.js';
import { normalizeSchedule, DEFAULT_BUSINESS_HOURS, scheduleToText } from '../lib/businessHours.js';

const router = Router();

function shape(c) {
  let hours = null;
  try {
    hours = c.business_hours ? JSON.parse(c.business_hours) : null;
  } catch {}
  return {
    ...c,
    business_hours: hours,
    business_hours_text: scheduleToText(hours || DEFAULT_BUSINESS_HOURS),
    products: db.prepare('SELECT id, name, sort_order, is_active FROM products WHERE company_id = ? ORDER BY sort_order, id').all(c.id),
    departments: db.prepare('SELECT id, name, icon, is_active FROM departments WHERE company_id = ? ORDER BY sort_order, id').all(c.id),
    ticket_count: db.prepare('SELECT COUNT(*) c FROM tickets WHERE company_id = ?').get(c.id).c,
    open_tickets: db.prepare("SELECT COUNT(*) c FROM tickets WHERE company_id = ? AND status NOT IN ('resolved','closed')").get(c.id).c,
  };
}

/* Staff can list companies (for filters); admin manages */
router.get('/', requireRole('agent', 'admin'), (req, res) => {
  const rows = db.prepare('SELECT * FROM companies ORDER BY sort_order, id').all();
  res.json({ items: rows.map(shape) });
});

router.use(requireRole('admin'));

const hoursSchema = z.record(z.string(), z.array(z.tuple([z.string(), z.string()]))).nullable().optional();
const schema = z.object({
  name: str(2, 80),
  name_en: optStr(80),
  slug: optStr(60),
  description: optStr(300),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'رنگ معتبر نیست.').optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  ticket_prefix: z.string().trim().regex(/^[A-Za-z]{1,6}$/, 'پیشوند فقط حروف انگلیسی (حداکثر ۶ حرف).').optional(),
  support_email: optStr(120),
  support_phone: optStr(60),
  website: optStr(200),
  business_hours: hoursSchema,
  products: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
});

function slugify(s) {
  return String(s).trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || `company-${Date.now()}`;
}

function saveProducts(companyId, names) {
  db.transaction(() => {
    const existing = db.prepare('SELECT id, name FROM products WHERE company_id = ?').all(companyId);
    const keep = new Set();
    names.forEach((name, i) => {
      const found = existing.find((p) => p.name === name);
      if (found) {
        db.prepare('UPDATE products SET sort_order = ?, is_active = 1 WHERE id = ?').run(i, found.id);
        keep.add(found.id);
      } else {
        const info = db.prepare('INSERT INTO products (company_id, name, sort_order) VALUES (?, ?, ?)').run(companyId, name, i);
        keep.add(info.lastInsertRowid);
      }
    });
    existing.filter((p) => !keep.has(p.id)).forEach((p) => db.prepare('DELETE FROM products WHERE id = ?').run(p.id));
  })();
}

router.post('/', validate(schema), (req, res) => {
  const b = req.body;
  let slug = b.slug || slugify(b.name_en || b.name);
  if (db.prepare('SELECT id FROM companies WHERE slug = ?').get(slug)) slug = `${slug}-${Date.now().toString(36)}`;
  const hours = b.business_hours === undefined ? DEFAULT_BUSINESS_HOURS : normalizeSchedule(b.business_hours);
  const info = db
    .prepare('INSERT INTO companies (name, name_en, slug, description, color, is_active, sort_order, ticket_prefix, support_email, support_phone, website, business_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(b.name, b.name_en, slug, b.description, b.color || '#8B0000', b.is_active === false ? 0 : 1, b.sort_order ?? 0, (b.ticket_prefix || 'TKT').toUpperCase(), b.support_email, b.support_phone, b.website, hours ? JSON.stringify(hours) : null);
  if (b.products) saveProducts(info.lastInsertRowid, b.products);
  res.status(201).json({ item: shape(db.prepare('SELECT * FROM companies WHERE id = ?').get(info.lastInsertRowid)) });
});

router.patch('/:id', validate(idParam, 'params'), validate(schema.partial()), (req, res) => {
  const c = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'شرکت یافت نشد.' });
  const b = req.body;
  const m = {
    name: b.name ?? c.name,
    name_en: b.name_en === undefined ? c.name_en : b.name_en,
    slug: b.slug ?? c.slug,
    description: b.description === undefined ? c.description : b.description,
    color: b.color ?? c.color,
    is_active: b.is_active === undefined ? c.is_active : b.is_active ? 1 : 0,
    sort_order: b.sort_order ?? c.sort_order,
    ticket_prefix: b.ticket_prefix ? b.ticket_prefix.toUpperCase() : c.ticket_prefix,
    support_email: b.support_email === undefined ? c.support_email : b.support_email,
    support_phone: b.support_phone === undefined ? c.support_phone : b.support_phone,
    website: b.website === undefined ? c.website : b.website,
    business_hours: b.business_hours === undefined ? c.business_hours : (() => { const n = normalizeSchedule(b.business_hours); return n ? JSON.stringify(n) : null; })(),
  };
  if (m.slug !== c.slug && db.prepare('SELECT id FROM companies WHERE slug = ? AND id != ?').get(m.slug, c.id)) return res.status(409).json({ error: 'این نامک قبلاً استفاده شده است.' });
  db.prepare('UPDATE companies SET name=?, name_en=?, slug=?, description=?, color=?, is_active=?, sort_order=?, ticket_prefix=?, support_email=?, support_phone=?, website=?, business_hours=? WHERE id=?').run(
    m.name, m.name_en, m.slug, m.description, m.color, m.is_active, m.sort_order, m.ticket_prefix, m.support_email, m.support_phone, m.website, m.business_hours, c.id
  );
  if (b.products) saveProducts(c.id, b.products);
  res.json({ item: shape(db.prepare('SELECT * FROM companies WHERE id = ?').get(c.id)) });
});

router.delete('/:id', validate(idParam, 'params'), (req, res) => {
  const count = db.prepare('SELECT COUNT(*) c FROM tickets WHERE company_id = ?').get(req.params.id).c;
  if (count > 0) return res.status(400).json({ error: `این شرکت ${count} تیکت دارد. به‌جای حذف، آن را غیرفعال کنید.` });
  if (db.prepare('SELECT COUNT(*) c FROM companies').get().c <= 1) return res.status(400).json({ error: 'حداقل یک شرکت باید وجود داشته باشد.' });
  db.prepare('DELETE FROM companies WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

const brandingDir = path.join(config.dataDir, 'branding');
fs.mkdirSync(brandingDir, { recursive: true });
const logoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/:id/logo', validate(idParam, 'params'), (req, res, next) => logoUpload.single('logo')(req, res, (err) => (err ? res.status(400).json({ error: 'حجم لوگو حداکثر ۵ مگابایت.' }) : next())), asyncHandler(async (req, res) => {
  const c = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'شرکت یافت نشد.' });
  if (!req.file) return res.status(400).json({ error: 'فایل لوگو ارسال نشده است.' });
  let name;
  if (req.file.mimetype === 'image/svg+xml') {
    name = `company-${c.id}-${Date.now()}.svg`;
    fs.writeFileSync(path.join(brandingDir, name), req.file.buffer);
  } else {
    name = `company-${c.id}-${Date.now()}.png`;
    try {
      await sharp(req.file.buffer).resize({ width: 800, height: 400, fit: 'inside', withoutEnlargement: true }).png().toFile(path.join(brandingDir, name));
    } catch {
      return res.status(400).json({ error: 'فایل تصویر معتبر نیست.' });
    }
  }
  db.prepare('UPDATE companies SET logo = ? WHERE id = ?').run(`/branding/${name}`, c.id);
  res.json({ logo: `/branding/${name}` });
}));

router.delete('/:id/logo', validate(idParam, 'params'), (req, res) => {
  db.prepare('UPDATE companies SET logo = NULL WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
