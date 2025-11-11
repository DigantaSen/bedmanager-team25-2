// backend/routes/emergencyRequestRoutes.js
const express = require('express');
const router = express.Router();
const {
  createEmergencyRequest,
  getAllEmergencyRequests,
  getEmergencyRequestById,
  updateEmergencyRequest,
  deleteEmergencyRequest
} = require('../controllers/emergencyRequestController');

// POST /api/emergency-requests - Create new emergency request
router.post('/', createEmergencyRequest);

// GET /api/emergency-requests - Get all emergency requests
router.get('/', getAllEmergencyRequests);

// GET /api/emergency-requests/:id - Get single emergency request by ID
router.get('/:id', getEmergencyRequestById);

// PUT /api/emergency-requests/:id - Update emergency request
router.put('/:id', updateEmergencyRequest);

// DELETE /api/emergency-requests/:id - Delete emergency request
router.delete('/:id', deleteEmergencyRequest);

module.exports = router;
