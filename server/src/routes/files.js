import { Router } from 'express';
import fs from 'node:fs';
import { db } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { canAccessTicket, getTicket } from '../lib/tickets.js';
import { absPath } from '../lib/upload.js';

const router = Router();
router.use(requireAuth);

function load(req, res) {
  const a = db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id);
  if (!a) {
    res.status(404).json({ error: 'فایل یافت نشد.' });
    return null;
  }
  const t = getTicket(a.ticket_id);
  if (!canAccessTicket(req.user, t)) {
    res.status(403).json({ error: 'دسترسی به این فایل مجاز نیست.' });
    return null;
  }
  if (req.user.role === 'customer') {
    const m = db.prepare('SELECT type FROM messages WHERE id = ?').get(a.message_id);
    if (m?.type === 'note') {
      res.status(403).json({ error: 'دسترسی به این فایل مجاز نیست.' });
      return null;
    }
  }
  return a;
}

function send(res, a, rel, { download = false, mime } = {}) {
  const p = absPath(rel);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'فایل روی سرور موجود نیست.' });
  const inlineOk = ['image', 'video', 'audio', 'voice'].includes(a.kind) || (a.mime === 'application/pdf');
  const encodedName = encodeURIComponent(a.original_name).replace(/'/g, '%27');
  res.setHeader('Content-Type', mime || a.mime || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.setHeader('Content-Disposition', `${download || !inlineOk ? 'attachment' : 'inline'}; filename*=UTF-8''${encodedName}`);
  if (a.mime === 'image/svg+xml' || a.mime?.startsWith('text/html')) {
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
  }
  res.sendFile(p, { acceptRanges: true, headers: {} });
}

router.get('/:id', (req, res) => {
  const a = load(req, res);
  if (!a) return;
  send(res, a, a.stored_path, { download: req.query.download === '1' });
});

router.get('/:id/thumb', (req, res) => {
  const a = load(req, res);
  if (!a) return;
  if (!a.thumb_path) return send(res, a, a.stored_path);
  send(res, a, a.thumb_path, { mime: 'image/webp' });
});

export default router;
