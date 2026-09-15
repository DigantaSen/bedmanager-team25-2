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
const { protect, authorize } = require('../middleware/authMiddleware');

// Emergency requests hold patient names and contact numbers, so every route needs a login
router.use(protect);

// Managers and hospital admins decide on requests; ER staff only raise and track their own
const canDecide = authorize('manager', 'hospital_admin');

// POST /api/emergency-requests - Raise a request (ER staff, and managers/admins on their behalf)
router.post('/', authorize('er_staff', 'manager', 'hospital_admin'), createEmergencyRequest);

// GET /api/emergency-requests - Admins see all, managers their ward, ER staff their own
router.get('/', authorize('er_staff', 'manager', 'hospital_admin'), getAllEmergencyRequests);

// GET /api/emergency-requests/:id - Same scope as the list, checked against the loaded request
router.get('/:id', authorize('er_staff', 'manager', 'hospital_admin'), getEmergencyRequestById);

// PATCH /api/emergency-requests/:id/approve - Approve a request (ward-checked for managers)
router.patch('/:id/approve', canDecide, approveEmergencyRequest);

// PATCH /api/emergency-requests/:id/reject - Reject a request (ward-checked for managers)
router.patch('/:id/reject', canDecide, rejectEmergencyRequest);

// PUT /api/emergency-requests/:id - Edit a request (ward-checked for managers)
router.put('/:id', canDecide, updateEmergencyRequest);

// DELETE /api/emergency-requests/:id - Remove a request entirely (hospital admin only)
router.delete('/:id', authorize('hospital_admin'), deleteEmergencyRequest);

module.exports = router;
