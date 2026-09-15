import { Router } from 'express';
import { db, now } from '../db.js';
import { requireAuth } from '../lib/auth.js';

const router = Router();
router.use(requireAuth);

/** Read notifications stay visible for this long, then disappear. */
export const READ_TTL_MS = 5 * 60 * 1000;

router.get('/', (req, res) => {
  const limit = Math.min(100, Number(req.query.limit) || 30);
  const cutoff = new Date(Date.now() - READ_TTL_MS).toISOString();
  const items = db
    .prepare('SELECT * FROM notifications WHERE user_id = ? AND (is_read = 0 OR (read_at IS NOT NULL AND read_at > ?)) ORDER BY is_read ASC, id DESC LIMIT ?')
    .all(req.user.id, cutoff, limit);
  const unread = db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id).c;
  res.json({ items, unread });
});

router.post('/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1, read_at = ? WHERE user_id = ? AND is_read = 0').run(now(), req.user.id);
  res.json({ ok: true });
});

router.post('/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1, read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ?').run(now(), req.params.id, req.user.id);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

export default router;
