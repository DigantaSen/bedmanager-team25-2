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
const http = require('http');
const socketIO = require('socket.io');
const connectDB = require('./config/db');
const healthRouter = require('./routes/health');
const authRoutes = require('./routes/authRoutes');
const bedRoutes = require('./routes/bedRoutes');
const logRoutes = require('./routes/logRoutes');
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