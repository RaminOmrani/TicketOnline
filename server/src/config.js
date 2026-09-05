import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(process.cwd());
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));
const uploadDir = path.join(dataDir, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const isProd = process.env.NODE_ENV === 'production';

export const config = {
  isProd,
  port: Number(process.env.PORT || 4000),
  host: process.env.HOST || '0.0.0.0',
  appUrl: (process.env.APP_URL || 'https://support.softmiliac.com').replace(/\/$/, ''),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4000').split(',').map((s) => s.trim()).filter(Boolean),
  jwtSecret: process.env.JWT_SECRET || (isProd ? '' : 'dev-secret-change-me'),
  jwtDays: Number(process.env.JWT_DAYS || 14),
  cookieName: 'ms_token',
  dataDir,
  uploadDir,
  dbPath: path.join(dataDir, 'support.db'),
  clientDist: path.resolve(process.env.CLIENT_DIST || path.join(root, '..', 'client', 'dist')),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'پشتیبانی میلیونر <info@softmiliac.com>',
  },
  sms: {
    provider: process.env.SMS_PROVIDER || '', // 'kavenegar' | ''
    apiKey: process.env.SMS_API_KEY || '',
    sender: process.env.SMS_SENDER || '',
  },
  trustProxy: process.env.TRUST_PROXY !== 'false',
};

if (isProd && !config.jwtSecret) {
  console.error('FATAL: JWT_SECRET must be set in production');
  process.exit(1);
}
