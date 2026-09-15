// Socket.IO connection and event handler
const { verifyToken } = require('./config/jwt');
const Alert = require('./models/Alert');
const User = require('./models/User');
const { joinRooms, emitAlert } = require('./services/socketEvents');

const initializeSocket = (io) => {
  // Track authenticated users
  const authenticatedUsers = {};

  // Middleware to verify JWT token on connection
  io.use(async (socket, next) => {
    // Tokens are credentials: they are never written to the log, not even partially
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      console.log(`❌ Connection rejected: no token provided (${socket.id})`);
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = verifyToken(token);

      // Only approved accounts may connect (covers accounts rejected after login)
      const user = await User.findById(decoded.id).select('status');
      if (!user || user.status !== 'approved') {
        console.log(`❌ Connection rejected: account not approved (${socket.id})`);
        return next(new Error('Authentication error: Account not approved'));
      }

      socket.user = decoded; // Attach user data to socket
      next();
    } catch (error) {
      console.log(`❌ Connection rejected: invalid token (${socket.id}): ${error.message}`);
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ Authenticated user connected: ${socket.user.role} (${socket.id})`);

    // Store authenticated user
    authenticatedUsers[socket.id] = {
      userId: socket.user.id,
      role: socket.user.role,
      ward: socket.user.ward,
      socketId: socket.id
    };

    // Rooms decide who receives which event; see services/socketEvents
    joinRooms(socket, socket.user);

    // Clients only listen. The server used to accept "message", "bedStatusUpdate" and
    // "occupancyLogUpdate" from any authenticated client and rebroadcast them to everyone,
    // which let any account - including roles that never see patient data - push invented
    // beds and patient names into every other user's screen. Bed and request events now
    // come only from the controllers, after the change has been checked and saved.

    // Handle user disconnect
    socket.on('disconnect', () => {
      delete authenticatedUsers[socket.id];
      console.log(`User disconnected (${socket.id}). Remaining users: ${Object.keys(authenticatedUsers).length}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error from ${socket.id}:`, error.message);
    });
  });
};

/**
 * @desc    Create and emit a new alert in real-time
 * @param   {Object} alertData - Alert data to create
 * @param   {Object} io - Socket.IO server instance
 * @returns {Object} Created alert document
 */
const emitNewAlert = async (alertData, io) => {
  try {
    // Create new alert in database
    const newAlert = await Alert.create(alertData);

    // Alerts carry patient names and ward figures, so they follow the alert's own audience
    emitAlert(io, newAlert);

    console.log('✅ Alert created and emitted:', {
      type: newAlert.type,
      severity: newAlert.severity,
      targetRole: newAlert.targetRole
    });

    return newAlert;
  } catch (error) {
    console.error('❌ Error creating/emitting alert:', error);
    throw error;
  }
};

module.exports = initializeSocket;
module.exports.emitNewAlert = emitNewAlert;
