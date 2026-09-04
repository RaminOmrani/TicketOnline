let io = null;

export function setIO(instance) {
  io = instance;
}

export function emitToUser(userId, event, payload) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

export function emitToUsers(userIds, event, payload) {
  if (!io) return;
  for (const id of new Set(userIds)) io.to(`user:${id}`).emit(event, payload);
}

export function emitToTicket(ticketId, event, payload) {
  if (!io) return;
  io.to(`ticket:${ticketId}`).emit(event, payload);
}

export function emitToStaff(event, payload) {
  if (!io) return;
  io.to('staff').emit(event, payload);
}

export function emitToDepartment(departmentId, event, payload) {
  if (!io) return;
  io.to(`dept:${departmentId}`).emit(event, payload);
}

export function onlineUserIds() {
  if (!io) return new Set();
  const ids = new Set();
  for (const [, socket] of io.of('/').sockets) {
    if (socket.data?.userId) ids.add(socket.data.userId);
  }
  return ids;
}
