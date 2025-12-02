// backend/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  deleteAccount
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const {
  validateRegister,
  validateLogin
} = require('../middleware/validators');

// Public routes
router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);

// Protected routes
router.get('/me', protect, getMe);
router.delete('/account', protect, deleteAccount);

module.exports = router;
