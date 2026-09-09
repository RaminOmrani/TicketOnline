import { Router } from 'express';
import { db } from '../db.js';
import { publicSettings } from '../lib/settings.js';
import { emailEnabled, smsEnabled } from '../lib/notify.js';

const router = Router();

router.get('/config', (req, res) => {
  const departments = db
    .prepare('SELECT id, name, slug, description, icon, color, company_id, sla_first_response_minutes, sla_resolve_minutes FROM departments WHERE is_active = 1 ORDER BY sort_order, id')
    .all();
  const companies = db
    .prepare('SELECT id, name, name_en, slug, description, logo, color, sort_order, support_email, support_phone, website FROM companies WHERE is_active = 1 ORDER BY sort_order, id')
    .all()
    .map((c) => ({
      ...c,
      departments: departments.filter((d) => d.company_id === c.id),
      products: db.prepare('SELECT id, name FROM products WHERE company_id = ? AND is_active = 1 ORDER BY sort_order, id').all(c.id).map((p) => p.name),
    }));
  res.json({
    settings: publicSettings(),
    departments,
    companies,
    channels: { email: emailEnabled(), sms: smsEnabled() },
    statuses: { open: 'باز', in_progress: 'در حال بررسی', waiting_customer: 'در انتظار پاسخ مشتری', resolved: 'حل شده', closed: 'بسته شده' },
    priorities: { low: 'کم', normal: 'عادی', high: 'زیاد', urgent: 'فوری' },
  });
});

router.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

export default router;
