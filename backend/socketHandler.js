// Socket.IO connection and event handler
const initializeSocket = (io) => {
  // Track connected users
  const connectedUsers = {};

  io.on('connection', (socket) => {
    console.log(`New user connected: ${socket.id}`);

    // Handle user join with user ID
    socket.on('userJoin', (userId) => {
      connectedUsers[socket.id] = userId;
      console.log(`User ${userId} joined with socket ${socket.id}`);
      
      // Broadcast updated user count
      io.emit('userCount', Object.keys(connectedUsers).length);
    });

    // Handle custom messages
    socket.on('message', (data) => {
      console.log(`Message from ${socket.id}:`, data);
      // Broadcast message to all connected clients
      io.emit('newMessage', {
        userId: connectedUsers[socket.id],
        message: data,
        timestamp: new Date()
      });
    });

    // Handle bed status updates
    socket.on('bedStatusUpdate', (bedData) => {
      console.log(`Bed status update:`, bedData);
      // Broadcast bed status to all clients
      io.emit('bedStatusChanged', bedData);
    });

    // Handle occupancy log updates
    socket.on('occupancyLogUpdate', (logData) => {
      console.log(`Occupancy log update:`, logData);
      // Broadcast occupancy update to all clients
      io.emit('occupancyLogChanged', logData);
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
      const userId = connectedUsers[socket.id];
      delete connectedUsers[socket.id];
      console.log(`User ${userId} disconnected. Remaining users: ${Object.keys(connectedUsers).length}`);
      
      // Broadcast updated user count
      io.emit('userCount', Object.keys(connectedUsers).length);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error from ${socket.id}:`, error);
    });
  });
};

module.exports = initializeSocket;
