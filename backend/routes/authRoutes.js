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
const { loginLimiter, signupLimiter } = require('../middleware/rateLimit');

// Public routes. These are the only endpoints reachable without a token, so they are the
// ones worth rate limiting: password guessing and flooding the approval queue.
router.post('/register', signupLimiter, validateRegister, register);
router.post('/login', loginLimiter, validateLogin, login);

// Protected routes
router.get('/me', protect, getMe);
router.delete('/account', protect, deleteAccount);

module.exports = router;
