import { Router } from 'express';
import { db, now } from '../db.js';
import { requireAuth, requireRole, isStaff, agentDepartmentIds, sanitizeUser } from '../lib/auth.js';
import { validate, z, str, optStr, idParam, asyncHandler } from '../lib/validate.js';
import { makeUploader, processUploads, cleanupTemp, uploadErrorHandler, deleteStored } from '../lib/upload.js';
import { getSetting } from '../lib/settings.js';
import {
  createTicket, addMessage, changeStatus, assignTicket, getTicket, canAccessTicket, shapeTicket, shapeMessage, shapeEvent, addEvent, touchTicket, broadcastTicket, computeDueAt, computeFirstResponseDue, markAgentViewed, STATUS_LABELS, PRIORITY_LABELS,
} from '../lib/tickets.js';
import { emitToStaff, emitToTicket, emitToUser } from '../lib/realtime.js';
import { notifyUser } from '../lib/notify.js';

const router = Router();
router.use(requireAuth);

const STATUSES = ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

function uploader(req, res, next) {
  const maxCount = Number(getSetting('max_attachments')) || 10;
  makeUploader().fields([
    { name: 'attachments', maxCount },
    { name: 'voice', maxCount: 1 },
  ])(req, res, (err) => {
    if (err) return uploadErrorHandler(err, req, res, next);
    next();
  });
}

function allFiles(req) {
  return [...(req.files?.attachments || []), ...(req.files?.voice || [])];
}

function parseMeta(req) {
  try {
    return req.body.meta ? JSON.parse(req.body.meta) : {};
  } catch {
    return {};
  }
}

function loadTicketOr404(req, res) {
  const t = getTicket(req.params.id);
  if (!t) {
    res.status(404).json({ error: 'تیکت یافت نشد.' });
    return null;
  }
  if (!canAccessTicket(req.user, t)) {
    res.status(403).json({ error: 'شما به این تیکت دسترسی ندارید.' });
    return null;
  }
  return t;
}

/* ---------- List ---------- */
router.get(
  '/',
  validate(
    z.object({
      status: z.string().optional(),
      priority: z.string().optional(),
      department_id: z.coerce.number().int().optional(),
      company_id: z.coerce.number().int().optional(),
      assignee_id: z.string().optional(), // number | 'me' | 'none'
      customer_id: z.coerce.number().int().optional(),
      q: z.string().trim().max(200).optional(),
      view: z.enum(['all', 'mine', 'unassigned', 'open', 'unread', 'overdue', 'resolved', 'closed']).optional(),
      sort: z.enum(['updated', 'created', 'priority', 'due']).optional(),
      order: z.enum(['asc', 'desc']).optional(),
      page: z.coerce.number().int().min(1).default(1),
      per_page: z.coerce.number().int().min(5).max(100).default(20),
      tag: z.string().optional(),
    }),
    'query'
  ),
  (req, res) => {
    const u = req.user;
    const q = req.query;
    const where = [];
    const params = [];

    if (u.role === 'customer') {
      where.push('t.customer_id = ?');
      params.push(u.id);
    } else if (u.role === 'agent') {
      const deptIds = agentDepartmentIds(u);
      where.push(`(t.assignee_id = ? OR t.department_id IN (${deptIds.length ? deptIds.map(() => '?').join(',') : 'NULL'}))`);
      params.push(u.id, ...deptIds);
    }

    if (q.status) {
      const list = q.status.split(',').filter((s) => STATUSES.includes(s));
      if (list.length) {
        where.push(`t.status IN (${list.map(() => '?').join(',')})`);
        params.push(...list);
      }
    }
    if (q.priority) {
      const list = q.priority.split(',').filter((s) => PRIORITIES.includes(s));
      if (list.length) {
        where.push(`t.priority IN (${list.map(() => '?').join(',')})`);
        params.push(...list);
      }
    }
    if (q.department_id) {
      where.push('t.department_id = ?');
      params.push(q.department_id);
    }
    if (q.company_id) {
      where.push('t.company_id = ?');
      params.push(q.company_id);
    }
    if (q.customer_id && isStaff(u)) {
      where.push('t.customer_id = ?');
      params.push(q.customer_id);
    }
    if (q.assignee_id) {
      if (q.assignee_id === 'me') {
        where.push('t.assignee_id = ?');
        params.push(u.id);
      } else if (q.assignee_id === 'none') where.push('t.assignee_id IS NULL');
      else if (/^\d+$/.test(q.assignee_id)) {
        where.push('t.assignee_id = ?');
        params.push(Number(q.assignee_id));
      }
    }
    if (q.tag) {
      where.push("t.tags LIKE ?");
      params.push(`%"${q.tag.replace(/[%_"]/g, '')}"%`);
    }
    switch (q.view) {
      case 'mine':
        where.push('t.assignee_id = ?');
        params.push(u.id);
        break;
      case 'unassigned':
        where.push("t.assignee_id IS NULL AND t.status NOT IN ('resolved','closed')");
        break;
      case 'open':
        where.push("t.status IN ('open','in_progress','waiting_customer')");
        break;
      case 'unread':
        where.push(u.role === 'customer' ? 't.customer_unread > 0' : 't.agent_unread > 0');
        break;
      case 'overdue':
        where.push("((t.due_at IS NOT NULL AND t.due_at < ?) OR (t.first_response_at IS NULL AND t.first_response_due_at IS NOT NULL AND t.first_response_due_at < ?)) AND t.status NOT IN ('resolved','closed')");
        params.push(now(), now());
        break;
      case 'resolved':
        where.push("t.status = 'resolved'");
        break;
      case 'closed':
        where.push("t.status = 'closed'");
        break;
    }
    if (q.q) {
      const term = `%${q.q}%`;
      where.push(`(t.number LIKE ? OR t.subject LIKE ? OR c.name LIKE ? OR c.company LIKE ? OR c.email LIKE ? OR c.mobile LIKE ? OR EXISTS (SELECT 1 FROM messages m WHERE m.ticket_id = t.id AND m.type != 'note' AND m.body LIKE ?))`);
      params.push(term, term, term, term, term, term, term);
    }

    const sortMap = {
      updated: 't.updated_at',
      created: 't.created_at',
      priority: "CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END",
      due: 't.due_at',
    };
    const sortCol = sortMap[q.sort || 'updated'];
    const order = (q.order || (q.sort === 'priority' || q.sort === 'due' ? 'asc' : 'desc')).toUpperCase();
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const base = `FROM tickets t JOIN users c ON c.id = t.customer_id ${whereSql}`;
    const total = db.prepare(`SELECT COUNT(*) c ${base}`).get(...params).c;
    const rows = db.prepare(`SELECT t.* ${base} ORDER BY ${sortCol} ${order}, t.id DESC LIMIT ? OFFSET ?`).all(...params, q.per_page, (q.page - 1) * q.per_page);
    res.json({
      items: rows.map((t) => shapeTicket(t, u, { withCounts: true })),
      total,
      page: q.page,
      per_page: q.per_page,
      pages: Math.max(1, Math.ceil(total / q.per_page)),
    });
  }
);

/* ---------- Summary counts (for sidebars/dashboards) ---------- */
router.get('/summary', (req, res) => {
  const u = req.user;
  let scope = '';
  const params = [];
  if (u.role === 'customer') {
    scope = 'WHERE customer_id = ?';
    params.push(u.id);
  } else if (u.role === 'agent') {
    const ids = agentDepartmentIds(u);
    scope = `WHERE (assignee_id = ? OR department_id IN (${ids.length ? ids.map(() => '?').join(',') : 'NULL'}))`;
    params.push(u.id, ...ids);
  }
  const t = now();
  const row = db
    .prepare(
      `SELECT
        COUNT(*) total,
        COALESCE(SUM(status = 'open'),0) open,
        COALESCE(SUM(status = 'in_progress'),0) in_progress,
        COALESCE(SUM(status = 'waiting_customer'),0) waiting_customer,
        COALESCE(SUM(status = 'resolved'),0) resolved,
        COALESCE(SUM(status = 'closed'),0) closed,
        COALESCE(SUM(assignee_id IS NULL AND status NOT IN ('resolved','closed')),0) unassigned,
        COALESCE(SUM(assignee_id = ? AND status NOT IN ('resolved','closed')),0) mine,
        COALESCE(SUM(${u.role === 'customer' ? 'customer_unread' : 'agent_unread'} > 0),0) unread,
        COALESCE(SUM(((due_at IS NOT NULL AND due_at < ?) OR (first_response_at IS NULL AND first_response_due_at IS NOT NULL AND first_response_due_at < ?)) AND status NOT IN ('resolved','closed')),0) overdue
       FROM tickets ${scope}`
    )
    .get(u.id, t, t, ...params);
  res.json(row);
});

/* ---------- Create ---------- */
router.post(
  '/',
  uploader,
  asyncHandler(async (req, res) => {
    const files = allFiles(req);
    const schema = z.object({
      subject: str(3, 200),
      department_id: z.coerce.number().int().positive({ message: 'بخش را انتخاب کنید.' }),
      priority: z.enum(PRIORITIES).default('normal'),
      product: optStr(150),
      body: z.string().trim().max(20000).default(''),
      customer_id: z.coerce.number().int().optional(),
      tags: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      cleanupTemp(files);
      const issue = parsed.error.issues[0];
      return res.status(400).json({ error: issue.message, field: issue.path.join('.') });
    }
    const b = parsed.data;
    if (!b.body && files.length === 0) {
      cleanupTemp(files);
      return res.status(400).json({ error: 'شرح مشکل یا حداقل یک پیوست الزامی است.', field: 'body' });
    }
    let customer = req.user;
    if (b.customer_id && isStaff(req.user)) {
      customer = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'customer'").get(b.customer_id);
      if (!customer) {
        cleanupTemp(files);
        return res.status(400).json({ error: 'مشتری یافت نشد.' });
      }
    }
    const dept = db.prepare('SELECT * FROM departments WHERE id = ? AND is_active = 1').get(b.department_id);
    if (!dept) {
      cleanupTemp(files);
      return res.status(400).json({ error: 'بخش انتخاب‌شده معتبر نیست.', field: 'department_id' });
    }
    let tags = [];
    if (b.tags && isStaff(req.user)) {
      try {
        tags = JSON.parse(b.tags);
      } catch {
        tags = b.tags.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }
    const attachments = await processUploads(files, parseMeta(req));
    const ticket = createTicket({ customer, actor: req.user, subject: b.subject, departmentId: dept.id, priority: b.priority, product: b.product, body: b.body, attachments, tags });
    res.status(201).json({ ticket: shapeTicket(ticket, req.user, { withCounts: true }) });
  })
);

/* ---------- Detail ---------- */
router.get('/:id', validate(idParam, 'params'), (req, res) => {
  let t = loadTicketOr404(req, res);
  if (!t) return;
  if (isStaff(req.user) && !t.agent_first_viewed_at) t = markAgentViewed(t, req.user);
  const msgs = db.prepare('SELECT * FROM messages WHERE ticket_id = ? ORDER BY id ASC').all(t.id).map((m) => shapeMessage(m, req.user)).filter(Boolean);
  const events = db.prepare('SELECT * FROM ticket_events WHERE ticket_id = ? ORDER BY id ASC').all(t.id).map((e) => shapeEvent(e, req.user)).filter(Boolean);
  const shaped = shapeTicket(t, req.user, { withCounts: true });
  const extra = {};
  if (isStaff(req.user)) {
    const c = db.prepare('SELECT * FROM users WHERE id = ?').get(t.customer_id);
    extra.customer_stats = {
      total: db.prepare('SELECT COUNT(*) c FROM tickets WHERE customer_id = ?').get(c.id).c,
      open: db.prepare("SELECT COUNT(*) c FROM tickets WHERE customer_id = ? AND status NOT IN ('resolved','closed')").get(c.id).c,
      avg_rating: db.prepare('SELECT ROUND(AVG(rating),1) r FROM tickets WHERE customer_id = ? AND rating IS NOT NULL').get(c.id).r,
      recent: db.prepare('SELECT id, number, subject, status, created_at FROM tickets WHERE customer_id = ? AND id != ? ORDER BY id DESC LIMIT 5').all(c.id, t.id),
    };
  }
  res.json({ ticket: shaped, messages: msgs, events, ...extra });
});

/* ---------- Mark read ---------- */
router.post('/:id/read', validate(idParam, 'params'), (req, res) => {
  const t = loadTicketOr404(req, res);
  if (!t) return;
  const ts = now();
  if (req.user.role === 'customer') {
    db.prepare("UPDATE messages SET read_by_customer_at = ? WHERE ticket_id = ? AND read_by_customer_at IS NULL AND type != 'note'").run(ts, t.id);
    db.prepare('UPDATE tickets SET customer_unread = 0 WHERE id = ?').run(t.id);
    emitToStaff('ticket:read', { ticket_id: t.id, by: 'customer', at: ts });
  } else {
    db.prepare('UPDATE messages SET read_by_agent_at = ? WHERE ticket_id = ? AND read_by_agent_at IS NULL').run(ts, t.id);
    db.prepare('UPDATE tickets SET agent_unread = 0 WHERE id = ?').run(t.id);
    emitToUser(t.customer_id, 'ticket:read', { ticket_id: t.id, by: 'agent', at: ts });
  }
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND ticket_id = ?').run(req.user.id, t.id);
  res.json({ ok: true });
});

/* ---------- Reply ---------- */
router.post(
  '/:id/messages',
  validate(idParam, 'params'),
  uploader,
  asyncHandler(async (req, res) => {
    const files = allFiles(req);
    const t = loadTicketOr404(req, res);
    if (!t) return cleanupTemp(files);
    const body = String(req.body.body || '').trim();
    const type = req.body.type === 'note' && isStaff(req.user) ? 'note' : 'message';
    if (!body && files.length === 0) {
      cleanupTemp(files);
      return res.status(400).json({ error: 'متن پیام یا پیوست الزامی است.' });
    }
    if (body.length > 20000) {
      cleanupTemp(files);
      return res.status(400).json({ error: 'متن پیام بیش از حد طولانی است.' });
    }
    if (req.user.role === 'customer' && t.status === 'closed') {
      const windowDays = Number(getSetting('reopen_window_days')) || 30;
      const closedAt = t.closed_at ? Date.parse(t.closed_at) : 0;
      if (Date.now() - closedAt > windowDays * 86400000) {
        cleanupTemp(files);
        return res.status(400).json({ error: `این تیکت بیش از ${windowDays} روز پیش بسته شده و امکان ارسال پیام ندارد. لطفاً تیکت جدیدی ثبت کنید.` });
      }
    }
    const attachments = await processUploads(files, parseMeta(req));
    const msg = addMessage({ ticket: t, sender: req.user, body, type, attachments });
    res.status(201).json({ message: shapeMessage(msg, req.user), ticket: shapeTicket(getTicket(t.id), req.user, { withCounts: true }) });
  })
);

/* ---------- Edit / delete own message (within 15 min for customers; staff any time on own) ---------- */
router.patch('/:id/messages/:mid', validate(idParam, 'params'), validate(z.object({ body: str(1, 20000) })), (req, res) => {
  const t = loadTicketOr404(req, res);
  if (!t) return;
  const m = db.prepare('SELECT * FROM messages WHERE id = ? AND ticket_id = ?').get(req.params.mid, t.id);
  if (!m || m.deleted_at) return res.status(404).json({ error: 'پیام یافت نشد.' });
  if (m.sender_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'فقط فرستنده می‌تواند پیام را ویرایش کند.' });
  if (req.user.role === 'customer' && Date.now() - Date.parse(m.created_at) > 15 * 60_000) return res.status(400).json({ error: 'مهلت ویرایش پیام (۱۵ دقیقه) گذشته است.' });
  db.prepare('UPDATE messages SET body = ?, edited_at = ? WHERE id = ?').run(req.body.body, now(), m.id);
  const updated = db.prepare('SELECT * FROM messages WHERE id = ?').get(m.id);
  emitToTicket(t.id, 'message:updated', shapeMessage(updated, { role: 'admin' }));
  res.json({ message: shapeMessage(updated, req.user) });
});

router.delete('/:id/messages/:mid', validate(idParam, 'params'), (req, res) => {
  const t = loadTicketOr404(req, res);
  if (!t) return;
  const m = db.prepare('SELECT * FROM messages WHERE id = ? AND ticket_id = ?').get(req.params.mid, t.id);
  if (!m || m.deleted_at) return res.status(404).json({ error: 'پیام یافت نشد.' });
  if (m.sender_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'فقط فرستنده می‌تواند پیام را حذف کند.' });
  const first = db.prepare('SELECT id FROM messages WHERE ticket_id = ? ORDER BY id ASC LIMIT 1').get(t.id);
  if (first?.id === m.id) return res.status(400).json({ error: 'پیام اول تیکت قابل حذف نیست.' });
  db.prepare('UPDATE messages SET deleted_at = ? WHERE id = ?').run(now(), m.id);
  db.prepare('SELECT * FROM attachments WHERE message_id = ?').all(m.id).forEach(deleteStored);
  db.prepare('DELETE FROM attachments WHERE message_id = ?').run(m.id);
  const updated = db.prepare('SELECT * FROM messages WHERE id = ?').get(m.id);
  emitToTicket(t.id, 'message:updated', shapeMessage(updated, { role: 'admin' }));
  res.json({ ok: true });
});

/* ---------- Update ticket props ---------- */
router.patch(
  '/:id',
  validate(idParam, 'params'),
  validate(
    z.object({
      status: z.enum(STATUSES).optional(),
      priority: z.enum(PRIORITIES).optional(),
      assignee_id: z.number().int().nullable().optional(),
      department_id: z.number().int().optional(),
      subject: str(3, 200).optional(),
      product: optStr(150).optional(),
      tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
      due_at: z.string().datetime().nullable().optional(),
      resolution_note: z.string().max(2000).optional(),
    })
  ),
  (req, res) => {
    const t = loadTicketOr404(req, res);
    if (!t) return;
    const u = req.user;
    const b = req.body;

    if (u.role === 'customer') {
      // Customers may only close (or reopen recently closed) their own tickets
      const allowed = ['status'];
      for (const k of Object.keys(b)) if (!allowed.includes(k)) return res.status(403).json({ error: 'شما مجوز تغییر این مورد را ندارید.' });
      if (b.status && !['closed', 'open'].includes(b.status)) return res.status(403).json({ error: 'شما فقط می‌توانید تیکت را ببندید یا بازگشایی کنید.' });
      if (b.status === 'open' && ['closed', 'resolved'].includes(t.status)) {
        const windowDays = Number(getSetting('reopen_window_days')) || 30;
        const ref = t.closed_at || t.resolved_at;
        if (ref && Date.now() - Date.parse(ref) > windowDays * 86400000) return res.status(400).json({ error: 'مهلت بازگشایی تیکت گذشته است. لطفاً تیکت جدیدی ثبت کنید.' });
        changeStatus(t, u, 'open', { reopened: true });
      } else if (b.status === 'closed') {
        changeStatus(t, u, 'closed', { by_customer: true });
      }
      return res.json({ ticket: shapeTicket(getTicket(t.id), u, { withCounts: true }) });
    }

    let current = t;
    if (b.department_id && b.department_id !== current.department_id) {
      const dept = db.prepare('SELECT * FROM departments WHERE id = ? AND is_active = 1').get(b.department_id);
      if (!dept) return res.status(400).json({ error: 'بخش معتبر نیست.' });
      const old = db.prepare('SELECT name FROM departments WHERE id = ?').get(current.department_id);
      touchTicket(current.id, { department_id: dept.id, company_id: dept.company_id || current.company_id, assignee_id: null, due_at: computeDueAt(dept, b.priority || current.priority, new Date(current.created_at)), first_response_due_at: current.first_response_at ? current.first_response_due_at : computeFirstResponseDue(dept, b.priority || current.priority, new Date(current.created_at)) });
      addEvent(current.id, u.id, 'department_changed', { from: old?.name, to: dept.name });
      current = getTicket(current.id);
      // notify agents of new department
      db.prepare("SELECT u.* FROM users u JOIN agent_departments ad ON ad.user_id = u.id WHERE ad.department_id = ? AND u.is_active = 1 AND u.id != ?").all(dept.id, u.id).forEach((agent) =>
        notifyUser(agent, { type: 'ticket_transferred', title: `تیکت ${current.number} به بخش ${dept.name} ارجاع شد`, body: current.subject, ticket: current })
      );
    }
    if (b.priority && b.priority !== current.priority) {
      const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(current.department_id);
      touchTicket(current.id, { priority: b.priority, due_at: computeDueAt(dept, b.priority, new Date(current.created_at)), first_response_due_at: current.first_response_at ? current.first_response_due_at : computeFirstResponseDue(dept, b.priority, new Date(current.created_at)) });
      addEvent(current.id, u.id, 'priority_changed', { from: current.priority, to: b.priority, from_label: PRIORITY_LABELS[current.priority], to_label: PRIORITY_LABELS[b.priority] });
      current = getTicket(current.id);
    }
    if (b.subject && b.subject !== current.subject) {
      touchTicket(current.id, { subject: b.subject });
      addEvent(current.id, u.id, 'subject_changed', { from: current.subject, to: b.subject });
      current = getTicket(current.id);
    }
    if (b.product !== undefined && b.product !== current.product) {
      touchTicket(current.id, { product: b.product });
      current = getTicket(current.id);
    }
    if (b.tags) {
      const tags = [...new Set(b.tags)];
      touchTicket(current.id, { tags: JSON.stringify(tags) });
      addEvent(current.id, u.id, 'tags_changed', { tags });
      current = getTicket(current.id);
    }
    if (b.due_at !== undefined) {
      touchTicket(current.id, { due_at: b.due_at });
      addEvent(current.id, u.id, 'due_changed', { due_at: b.due_at });
      current = getTicket(current.id);
    }
    if (b.assignee_id !== undefined && b.assignee_id !== current.assignee_id) {
      current = assignTicket(current, u, b.assignee_id);
    }
    if (b.status && b.status !== current.status) {
      if (b.resolution_note && ['resolved', 'closed'].includes(b.status)) {
        addMessage({ ticket: current, sender: u, body: b.resolution_note, type: 'message' });
        current = getTicket(current.id);
      }
      current = changeStatus(current, u, b.status);
    }
    broadcastTicket(current.id);
    res.json({ ticket: shapeTicket(getTicket(current.id), u, { withCounts: true }) });
  }
);

/* ---------- Rate ---------- */
router.post('/:id/rate', validate(idParam, 'params'), validate(z.object({ rating: z.number().int().min(1).max(5), comment: optStr(1000) })), (req, res) => {
  const t = loadTicketOr404(req, res);
  if (!t) return;
  if (req.user.role !== 'customer' || t.customer_id !== req.user.id) return res.status(403).json({ error: 'فقط مشتری می‌تواند امتیاز دهد.' });
  if (!['resolved', 'closed'].includes(t.status)) return res.status(400).json({ error: 'امتیازدهی فقط برای تیکت‌های حل‌شده امکان‌پذیر است.' });
  touchTicket(t.id, { rating: req.body.rating, rating_comment: req.body.comment, rated_at: now() });
  addEvent(t.id, req.user.id, 'rated', { rating: req.body.rating, comment: req.body.comment });
  const updated = getTicket(t.id);
  broadcastTicket(t.id);
  if (updated.assignee_id) {
    const a = db.prepare('SELECT * FROM users WHERE id = ?').get(updated.assignee_id);
    notifyUser(a, { type: 'ticket_rated', title: `امتیاز ${req.body.rating} از ۵ برای تیکت ${updated.number}`, body: req.body.comment || updated.subject, ticket: updated });
  }
  res.json({ ticket: shapeTicket(updated, req.user, { withCounts: true }) });
});

/* ---------- Typing indicator ---------- */
router.post('/:id/typing', validate(idParam, 'params'), (req, res) => {
  const t = loadTicketOr404(req, res);
  if (!t) return;
  emitToTicket(t.id, 'typing', { ticket_id: t.id, user: sanitizeUser(req.user), at: Date.now() });
  res.json({ ok: true });
});

/* ---------- Agents available for assignment ---------- */
router.get('/:id/agents', validate(idParam, 'params'), requireRole('agent', 'admin'), (req, res) => {
  const t = loadTicketOr404(req, res);
  if (!t) return;
  const rows = db
    .prepare(
      `SELECT u.*, (SELECT COUNT(*) FROM tickets x WHERE x.assignee_id = u.id AND x.status NOT IN ('resolved','closed')) AS load,
        EXISTS(SELECT 1 FROM agent_departments ad WHERE ad.user_id = u.id AND ad.department_id = ?) AS in_department
       FROM users u WHERE u.role IN ('agent','admin') AND u.is_active = 1 ORDER BY in_department DESC, u.name`
    )
    .all(t.department_id);
  res.json({ agents: rows.map((r) => ({ ...sanitizeUser(r), load: r.load, in_department: !!r.in_department })) });
});

/* ---------- Delete ticket (admin) ---------- */
router.delete('/:id', validate(idParam, 'params'), requireRole('admin'), (req, res) => {
  const t = getTicket(req.params.id);
  if (!t) return res.status(404).json({ error: 'تیکت یافت نشد.' });
  db.prepare('SELECT * FROM attachments WHERE ticket_id = ?').all(t.id).forEach(deleteStored);
  db.prepare('DELETE FROM tickets WHERE id = ?').run(t.id);
  db.prepare('INSERT INTO audit_log (actor_id, action, target, ip) VALUES (?, ?, ?, ?)').run(req.user.id, 'ticket_delete', `ticket:${t.number}`, req.ip);
  emitToStaff('ticket:deleted', { id: t.id });
  emitToUser(t.customer_id, 'ticket:deleted', { id: t.id });
  res.json({ ok: true });
});

export default router;
