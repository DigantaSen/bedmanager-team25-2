import { io } from 'socket.io-client';
import { updateBedInList, fetchBeds } from '../features/beds/bedsSlice';
import { addAlert } from '../features/alerts/alertsSlice';

let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

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
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  // Connection event listeners
  socket.on('connect', () => {
    console.log('✅ Socket connected:', socket.id);
    reconnectAttempts = 0; // Reset counter on successful connection
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Socket connection error:', error.message);
    reconnectAttempts++;
    
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('❌ Max reconnection attempts reached. Please refresh the page.');
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket disconnected:', reason);
    
    // Auto-reconnect for certain disconnect reasons
    if (reason === 'io server disconnect') {
      // Server disconnected the socket, attempt to reconnect
      console.log('🔄 Server disconnected socket, attempting to reconnect...');
      socket.connect();
    }
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
    reconnectAttempts = 0;
    
    // Task 2.6: Re-sync data after reconnection
    if (dispatch) {
      console.log('🔄 Re-syncing data after reconnection...');
      dispatch(fetchBeds());
    }
  });

  socket.on('reconnect_error', (error) => {
    console.error('❌ Socket reconnection error:', error.message);
  });

  socket.on('reconnect_failed', () => {
    console.error('❌ Socket reconnection failed after all attempts');
  });

  // Task 2.6: Listen for bedStatusChanged events (replaces bedUpdate)
  socket.on('bedStatusChanged', (data) => {
    console.log('🛏️ Bed status changed:', data);
    
    if (dispatch && data.bed) {
      dispatch(updateBedInList(data.bed));
    }
  });

  // Listen for bed update events (legacy support)
  socket.on('bedUpdate', (data) => {
    console.log('🛏️ Bed update received (legacy):', data);
    
    if (dispatch && data.bed) {
      dispatch(updateBedInList(data.bed));
    }
  });

  // Task 2.6: Listen for bedMaintenanceNeeded events
  socket.on('bedMaintenanceNeeded', (data) => {
    console.log('🔧 Bed maintenance needed:', data);
    
    if (dispatch && data.bed) {
      dispatch(updateBedInList(data.bed));
      
      // Show browser notification for maintenance alerts
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Bed Maintenance Required', {
          body: `Bed ${data.bed.bedId} in ${data.bed.ward} requires maintenance (${data.cleaningDuration} min)`,
          icon: '/maintenance-icon.png',
          tag: `maintenance-${data.bed._id}`
        });
      }
    }
  });

  // Listen for cleaning started events
  socket.on('bedCleaningStarted', (data) => {
    console.log('🧹 Bed cleaning started:', data);
    
    if (dispatch && data.bed) {
      dispatch(updateBedInList(data.bed));
    }
  });

  // Listen for cleaning completed events
  socket.on('bedCleaningCompleted', (data) => {
    console.log('✅ Bed cleaning completed:', data);
    
    if (dispatch && data.bed) {
      dispatch(updateBedInList(data.bed));
      
      // Show notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Cleaning Completed', {
          body: `Bed ${data.bed.bedId} cleaning completed${data.cleaningLog?.wasOverdue ? ' (Overdue)' : ''}`,
          icon: '/check-icon.png',
          tag: `cleaning-complete-${data.bed._id}`
        });
      }
    }
  });

  // Task 2.6: Listen for occupancyAlert events
  socket.on('occupancyAlert', (data) => {
    console.log('🚨 Occupancy alert received:', data);
    
    if (dispatch && data.alert) {
      dispatch(addAlert(data.alert));
      
      // Show browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('High Occupancy Alert', {
          body: data.alert.message,
          icon: '/alert-icon.png',
          tag: data.alert._id
        });
      }
    }
  });

  // Task 2.6: Listen for emergencyRequestCreated events
  socket.on('emergencyRequestCreated', (data) => {
    console.log('🚑 Emergency request created:', data);
    
    if (dispatch && data.request) {
      // You can dispatch to an emergencyRequestsSlice if it exists
      // For now, just show notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New Emergency Request', {
          body: `${data.request.reason} - ${data.request.priority} priority`,
          icon: '/emergency-icon.png',
          tag: `emergency-${data.request._id}`,
          requireInteraction: true // Keep notification visible
        });
      }
    }
  });

  // Task 2.6: Listen for emergencyRequestApproved events
  socket.on('emergencyRequestApproved', (data) => {
    console.log('✅ Emergency request approved:', data);
    
    if (dispatch && data.request) {
      // Show notification to ER staff
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Emergency Request Approved', {
          body: `Request approved. Bed ${data.allocatedBed?.bedId || 'assigned'} in ${data.request.ward}`,
          icon: '/success-icon.png',
          tag: `approved-${data.request._id}`
        });
      }
    }
  });

  // Task 2.6: Listen for emergencyRequestRejected events
  socket.on('emergencyRequestRejected', (data) => {
    console.log('❌ Emergency request rejected:', data);
    
    if (dispatch && data.request) {
      // Show notification to ER staff
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Emergency Request Rejected', {
          body: `Reason: ${data.request.rejectionReason || 'No reason provided'}`,
          icon: '/error-icon.png',
          tag: `rejected-${data.request._id}`
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

  // Task 2.6: Listen for alertDismissed events
  socket.on('alertDismissed', (data) => {
    console.log('🔕 Alert dismissed:', data);
    
    // You can dispatch an action to remove the alert from Redux store
    // For now, just log it
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
