import { io } from 'socket.io-client';
import { updateBedInList } from '../features/beds/bedsSlice';
import { addAlert } from '../features/alerts/alertsSlice';

let socket = null;

/**
 * Initialize and connect to Socket.IO server
 * @param {string} token - JWT authentication token
 * @param {Function} dispatch - Redux dispatch function
 * @returns {Socket} socket instance
 */
export const connectSocket = (token, dispatch) => {
  // If socket already exists and is connected, return it
  if (socket && socket.connected) {
    console.log('Socket already connected');
    return socket;
  }

  // Disconnect existing socket if any
  if (socket) {
    socket.disconnect();
  }

  console.log('🔍 Connecting socket with token:', {
    hasToken: !!token,
    tokenType: typeof token,
    tokenPreview: token ? `${token.substring(0, 20)}...` : 'none',
    tokenLength: token?.length
  });

  // Create new socket connection
  const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5001';
  
  socket = io(SOCKET_URL, {
    auth: {
      token: token,
    },
    transports: ['websocket', 'polling'], // Prefer websocket, fallback to polling
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  // Connection event listeners
  socket.on('connect', () => {
    console.log('✅ Socket connected:', socket.id);
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Socket connection error:', error.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket disconnected:', reason);
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
  });

  socket.on('reconnect_error', (error) => {
    console.error('❌ Socket reconnection error:', error.message);
  });

  // Listen for bed update events
  socket.on('bedUpdate', (updatedBed) => {
    console.log('🛏️ Bed update received:', updatedBed);
    
    // Dispatch action to update Redux store
    if (dispatch) {
      dispatch(updateBedInList(updatedBed));
    }
  });

  // Listen for occupancy alert events
  socket.on('occupancyAlert', (data) => {
    console.log('🚨 Occupancy alert received:', data);
    
    // Dispatch action to add alert to Redux store
    if (dispatch && data.alert) {
      dispatch(addAlert(data.alert));
      
      // Optional: Show browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('High Occupancy Alert', {
          body: data.alert.message,
          icon: '/alert-icon.png',
          tag: data.alert._id
        });
      }
    }
  });

  // Listen for general alert created events
  socket.on('alertCreated', (alert) => {
    console.log('📢 Alert created:', alert);
    
    if (dispatch) {
      dispatch(addAlert(alert));
    }
  });

  // Optional: Listen for other events
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  return socket;
};

/**
 * Disconnect from Socket.IO server
 */
export const disconnectSocket = () => {
  if (socket) {
    console.log('🔌 Disconnecting socket...');
    socket.removeAllListeners(); // Clean up all listeners
    socket.disconnect();
    socket = null;
  }
};

/**
 * Get current socket instance
 * @returns {Socket|null} socket instance or null
 */
export const getSocket = () => {
  return socket;
};

/**
 * Check if socket is connected
 * @returns {boolean} true if connected, false otherwise
 */
export const isSocketConnected = () => {
  return socket && socket.connected;
};

/**
 * Emit a custom event to the server
 * @param {string} eventName - Name of the event
 * @param {any} data - Data to send with the event
 */
export const emitSocketEvent = (eventName, data) => {
  if (socket && socket.connected) {
    socket.emit(eventName, data);
  } else {
    console.warn('Socket is not connected. Cannot emit event:', eventName);
  }
};

export default {
  connectSocket,
  disconnectSocket,
  getSocket,
  isSocketConnected,
  emitSocketEvent,
};
