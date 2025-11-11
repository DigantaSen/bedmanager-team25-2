// // backend/server.js
// require('dotenv').config();
// const express = require('express');

// const connectDB = require('./config/db');   // safe helper (skips connect if MONGO_URI empty)
// const healthRouter = require('./routes/health');

// const app = express();

// app.use(express.json());
// app.use('/api/health', healthRouter);

// const PORT = process.env.PORT || 5000;

// connectDB()
//   .then(() => {
//     app.listen(PORT, () => {
//       console.log(`Backend: listening on port ${PORT}`);
//     });
//   })
//   .catch((err) => {
//     console.error('Backend failed to start (db connect error):', err);
//     process.exit(1);
//   });

// module.exports = app;
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
const connectDB = require('./config/db');
const healthRouter = require('./routes/health');
const authRoutes = require('./routes/authRoutes');
const bedRoutes = require('./routes/bedRoutes');
const logRoutes = require('./routes/logRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const emergencyRequestRoutes = require('./routes/emergencyRequestRoutes');
const alertRoutes = require('./routes/alertRoutes');
const initializeSocket = require('./socketHandler');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Enable CORS for all routes - Allow both localhost and 127.0.0.1
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like Postman, mobile apps, curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Make io available to routes via req
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use('/api/health', healthRouter);
app.use('/api/auth', authRoutes);
app.use('/api/beds', bedRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/emergency-requests', emergencyRequestRoutes);
app.use('/api/alerts', alertRoutes);

// Initialize socket connections
initializeSocket(io);

// Test endpoint to broadcast dummy event
app.get('/api/test/broadcast', (req, res) => {
  const testData = {
    type: 'test',
    message: 'This is a dummy broadcast event',
    timestamp: new Date(),
    data: {
      bedId: 'BED-001',
      status: 'occupied',
      occupancy: 95
    }
  };
  
  io.emit('testBroadcast', testData);
  console.log('Test broadcast sent:', testData);
  
  res.json({
    success: true,
    message: 'Dummy event broadcast to all connected clients',
    broadcastData: testData
  });
});

// Error handling middlewares (must be last)
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.listen(PORT, () => console.log(`Backend: listening on port ${PORT}`));
});