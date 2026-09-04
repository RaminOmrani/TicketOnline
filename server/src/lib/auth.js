import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { config } from '../config.js';
import { getSetting } from './settings.js';

export const hashPassword = (pw) => bcrypt.hashSync(pw, 10);
export const verifyPassword = (pw, hash) => bcrypt.compareSync(pw, hash);

export function signToken(user) {
  return jwt.sign({ sub: user.id, v: user.token_version, role: user.role }, config.jwtSecret, {
    expiresIn: `${config.jwtDays}d`,
  });
}

export function setAuthCookie(res, token) {
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: config.jwtDays * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(config.cookieName, { path: '/' });
}

export function userFromToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    if (!user || !user.is_active || user.token_version !== payload.v) return null;
    return user;
  } catch {
    return null;
  }
}

export function tokenFromReq(req) {
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) return h.slice(7);
  return req.cookies?.[config.cookieName] || null;
}

export function attachUser(req, _res, next) {
  req.user = userFromToken(tokenFromReq(req));
  if (req.user) {
    // Throttled last_seen update
    const last = req.user.last_seen_at ? Date.parse(req.user.last_seen_at) : 0;
    if (Date.now() - last > 60_000) {
      db.prepare("UPDATE users SET last_seen_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(req.user.id);
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'برای دسترسی باید وارد حساب کاربری شوید.' });
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'برای دسترسی باید وارد حساب کاربری شوید.' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'شما مجوز انجام این عملیات را ندارید.' });
    next();
  };
}

export const isStaff = (user) => user && (user.role === 'agent' || user.role === 'admin');

export function agentDepartmentIds(user) {
  if (!user) return [];
  if (user.role === 'admin' || getSetting('agents_see_all_departments')) {
    return db.prepare('SELECT id FROM departments').all().map((r) => r.id);
  }
  return db.prepare('SELECT department_id FROM agent_departments WHERE user_id = ?').all(user.id).map((r) => r.department_id);
}

export function sanitizeUser(u, { full = false } = {}) {
  if (!u) return null;
  const base = {
    id: u.id,
    name: u.name,
    role: u.role,
    avatar: u.avatar,
    title: u.title,
    company: u.company,
  };
  if (full) {
    Object.assign(base, {
      email: u.email,
      mobile: u.mobile,
      is_active: !!u.is_active,
      notify_email: !!u.notify_email,
      notify_sms: !!u.notify_sms,
      last_seen_at: u.last_seen_at,
      created_at: u.created_at,
    });
  }
  return base;
}

export function normalizeMobile(m) {
  if (!m) return null;
  let s = String(m).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[\s\-()]/g, '');
  if (s.startsWith('+98')) s = '0' + s.slice(3);
  else if (s.startsWith('0098')) s = '0' + s.slice(4);
  else if (s.startsWith('98') && s.length === 12) s = '0' + s.slice(2);
  else if (s.startsWith('9') && s.length === 10) s = '0' + s;
  if (!/^09\d{9}$/.test(s)) return null;
  return s;
}

export function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.headers.authorization?.startsWith('Bearer ')) return next();
  if (req.headers['x-requested-with'] === 'XMLHttpRequest') return next();
  return res.status(403).json({ error: 'درخواست نامعتبر (CSRF).' });
}
