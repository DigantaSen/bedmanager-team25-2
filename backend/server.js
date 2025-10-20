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
const connectDB = require('./config/db');
const healthRouter = require('./routes/health');
const app = express();

app.use(express.json());
app.use('/api/health', healthRouter);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Backend: listening on port ${PORT}`));
});