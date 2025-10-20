// backend/config/db.js
// Task 2: MongoDB connection with mongoose and detailed logging

const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI || '';
  
  if (!uri) {
    console.log('⚠️  No MONGO_URI found in environment variables');
    console.log('⚠️  Skipping database connection...');
    return Promise.resolve();
  }

  try {
    console.log('🔄 Attempting to connect to MongoDB...');
    
    await mongoose.connect(uri);
    
    console.log('✅ MongoDB connected successfully!');
    console.log(`📊 Database: ${mongoose.connection.name}`);
    console.log(`🌐 Host: ${mongoose.connection.host}`);
    console.log(`🔌 Port: ${mongoose.connection.port}`);

    // Connection event listeners
    mongoose.connection.on('connected', () => {
      console.log('✅ Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB runtime error:', err.message || err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('🛑 MongoDB connection closed due to app termination');
      process.exit(0);
    });

    return mongoose;
  } catch (err) {
    console.error('❌ MongoDB connection failed!');
    console.error('❌ Error:', err.message || err);
    console.error('💡 Please check:');
    console.error('   1. MongoDB is running');
    console.error('   2. MONGO_URI in .env is correct');
    console.error('   3. Network connectivity');
    throw err;
  }
}

module.exports = connectDB;