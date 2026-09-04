import { Router } from 'express';
import { db, now } from '../db.js';
import { requireRole, isStaff } from '../lib/auth.js';
import { validate, z, str, optStr, idParam } from '../lib/validate.js';

const router = Router();

function slugify(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || `article-${Date.now()}`;
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
  const rows = db
    .prepare(`SELECT a.id, a.title, a.slug, a.summary, a.category, a.department_id, a.is_published, a.views, a.updated_at, d.name AS department_name FROM kb_articles a LEFT JOIN departments d ON d.id = a.department_id WHERE ${where.join(' AND ')} ORDER BY a.category, a.updated_at DESC`)
    .all(...params);
  const categories = db.prepare(`SELECT category, COUNT(*) c FROM kb_articles WHERE ${staff ? '1=1' : 'is_published = 1'} AND category IS NOT NULL GROUP BY category ORDER BY c DESC`).all();
  res.json({ items: rows, categories });
});

router.get('/:slug', (req, res) => {
  const a = db.prepare('SELECT a.*, d.name AS department_name FROM kb_articles a LEFT JOIN departments d ON d.id = a.department_id WHERE a.slug = ? OR a.id = ?').get(req.params.slug, Number(req.params.slug) || 0);
  if (!a || (!a.is_published && !isStaff(req.user))) return res.status(404).json({ error: 'مقاله یافت نشد.' });
  db.prepare('UPDATE kb_articles SET views = views + 1 WHERE id = ?').run(a.id);
  const related = db.prepare('SELECT id, title, slug FROM kb_articles WHERE is_published = 1 AND id != ? AND (category = ? OR department_id = ?) ORDER BY views DESC LIMIT 5').all(a.id, a.category, a.department_id);
  res.json({ article: a, related });
});

const schema = z.object({
  title: str(3, 200),
  slug: optStr(120),
  summary: optStr(500),
  body: str(1, 100000),
  category: optStr(80),
  department_id: z.number().int().nullable().optional(),
  is_published: z.boolean().optional(),
});

router.post('/', requireRole('agent', 'admin'), validate(schema), (req, res) => {
  const b = req.body;
  let slug = b.slug || slugify(b.title);
  if (db.prepare('SELECT id FROM kb_articles WHERE slug = ?').get(slug)) slug = `${slug}-${Date.now().toString(36)}`;
  const info = db.prepare('INSERT INTO kb_articles (title, slug, summary, body, category, department_id, is_published, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(b.title, slug, b.summary, b.body, b.category, b.department_id || null, b.is_published === false ? 0 : 1, req.user.id);
  res.status(201).json({ article: db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(info.lastInsertRowid) });
});

router.patch('/:id', requireRole('agent', 'admin'), validate(idParam, 'params'), validate(schema.partial()), (req, res) => {
  const a = db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'مقاله یافت نشد.' });
  const b = { ...a, ...req.body, is_published: req.body.is_published === undefined ? a.is_published : req.body.is_published ? 1 : 0 };
  if (req.body.slug) {
    const exists = db.prepare('SELECT id FROM kb_articles WHERE slug = ? AND id != ?').get(req.body.slug, a.id);
    if (exists) return res.status(409).json({ error: 'این نامک قبلاً استفاده شده است.' });
  }
  db.prepare('UPDATE kb_articles SET title = ?, slug = ?, summary = ?, body = ?, category = ?, department_id = ?, is_published = ?, updated_at = ? WHERE id = ?').run(b.title, b.slug, b.summary, b.body, b.category, b.department_id || null, b.is_published, now(), a.id);
  res.json({ article: db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(a.id) });
});

router.delete('/:id', requireRole('admin'), validate(idParam, 'params'), (req, res) => {
  db.prepare('DELETE FROM kb_articles WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
