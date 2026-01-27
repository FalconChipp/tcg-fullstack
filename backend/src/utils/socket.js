let socketServer = null;

export function setSocketServer(io) {
  socketServer = io;
}

export function getSocketServer() {
  return socketServer;
}

export function emitUserNotification(userId, payload) {
  if (!socketServer || !userId) return;
  socketServer.to(userId).emit('notification', payload);
}
