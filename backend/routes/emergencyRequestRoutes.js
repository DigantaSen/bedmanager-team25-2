// backend/routes/emergencyRequestRoutes.js
const express = require('express');
const router = express.Router();
const {
  createEmergencyRequest,
  getAllEmergencyRequests,
  getEmergencyRequestById,
  updateEmergencyRequest,
  deleteEmergencyRequest,
  approveEmergencyRequest,
  rejectEmergencyRequest
} = require('../controllers/emergencyRequestController');
const { protect } = require('../middleware/authMiddleware');

// POST /api/emergency-requests - Create new emergency request (ER Staff)
router.post('/', protect, createEmergencyRequest);

// GET /api/emergency-requests - Get all emergency requests (filtered by ward for managers)
router.get('/', protect, getAllEmergencyRequests);

// GET /api/emergency-requests/:id - Get single emergency request by ID
router.get('/:id', protect, getEmergencyRequestById);

// PATCH /api/emergency-requests/:id/approve - Approve request (Manager only)
router.patch('/:id/approve', protect, approveEmergencyRequest);

// PATCH /api/emergency-requests/:id/reject - Reject request (Manager only)
router.patch('/:id/reject', protect, rejectEmergencyRequest);

// PUT /api/emergency-requests/:id - Update emergency request
router.put('/:id', protect, updateEmergencyRequest);

// DELETE /api/emergency-requests/:id - Delete emergency request
router.delete('/:id', protect, deleteEmergencyRequest);

module.exports = router;
