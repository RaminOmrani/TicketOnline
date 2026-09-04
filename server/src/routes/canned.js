import { Router } from 'express';
import { db, now } from '../db.js';
import { requireRole } from '../lib/auth.js';
import { validate, z, str, optStr, idParam } from '../lib/validate.js';

const router = Router();
router.use(requireRole('agent', 'admin'));

router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT c.*, d.name AS department_name FROM canned_responses c LEFT JOIN departments d ON d.id = c.department_id ORDER BY c.title')
    .all();
  res.json({ items: rows });
});

const schema = z.object({ title: str(1, 120), shortcut: optStr(30), body: str(1, 10000), department_id: z.number().int().nullable().optional() });

router.post('/', validate(schema), (req, res) => {
  const b = req.body;
  const info = db.prepare('INSERT INTO canned_responses (title, shortcut, body, department_id, created_by) VALUES (?, ?, ?, ?, ?)').run(b.title, b.shortcut, b.body, b.department_id || null, req.user.id);
  res.status(201).json({ item: db.prepare('SELECT * FROM canned_responses WHERE id = ?').get(info.lastInsertRowid) });
});

router.patch('/:id', validate(idParam, 'params'), validate(schema.partial()), (req, res) => {
  const row = db.prepare('SELECT * FROM canned_responses WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'پاسخ آماده یافت نشد.' });
  const b = { ...row, ...req.body };
  db.prepare('UPDATE canned_responses SET title = ?, shortcut = ?, body = ?, department_id = ?, updated_at = ? WHERE id = ?').run(b.title, b.shortcut, b.body, b.department_id || null, now(), row.id);
  res.json({ item: db.prepare('SELECT * FROM canned_responses WHERE id = ?').get(row.id) });
});

router.delete('/:id', validate(idParam, 'params'), (req, res) => {
  db.prepare('DELETE FROM canned_responses WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
