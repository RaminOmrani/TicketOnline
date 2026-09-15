import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import multer from 'multer';
import sharp from 'sharp';
import sanitizeHtml from 'sanitize-html';
import { db, now } from '../db.js';
import { config } from '../config.js';
import { requireRole, isStaff } from '../lib/auth.js';
import { validate, z, str, optStr, idParam, asyncHandler } from '../lib/validate.js';

const router = Router();

function slugify(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || `article-${Date.now()}`;
}

/* ---------- Rich-text (HTML) sanitizing ---------- */
const SANITIZE = {
  allowedTags: ['h2', 'h3', 'h4', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'code', 'pre', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div', 'figure', 'figcaption', 'sub', 'sup'],
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    '*': ['style', 'dir', 'align'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan'],
  },
  allowedStyles: {
    '*': {
      'text-align': [/^(left|right|center|justify)$/],
      color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\((\s*\d{1,3}\s*,){2}\s*\d{1,3}\s*\)$/],
      'background-color': [/^#[0-9a-fA-F]{3,8}$/, /^rgb\((\s*\d{1,3}\s*,){2}\s*\d{1,3}\s*\)$/],
      'font-size': [/^\d+(\.\d+)?(px|em|rem|%)$/],
      'max-width': [/^\d+(\.\d+)?(px|%)$/],
      width: [/^\d+(\.\d+)?(px|%)$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, rel: 'noopener noreferrer', target: attribs.href && /^https?:/.test(attribs.href) ? '_blank' : undefined } }),
  },
};
export function cleanHtml(html) {
  return sanitizeHtml(String(html || ''), SANITIZE);
}

function shapeListRow(a) {
  return { ...a, is_faq: !!a.is_faq };
}

router.get('/', (req, res) => {
  const staff = isStaff(req.user);
  const q = String(req.query.q || '').trim();
  const where = [staff ? '1=1' : 'a.is_published = 1'];
  const params = [];
  if (q) {
    where.push('(a.title LIKE ? OR a.summary LIKE ? OR a.body LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (req.query.category) {
    where.push('a.category = ?');
    params.push(req.query.category);
  }
  if (req.query.faq === '1') where.push('a.is_faq = 1');
  if (req.query.department_id) {
    where.push('(a.department_id = ? OR a.department_id IS NULL)');
    params.push(Number(req.query.department_id) || 0);
  }
  const order = req.query.sort === 'views' ? 'a.views DESC, a.updated_at DESC' : 'a.is_faq DESC, a.category, a.updated_at DESC';
  const limit = Math.min(200, Number(req.query.limit) || 200);
  const rows = db
    .prepare(`SELECT a.id, a.title, a.slug, a.summary, a.category, a.department_id, a.is_published, a.is_faq, a.cover_image, a.views, a.updated_at, d.name AS department_name FROM kb_articles a LEFT JOIN departments d ON d.id = a.department_id WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ?`)
    .all(...params, limit);
  const categories = db.prepare(`SELECT category, COUNT(*) c FROM kb_articles WHERE ${staff ? '1=1' : 'is_published = 1'} AND category IS NOT NULL AND category != '' GROUP BY category ORDER BY c DESC`).all();
  res.json({ items: rows.map(shapeListRow), categories });
});

router.get('/:slug', (req, res) => {
  const a = db.prepare('SELECT a.*, d.name AS department_name FROM kb_articles a LEFT JOIN departments d ON d.id = a.department_id WHERE a.slug = ? OR a.id = ?').get(req.params.slug, Number(req.params.slug) || 0);
  if (!a || (!a.is_published && !isStaff(req.user))) return res.status(404).json({ error: 'مقاله یافت نشد.' });
  if (req.query.count !== '0') db.prepare('UPDATE kb_articles SET views = views + 1 WHERE id = ?').run(a.id);
  const related = db.prepare('SELECT id, title, slug, cover_image FROM kb_articles WHERE is_published = 1 AND id != ? AND (category = ? OR department_id = ?) ORDER BY views DESC LIMIT 5').all(a.id, a.category, a.department_id);
  res.json({ article: shapeListRow(a), related });
});

const schema = z.object({
  title: str(3, 200),
  slug: optStr(120),
  summary: optStr(500),
  body: str(1, 300000),
  body_format: z.enum(['markdown', 'html']).optional(),
  category: optStr(80),
  department_id: z.number().int().nullable().optional(),
  is_published: z.boolean().optional(),
  is_faq: z.boolean().optional(),
  cover_image: z.string().max(300).nullable().optional(),
});

function prepBody(b, fallbackFormat = 'markdown') {
  const format = b.body_format || fallbackFormat;
  const body = format === 'html' ? cleanHtml(b.body) : b.body;
  return { format, body };
}

router.post('/', requireRole('agent', 'admin'), validate(schema), (req, res) => {
  const b = req.body;
  let slug = b.slug || slugify(b.title);
  if (db.prepare('SELECT id FROM kb_articles WHERE slug = ?').get(slug)) slug = `${slug}-${Date.now().toString(36)}`;
  const { format, body } = prepBody(b, 'html');
  const info = db
    .prepare('INSERT INTO kb_articles (title, slug, summary, body, body_format, category, department_id, is_published, is_faq, cover_image, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(b.title, slug, b.summary, body, format, b.category, b.department_id || null, b.is_published === false ? 0 : 1, b.is_faq ? 1 : 0, b.cover_image || null, req.user.id);
  res.status(201).json({ article: shapeListRow(db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(info.lastInsertRowid)) });
});

router.patch('/:id', requireRole('agent', 'admin'), validate(idParam, 'params'), validate(schema.partial()), (req, res) => {
  const a = db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'مقاله یافت نشد.' });
  const b = { ...a, ...req.body, is_published: req.body.is_published === undefined ? a.is_published : req.body.is_published ? 1 : 0, is_faq: req.body.is_faq === undefined ? a.is_faq : req.body.is_faq ? 1 : 0 };
  if (req.body.slug) {
    const exists = db.prepare('SELECT id FROM kb_articles WHERE slug = ? AND id != ?').get(req.body.slug, a.id);
    if (exists) return res.status(409).json({ error: 'این نامک قبلاً استفاده شده است.' });
  }
  const { format, body } = req.body.body !== undefined || req.body.body_format ? prepBody({ body: b.body, body_format: b.body_format }, a.body_format) : { format: a.body_format, body: a.body };
  db.prepare('UPDATE kb_articles SET title = ?, slug = ?, summary = ?, body = ?, body_format = ?, category = ?, department_id = ?, is_published = ?, is_faq = ?, cover_image = ?, updated_at = ? WHERE id = ?').run(
    b.title, b.slug, b.summary, body, format, b.category, b.department_id || null, b.is_published, b.is_faq, req.body.cover_image === undefined ? a.cover_image : req.body.cover_image || null, now(), a.id
  );
  res.json({ article: shapeListRow(db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(a.id)) });
});

router.delete('/:id', requireRole('admin'), validate(idParam, 'params'), (req, res) => {
  db.prepare('DELETE FROM kb_articles WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

/* ---------- Images for articles (cover + inline) ---------- */
const kbDir = path.join(config.dataDir, 'branding', 'kb');
fs.mkdirSync(kbDir, { recursive: true });
const imgUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post(
  '/upload',
  requireRole('agent', 'admin'),
  (req, res, next) => imgUpload.single('image')(req, res, (err) => (err ? res.status(400).json({ error: 'حجم تصویر حداکثر ۱۰ مگابایت.' }) : next())),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'تصویری ارسال نشده است.' });
    if (!/^image\//.test(req.file.mimetype) || req.file.mimetype === 'image/svg+xml') return res.status(400).json({ error: 'فقط تصویر (PNG، JPG، WebP یا GIF) مجاز است.' });
    const id = crypto.randomUUID();
    let name;
    if (req.file.mimetype === 'image/gif') {
      name = `${id}.gif`;
      fs.writeFileSync(path.join(kbDir, name), req.file.buffer);
    } else {
      name = `${id}.webp`;
      try {
        await sharp(req.file.buffer, { failOn: 'none' }).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(kbDir, name));
      } catch {
        return res.status(400).json({ error: 'فایل تصویر معتبر نیست.' });
      }
    }
    res.status(201).json({ url: `/branding/kb/${name}` });
  })
);

export default router;
