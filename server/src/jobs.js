import { db, now } from './db.js';
import { getSetting } from './lib/settings.js';
import { changeStatus, getTicket, staffForTicket } from './lib/tickets.js';
import { notifyUser } from './lib/notify.js';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

function autoCloseResolved() {
  const days = Number(getSetting('auto_close_resolved_days'));
  if (!days) return;
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const rows = db.prepare("SELECT * FROM tickets WHERE status = 'resolved' AND resolved_at IS NOT NULL AND resolved_at < ?").all(cutoff);
  for (const t of rows) {
    changeStatus(t, null, 'closed', { auto: true, reason: `بسته‌شدن خودکار پس از ${days} روز` });
  }
  if (rows.length) console.log(`[jobs] auto-closed ${rows.length} resolved tickets`);
}

function slaWarnings() {
  // Notify assignee (or department agents) once when a ticket becomes overdue
  const t = now();
  const rows = db
    .prepare(
      `SELECT * FROM tickets WHERE due_at IS NOT NULL AND due_at < ? AND status NOT IN ('resolved','closed')
       AND NOT EXISTS (SELECT 1 FROM ticket_events e WHERE e.ticket_id = tickets.id AND e.type = 'sla_overdue')`
    )
    .all(t);
  for (const ticket of rows) {
    db.prepare('INSERT INTO ticket_events (ticket_id, actor_id, type, data) VALUES (?, NULL, ?, ?)').run(ticket.id, 'sla_overdue', JSON.stringify({ due_at: ticket.due_at }));
    for (const staff of staffForTicket(ticket)) {
      notifyUser(staff, {
        type: 'sla_overdue',
        title: `⚠️ تیکت ${ticket.number} از مهلت SLA گذشته است`,
        body: ticket.subject,
        ticket,
        email: ticket.assignee_id === staff.id ? { subject: `[${ticket.number}] هشدار SLA`, intro: `تیکت «${ticket.subject}» از مهلت پاسخ‌گویی عبور کرده است. لطفاً در اولین فرصت رسیدگی کنید.` } : null,
      });
    }
  }
}

function cleanupTemp() {
  const dir = path.join(config.dataDir, 'tmp');
  try {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      const st = fs.statSync(p);
      if (Date.now() - st.mtimeMs > 6 * 3600 * 1000) fs.unlinkSync(p);
    }
  } catch {}
}

function purgeOldNotifications() {
  const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();
  db.prepare('DELETE FROM notifications WHERE created_at < ?').run(cutoff);
  db.prepare("DELETE FROM password_resets WHERE expires_at < ?").run(new Date(Date.now() - 86400000).toISOString());
}

export function startJobs() {
  const run = () => {
    try {
      autoCloseResolved();
      slaWarnings();
      cleanupTemp();
      purgeOldNotifications();
    } catch (e) {
      console.error('[jobs] error', e);
    }
  };
  setTimeout(run, 10_000);
  setInterval(run, 15 * 60 * 1000);
}
