// backend/routes/userRoutes.js
// Admin-only routes for managing user accounts

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getUsers,
  approveUser,
  rejectUser
} = require('../controllers/userController');
const {
  validateApproveUser,
  validateUserIdParam
} = require('../middleware/validators');

// All routes require an approved hospital admin
router.use(protect);
router.use(authorize('hospital_admin'));

// @route   GET /api/users
// @query   status (optional: pending/approved/rejected)
router.get('/', getUsers);

// @route   PATCH /api/users/:id/approve
// @body    role (optional), ward (optional)
router.patch('/:id/approve', validateApproveUser, approveUser);

// @route   PATCH /api/users/:id/reject
router.patch('/:id/reject', validateUserIdParam, rejectUser);

module.exports = router;
