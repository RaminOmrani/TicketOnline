import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import './db.js';
import { attachUser, csrfGuard } from './lib/auth.js';
import { seed } from './seed.js';
import { createSocket } from './socket.js';
import { startJobs } from './jobs.js';
import authRoutes from './routes/auth.js';
import ticketRoutes from './routes/tickets.js';
import fileRoutes from './routes/files.js';
import cannedRoutes from './routes/canned.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';
import kbRoutes from './routes/kb.js';
import publicRoutes from './routes/public.js';

seed({ verbose: !config.isProd || process.env.SEED_VERBOSE === 'true' });

const app = express();
app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'blob:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'ws:', 'wss:', ...config.corsOrigins],
        frameSrc: ["'self'"],
        objectSrc: ["'none'"],
        workerSrc: ["'self'", 'blob:'],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
  })
);
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
app.use(attachUser);

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 1500, standardHeaders: true, legacyHeaders: false, message: { error: 'تعداد درخواست‌ها بیش از حد مجاز است.' } });
app.use('/api', apiLimiter, csrfGuard);

app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/canned', cannedRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/kb', kbRoutes);

// Branding assets (logo)
app.use('/branding', express.static(path.join(config.dataDir, 'branding'), { maxAge: '7d', immutable: true }));

app.use('/api', (req, res) => res.status(404).json({ error: 'مسیر یافت نشد.' }));

// Serve built client
if (fs.existsSync(config.clientDist)) {
  app.use(express.static(config.clientDist, { maxAge: '1y', index: false, setHeaders: (res, p) => p.endsWith('.html') && res.setHeader('Cache-Control', 'no-cache') }));
  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(config.clientDist, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => res.send('Millionaire Support API is running. Build the client to serve the UI.'));
}

// Error handler
app.use((err, req, res, _next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'حجم درخواست بیش از حد مجاز است.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'بدنه درخواست نامعتبر است.' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'خطای داخلی سرور. لطفاً دوباره تلاش کنید.' : err.message });
});

const server = http.createServer(app);
createSocket(server);
startJobs();

server.listen(config.port, config.host, () => {
  console.log(`Millionaire Support server listening on http://${config.host}:${config.port} (${config.isProd ? 'production' : 'development'})`);
});

process.on('unhandledRejection', (e) => console.error('unhandledRejection', e));
