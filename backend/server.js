// backend/server.js
require('dotenv').config();
const { getJwtSecret } = require('./config/jwt');

// Fail fast: never run with a missing or weak JWT secret
try {
  getJwtSecret();
} catch (err) {
  console.error(`❌ ${err.message}`);
  console.error('💡 Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const healthRouter = require('./routes/health');
const authRoutes = require('./routes/authRoutes');
const bedRoutes = require('./routes/bedRoutes');
const logRoutes = require('./routes/logRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const emergencyRequestRoutes = require('./routes/emergencyRequestRoutes');
const alertRoutes = require('./routes/alertRoutes');
const reportRoutes = require('./routes/reportRoutes');
const initializeSocket = require('./socketHandler');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const scheduledReportService = require('./services/scheduledReportService');

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
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
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
      console.log('⚠️ CORS - Origin not in allowed list:', origin);
      // Return false instead of Error to avoid 500 status
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

app.use(express.json());

// Make io available to routes via req
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Serve static files for uploads
app.use('/uploads', express.static('uploads'));

app.use('/api/health', healthRouter);
app.use('/api/auth', authRoutes);
app.use('/api/beds', bedRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/emergency-requests', emergencyRequestRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api/referrals', require('./routes/referralRoutes'));
app.use('/api/users', require('./routes/userRoutes'));

// Initialize socket connections
initializeSocket(io);

// Initialize scheduled reports
scheduledReportService.initialize();

// Error handling middlewares (must be last)
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5001;

connectDB().then(async () => {
  // Accounts created before the approval workflow have no status yet - keep them active
  if (mongoose.connection.readyState === 1) {
    await User.approveLegacyAccounts();
  }
  server.listen(PORT, () => console.log(`Backend: listening on port ${PORT}`));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  scheduledReportService.shutdown();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  scheduledReportService.shutdown();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});