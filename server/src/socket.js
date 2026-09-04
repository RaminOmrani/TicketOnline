import { Server } from 'socket.io';
import { config } from './config.js';
import { userFromToken, isStaff, agentDepartmentIds } from './lib/auth.js';
import { setIO, emitToStaff, emitToTicket } from './lib/realtime.js';
import { getTicket, canAccessTicket } from './lib/tickets.js';
import { db } from './db.js';

function parseCookies(header = '') {
  const out = {};
  header.split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

export function createSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.corsOrigins, credentials: true },
    maxHttpBufferSize: 1e6,
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || parseCookies(socket.handshake.headers.cookie || '')[config.cookieName];
    const user = userFromToken(token);
    if (!user) return next(new Error('unauthorized'));
    socket.data.userId = user.id;
    socket.data.role = user.role;
    next();
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    socket.join(`user:${userId}`);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (isStaff(user)) {
      socket.join('staff');
      agentDepartmentIds(user).forEach((d) => socket.join(`dept:${d}`));
      emitToStaff('presence', { user_id: userId, online: true });
    }

    socket.on('ticket:join', (ticketId) => {
      const t = getTicket(Number(ticketId));
      const u = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      if (t && canAccessTicket(u, t)) socket.join(`ticket:${t.id}`);
    });
    socket.on('ticket:leave', (ticketId) => socket.leave(`ticket:${Number(ticketId)}`));

    socket.on('typing', ({ ticket_id, name }) => {
      if (!socket.rooms.has(`ticket:${Number(ticket_id)}`)) return;
      socket.to(`ticket:${Number(ticket_id)}`).emit('typing', { ticket_id: Number(ticket_id), user_id: userId, name, role: socket.data.role, at: Date.now() });
    });

    socket.on('disconnect', () => {
      if (isStaff(user)) {
        // still online if another socket remains
        let still = false;
        for (const [, s] of io.of('/').sockets) if (s.data.userId === userId) still = true;
        if (!still) emitToStaff('presence', { user_id: userId, online: false });
      }
    });
  });

  setIO(io);
  return io;
}
