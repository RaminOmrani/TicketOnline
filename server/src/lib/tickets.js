import { db, now } from '../db.js';
import { getSetting, nextTicketNumber } from './settings.js';
import { agentDepartmentIds, isStaff, sanitizeUser } from './auth.js';
import { emitToTicket, emitToUser, emitToStaff, emitToDepartment } from './realtime.js';
import { notifyUser } from './notify.js';
import { config } from '../config.js';
import { addBusinessMinutes } from './businessHours.js';

export const STATUS_LABELS = {
  open: 'باز',
  in_progress: 'در حال بررسی',
  waiting_customer: 'در انتظار پاسخ شما',
  resolved: 'حل شده',
  closed: 'بسته شده',
};
export const PRIORITY_LABELS = { low: 'کم', normal: 'عادی', high: 'زیاد', urgent: 'فوری' };

export function scheduleFor(department) {
  if (department?.business_hours) {
    try { return JSON.parse(department.business_hours); } catch {}
  }
  const company = department?.company_id ? db.prepare('SELECT business_hours FROM companies WHERE id = ?').get(department.company_id) : null;
  if (company?.business_hours) {
    try { return JSON.parse(company.business_hours); } catch {}
  }
  return null;
}

export function computeDueAt(department, priority, from = new Date()) {
  const mult = (getSetting('sla_priority_multiplier') || {})[priority] ?? 1;
  const minutes = Math.max(15, Math.round((department?.sla_resolve_minutes || 2880) * mult));
  return addBusinessMinutes(from, minutes, scheduleFor(department)).toISOString();
}

export function computeFirstResponseDue(department, priority, from = new Date()) {
  const mult = (getSetting('sla_priority_multiplier') || {})[priority] ?? 1;
  const minutes = Math.max(5, Math.round((department?.sla_first_response_minutes || 240) * mult));
  return addBusinessMinutes(from, minutes, scheduleFor(department)).toISOString();
}

export function pickAssignee(departmentId) {
  // Agents in this department with the fewest active tickets (load-balanced round robin)
  const rows = db
    .prepare(
      `SELECT u.id, u.name,
        (SELECT COUNT(*) FROM tickets t WHERE t.assignee_id = u.id AND t.status IN ('open','in_progress','waiting_customer')) AS load,
        (SELECT MAX(created_at) FROM tickets t WHERE t.assignee_id = u.id) AS last_assigned
       FROM users u
       JOIN agent_departments ad ON ad.user_id = u.id
       WHERE ad.department_id = ? AND u.is_active = 1 AND u.role IN ('agent','admin')
       ORDER BY CASE WHEN u.role = 'agent' THEN 0 ELSE 1 END ASC, load ASC, last_assigned ASC NULLS FIRST, u.id ASC
       LIMIT 1`
    )
    .all(departmentId);
  return rows[0] || null;
}

export function addEvent(ticketId, actorId, type, data = {}) {
  const info = db.prepare('INSERT INTO ticket_events (ticket_id, actor_id, type, data) VALUES (?, ?, ?, ?)').run(ticketId, actorId, type, JSON.stringify(data));
  const ev = db.prepare('SELECT * FROM ticket_events WHERE id = ?').get(info.lastInsertRowid);
  const shaped = shapeEvent(ev);
  emitToTicket(ticketId, 'ticket:event', { ...shaped, id: ev.id });
  return shaped;
}

export const STAFF_ALIAS = { id: 0, name: 'کارشناس پشتیبانی', role: 'agent', avatar: null, title: 'پشتیبانی', company: null };

/** Events that customers may see (staff identities stripped). */
const CUSTOMER_EVENT_TYPES = new Set(['created', 'status_changed', 'reopened', 'department_changed', 'rated', 'agent_viewed', 'subject_changed']);

export function shapeEvent(ev, viewer) {
  const actor = ev.actor_id ? db.prepare('SELECT * FROM users WHERE id = ?').get(ev.actor_id) : null;
  const out = { id: ev.id, ticket_id: ev.ticket_id, type: ev.type, data: JSON.parse(ev.data || '{}'), actor: sanitizeUser(actor), created_at: ev.created_at };
  if (viewer?.role === 'customer') {
    if (!CUSTOMER_EVENT_TYPES.has(ev.type)) return null;
    if (out.actor && out.actor.role !== 'customer') out.actor = { ...STAFF_ALIAS };
  }
  return out;
}

export function canAccessTicket(user, ticket) {
  if (!user || !ticket) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'customer') return ticket.customer_id === user.id;
  if (user.role === 'agent') {
    if (ticket.assignee_id === user.id) return true;
    return agentDepartmentIds(user).includes(ticket.department_id);
  }
  return false;
}

export function getTicket(id) {
  return db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
}

export function shapeAttachment(a) {
  return {
    id: a.id,
    kind: a.kind,
    name: a.original_name,
    mime: a.mime,
    size: a.size,
    width: a.width,
    height: a.height,
    duration: a.duration,
    url: `/api/files/${a.id}`,
    thumb_url: a.thumb_path ? `/api/files/${a.id}/thumb` : null,
    created_at: a.created_at,
  };
}

export function shapeMessage(m, viewer) {
  const sender = m.sender_id ? db.prepare('SELECT * FROM users WHERE id = ?').get(m.sender_id) : null;
  const atts = db.prepare('SELECT * FROM attachments WHERE message_id = ? ORDER BY id').all(m.id).map(shapeAttachment);
  const out = {
    id: m.id,
    ticket_id: m.ticket_id,
    type: m.type,
    body: m.deleted_at ? '' : m.body,
    deleted: !!m.deleted_at,
    sender: sanitizeUser(sender),
    attachments: m.deleted_at ? [] : atts,
    created_at: m.created_at,
    edited_at: m.edited_at,
    read_by_customer_at: m.read_by_customer_at,
    read_by_agent_at: m.read_by_agent_at,
  };
  if (viewer && viewer.role === 'customer') {
    if (m.type === 'note') return null;
    if (out.sender && out.sender.role !== 'customer') out.sender = { ...STAFF_ALIAS };
  }
  return out;
}

export function shapeTicket(t, viewer, { withCounts = false } = {}) {
  const customer = db.prepare('SELECT * FROM users WHERE id = ?').get(t.customer_id);
  const assignee = t.assignee_id ? db.prepare('SELECT * FROM users WHERE id = ?').get(t.assignee_id) : null;
  const department = db.prepare('SELECT id, name, slug, icon, color, company_id, sla_first_response_minutes, sla_resolve_minutes FROM departments WHERE id = ?').get(t.department_id);
  const company = t.company_id ? db.prepare('SELECT id, name, slug, logo, color FROM companies WHERE id = ?').get(t.company_id) : null;
  const lastMsg = db.prepare("SELECT * FROM messages WHERE ticket_id = ? AND type != 'note' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1").get(t.id);
  const isCustomerView = viewer?.role === 'customer';
  const out = {
    id: t.id,
    number: t.number,
    subject: t.subject,
    status: t.status,
    status_label: STATUS_LABELS[t.status],
    priority: t.priority,
    priority_label: PRIORITY_LABELS[t.priority],
    product: t.product,
    tags: JSON.parse(t.tags || '[]'),
    department,
    company,
    customer: sanitizeUser(customer, { full: isStaff(viewer) }),
    assignee: isCustomerView ? null : sanitizeUser(assignee),
    agent_viewed: !!t.agent_first_viewed_at,
    unread: isCustomerView ? t.customer_unread : t.agent_unread,
    first_response_at: t.first_response_at,
    resolved_at: t.resolved_at,
    closed_at: t.closed_at,
    due_at: isCustomerView ? null : t.due_at,
    first_response_due_at: isCustomerView ? null : t.first_response_due_at,
    overdue: isCustomerView ? false : !['resolved', 'closed'].includes(t.status) && ((!!t.due_at && Date.parse(t.due_at) < Date.now()) || (!t.first_response_at && !!t.first_response_due_at && Date.parse(t.first_response_due_at) < Date.now())),
    last_message_at: t.last_message_at,
    last_customer_message_at: t.last_customer_message_at,
    last_agent_message_at: t.last_agent_message_at,
    last_message_preview: lastMsg ? (lastMsg.body || '').slice(0, 120) || (lastMsg.type === 'message' ? '📎 پیوست' : '') : '',
    rating: t.rating,
    rating_comment: t.rating_comment,
    rated_at: t.rated_at,
    created_at: t.created_at,
    updated_at: t.updated_at,
  };
  if (withCounts) {
    out.message_count = db.prepare("SELECT COUNT(*) c FROM messages WHERE ticket_id = ? AND type = 'message' AND deleted_at IS NULL").get(t.id).c;
    out.attachment_count = db.prepare('SELECT COUNT(*) c FROM attachments WHERE ticket_id = ?').get(t.id).c;
  }
  return out;
}

export function touchTicket(id, fields = {}) {
  const sets = ['updated_at = ?'];
  const vals = [now()];
  for (const [k, v] of Object.entries(fields)) {
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  vals.push(id);
  db.prepare(`UPDATE tickets SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

export function broadcastTicket(ticketId, event = 'ticket:updated') {
  const t = getTicket(ticketId);
  if (!t) return;
  const staffShape = shapeTicket(t, { role: 'admin' });
  const customerShape = shapeTicket(t, { role: 'customer' });
  emitToUser(t.customer_id, event, customerShape);
  emitToStaff(event, staffShape);
}

export function staffForTicket(ticket, { includeAssignee = true } = {}) {
  const ids = new Set();
  if (includeAssignee && ticket.assignee_id) ids.add(ticket.assignee_id);
  if (!ticket.assignee_id || getSetting('notify_new_ticket_all_dept_agents')) {
    db.prepare("SELECT ad.user_id FROM agent_departments ad JOIN users u ON u.id = ad.user_id WHERE ad.department_id = ? AND u.is_active = 1").all(ticket.department_id).forEach((r) => ids.add(r.user_id));
  }
  if (ids.size === 0) {
    db.prepare("SELECT id FROM users WHERE role = 'admin' AND is_active = 1").all().forEach((r) => ids.add(r.id));
  }
  return [...ids].map((id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id)).filter(Boolean);
}

export function createTicket({ customer, actor, subject, departmentId, priority = 'normal', product = null, body = '', attachments = [], source = 'web', tags = [] }) {
  const department = db.prepare('SELECT * FROM departments WHERE id = ?').get(departmentId);
  if (!department) throw Object.assign(new Error('بخش انتخاب‌شده معتبر نیست.'), { status: 400 });

  const ticket = db.transaction(() => {
    const number = nextTicketNumber(department.company_id);
    const createdAt = now();
    const due = computeDueAt(department, priority);
    const frDue = computeFirstResponseDue(department, priority);
    let assigneeId = null;
    if (department.auto_assign) {
      const a = pickAssignee(department.id);
      if (a) assigneeId = a.id;
    }
    const info = db
      .prepare(
        `INSERT INTO tickets (number, subject, department_id, company_id, customer_id, assignee_id, status, priority, product, tags, source, agent_unread, due_at, first_response_due_at, last_message_at, last_customer_message_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`
      )
      .run(number, subject, department.id, department.company_id || null, customer.id, assigneeId, priority, product, JSON.stringify(tags), source, due, frDue, createdAt, createdAt, createdAt, createdAt);
    const ticketId = info.lastInsertRowid;
    const msgInfo = db.prepare("INSERT INTO messages (ticket_id, sender_id, body, type, read_by_customer_at) VALUES (?, ?, ?, 'message', ?)").run(ticketId, customer.id, body, createdAt);
    for (const a of attachments) {
      db.prepare(
        'INSERT INTO attachments (message_id, ticket_id, uploader_id, kind, original_name, stored_path, thumb_path, mime, size, width, height, duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(msgInfo.lastInsertRowid, ticketId, actor.id, a.kind, a.original_name, a.stored_path, a.thumb_path, a.mime, a.size, a.width, a.height, a.duration);
    }
    db.prepare('INSERT INTO ticket_events (ticket_id, actor_id, type, data) VALUES (?, ?, ?, ?)').run(ticketId, actor.id, 'created', JSON.stringify({ department: department.name, priority, on_behalf: actor.id !== customer.id }));
    if (assigneeId) {
      db.prepare('INSERT INTO ticket_events (ticket_id, actor_id, type, data) VALUES (?, NULL, ?, ?)').run(ticketId, 'assigned', JSON.stringify({ assignee_id: assigneeId, auto: true }));
    }
    return getTicket(ticketId);
  })();

  // Notifications (async, outside transaction)
  const shaped = shapeTicket(ticket, { role: 'admin' });
  emitToStaff('ticket:created', shaped);
  emitToUser(customer.id, 'ticket:created', shapeTicket(ticket, customer));

  notifyUser(customer, {
    type: 'ticket_created',
    title: `تیکت ${ticket.number} ثبت شد`,
    body: subject,
    ticket,
    email: {
      subject: `[${ticket.number}] تیکت شما ثبت شد`,
      intro: `${customer.name} عزیز، تیکت شما با موضوع «${subject}» در بخش ${department.name} ثبت شد. کارشناسان ما در اسرع وقت پاسخ می‌دهند.`,
      body: body ? body.slice(0, 1000) : '',
      footer: `شماره پیگیری: ${ticket.number}`,
    },
    sms: `میلیونر: تیکت ${ticket.number} با موضوع «${subject.slice(0, 40)}» ثبت شد. پیگیری: ${config.appUrl}/tickets/${ticket.id}`,
  });

  for (const staff of staffForTicket(ticket)) {
    if (staff.id === actor.id) continue;
    notifyUser(staff, {
      type: 'ticket_new',
      title: `تیکت جدید ${ticket.number} — ${department.name}`,
      body: `${customer.name}: ${subject}`,
      ticket,
      email: {
        subject: `[${ticket.number}] تیکت جدید در بخش ${department.name}`,
        intro: `${customer.name}${customer.company ? ` (${customer.company})` : ''} تیکت جدیدی با اولویت «${PRIORITY_LABELS[priority]}» ثبت کرده است.`,
        body: `${subject}\n\n${body.slice(0, 1000)}`,
      },
      sms: ticket.assignee_id === staff.id ? `میلیونر: تیکت جدید ${ticket.number} به شما تخصیص یافت.` : null,
    });
  }
  return ticket;
}

export function addMessage({ ticket, sender, body = '', type = 'message', attachments = [] }) {
  const senderIsStaff = isStaff(sender);
  const createdAt = now();
  const msg = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO messages (ticket_id, sender_id, body, type, read_by_customer_at, read_by_agent_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(ticket.id, sender.id, body, type, senderIsStaff ? null : createdAt, senderIsStaff ? createdAt : null, createdAt);
    const msgId = info.lastInsertRowid;
    for (const a of attachments) {
      db.prepare(
        'INSERT INTO attachments (message_id, ticket_id, uploader_id, kind, original_name, stored_path, thumb_path, mime, size, width, height, duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(msgId, ticket.id, sender.id, a.kind, a.original_name, a.stored_path, a.thumb_path, a.mime, a.size, a.width, a.height, a.duration);
    }

    if (type === 'message') {
      const fields = { last_message_at: createdAt };
      if (senderIsStaff) {
        fields.last_agent_message_at = createdAt;
        fields.customer_unread = (ticket.customer_unread || 0) + 1;
        if (!ticket.first_response_at) fields.first_response_at = createdAt;
        if (['open', 'in_progress'].includes(ticket.status)) {
          fields.status = 'waiting_customer';
        }
        if (!ticket.assignee_id && sender.role === 'agent') fields.assignee_id = sender.id;
      } else {
        fields.last_customer_message_at = createdAt;
        fields.agent_unread = (ticket.agent_unread || 0) + 1;
        if (['waiting_customer', 'resolved', 'closed'].includes(ticket.status)) {
          fields.status = 'open';
          fields.resolved_at = null;
          fields.closed_at = null;
          if (['resolved', 'closed'].includes(ticket.status)) {
            db.prepare('INSERT INTO ticket_events (ticket_id, actor_id, type, data) VALUES (?, ?, ?, ?)').run(ticket.id, sender.id, 'reopened', JSON.stringify({ from: ticket.status }));
          }
        }
      }
      touchTicket(ticket.id, fields);
    } else {
      touchTicket(ticket.id, {});
    }
    return db.prepare('SELECT * FROM messages WHERE id = ?').get(msgId);
  })();

  const updated = getTicket(ticket.id);
  const shapedForStaff = shapeMessage(msg, { role: 'admin' });
  emitToStaff('message:new', shapedForStaff);
  if (type !== 'note') emitToUser(updated.customer_id, 'message:new', shapeMessage(msg, { role: 'customer' }));
  broadcastTicket(ticket.id);

  // Notifications
  const preview = body ? body.slice(0, 200) : attachments.length ? '📎 پیوست ارسال شد' : '';
  if (type === 'message') {
    if (senderIsStaff) {
      const customer = db.prepare('SELECT * FROM users WHERE id = ?').get(updated.customer_id);
      notifyUser(customer, {
        type: 'ticket_reply',
        title: `پاسخ جدید در تیکت ${updated.number}`,
        body: preview,
        ticket: updated,
        email: {
          subject: `[${updated.number}] پاسخ جدید از پشتیبانی`,
          intro: `کارشناس پشتیبانی به تیکت «${updated.subject}» پاسخ داد:`,
          body: body.slice(0, 1500) || preview,
        },
        sms: `میلیونر: پاسخ جدید برای تیکت ${updated.number} ثبت شد. ${config.appUrl}/tickets/${updated.id}`,
      });
    } else {
      for (const staff of staffForTicket(updated)) {
        if (staff.id === sender.id) continue;
        notifyUser(staff, {
          type: 'ticket_customer_reply',
          title: `پاسخ مشتری در تیکت ${updated.number}`,
          body: `${sender.name}: ${preview}`,
          ticket: updated,
          email: updated.assignee_id === staff.id || !updated.assignee_id ? { subject: `[${updated.number}] پاسخ مشتری`, intro: `${sender.name} در تیکت «${updated.subject}» پیام جدیدی ارسال کرد:`, body: body.slice(0, 1500) || preview } : null,
          sms: null,
        });
      }
    }
  } else if (type === 'note') {
    // Mention-like: notify assignee about internal note from someone else
    if (updated.assignee_id && updated.assignee_id !== sender.id) {
      const assignee = db.prepare('SELECT * FROM users WHERE id = ?').get(updated.assignee_id);
      notifyUser(assignee, { type: 'ticket_note', title: `یادداشت داخلی در تیکت ${updated.number}`, body: `${sender.name}: ${preview}`, ticket: updated });
    }
  }
  return msg;
}

/** First time a staff member opens a ticket: tell the customer it is being reviewed. */
export function markAgentViewed(ticket, actor) {
  if (!ticket || ticket.agent_first_viewed_at || !isStaff(actor)) return ticket;
  const t = now();
  const fields = { agent_first_viewed_at: t };
  if (ticket.status === 'open') fields.status = 'in_progress';
  if (!ticket.assignee_id && actor.role === 'agent') fields.assignee_id = actor.id;
  touchTicket(ticket.id, fields);
  addEvent(ticket.id, actor.id, 'agent_viewed', { status: fields.status || ticket.status });
  const updated = getTicket(ticket.id);
  broadcastTicket(ticket.id);
  const customer = db.prepare('SELECT * FROM users WHERE id = ?').get(updated.customer_id);
  notifyUser(customer, { type: 'ticket_viewed', title: `تیکت ${updated.number} در حال بررسی است`, body: 'کارشناس پشتیبانی تیکت شما را مشاهده کرد.', ticket: updated });
  return updated;
}

export function changeStatus(ticket, actor, status, extra = {}) {
  if (ticket.status === status) return ticket;
  const t = now();
  const fields = { status };
  if (status === 'resolved') fields.resolved_at = t;
  if (status === 'closed') {
    fields.closed_at = t;
    if (!ticket.resolved_at) fields.resolved_at = t;
  }
  if (['open', 'in_progress', 'waiting_customer'].includes(status)) {
    fields.resolved_at = null;
    fields.closed_at = null;
  }
  touchTicket(ticket.id, fields);
  addEvent(ticket.id, actor?.id || null, 'status_changed', { from: ticket.status, to: status, ...extra });
  const updated = getTicket(ticket.id);
  broadcastTicket(ticket.id);

  if (actor && isStaff(actor) && ['resolved', 'closed', 'in_progress'].includes(status)) {
    const customer = db.prepare('SELECT * FROM users WHERE id = ?').get(updated.customer_id);
    const label = STATUS_LABELS[status];
    notifyUser(customer, {
      type: 'ticket_status',
      title: `وضعیت تیکت ${updated.number}: ${label}`,
      body: updated.subject,
      ticket: updated,
      email: status === 'resolved' ? { subject: `[${updated.number}] تیکت شما حل شد`, intro: `تیکت «${updated.subject}» به وضعیت «${label}» تغییر کرد. اگر مشکل برطرف شده، لطفاً به کیفیت پشتیبانی امتیاز دهید؛ در غیر این صورت با ارسال پیام، تیکت مجدداً باز می‌شود.` } : status === 'closed' ? { subject: `[${updated.number}] تیکت بسته شد`, intro: `تیکت «${updated.subject}» بسته شد. در صورت نیاز می‌توانید تیکت جدیدی ثبت کنید.` } : null,
      sms: status === 'resolved' ? `میلیونر: تیکت ${updated.number} حل شد. لطفاً به پشتیبانی امتیاز دهید.` : null,
    });
  } else if (actor && !isStaff(actor)) {
    for (const staff of staffForTicket(updated)) {
      if (staff.id === actor.id) continue;
      notifyUser(staff, { type: 'ticket_status', title: `مشتری تیکت ${updated.number} را ${STATUS_LABELS[status]} کرد`, body: updated.subject, ticket: updated });
    }
  }
  return updated;
}

export function assignTicket(ticket, actor, assigneeId) {
  if (ticket.assignee_id === assigneeId) return ticket;
  const assignee = assigneeId ? db.prepare("SELECT * FROM users WHERE id = ? AND role IN ('agent','admin') AND is_active = 1").get(assigneeId) : null;
  if (assigneeId && !assignee) throw Object.assign(new Error('کارشناس انتخاب‌شده معتبر نیست.'), { status: 400 });
  const fields = { assignee_id: assigneeId || null };
  if (assigneeId && ticket.status === 'open') fields.status = 'in_progress';
  touchTicket(ticket.id, fields);
  addEvent(ticket.id, actor.id, assigneeId ? 'assigned' : 'unassigned', { assignee_id: assigneeId, assignee_name: assignee?.name || null, from_id: ticket.assignee_id });
  const updated = getTicket(ticket.id);
  broadcastTicket(ticket.id);
  if (assignee && assignee.id !== actor.id) {
    notifyUser(assignee, {
      type: 'ticket_assigned',
      title: `تیکت ${updated.number} به شما تخصیص یافت`,
      body: updated.subject,
      ticket: updated,
      email: { subject: `[${updated.number}] تیکت به شما تخصیص یافت`, intro: `${actor.name} تیکت «${updated.subject}» را به شما تخصیص داد.` },
      sms: `میلیونر: تیکت ${updated.number} به شما تخصیص یافت.`,
    });
  }
  return updated;
}
