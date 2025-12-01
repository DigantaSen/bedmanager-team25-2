// backend/routes/profileRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const {
  getProfile,
  updateProfile,
  deleteProfilePicture
} = require('../controllers/profileController');

// All routes require authentication
router.use(protect);

// Profile routes
router.get('/', getProfile);
router.put('/', upload.single('profilePicture'), updateProfile);
router.delete('/picture', deleteProfilePicture);

module.exports = router;
