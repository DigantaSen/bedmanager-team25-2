// backend/controllers/hospitalReferralController.js
// Nearby hospital directory: referral lookups (managers, hospital admins) and directory management (hospital admins)

const { WARD_TYPES } = require('../models/Hospital');
const {
  getNearbyHospitals,
  listHospitals,
  getHospitalById,
  getHospitalsWithCapacity,
  createHospital,
  updateHospitalDetails,
  updateHospitalBeds,
  deleteHospital
} = require('../services/nearbyHospitalsService');

const DETAIL_FIELDS = ['name', 'address', 'distance', 'contactNumber', 'emergencyContact', 'location', 'isActive'];

// Only the directory fields an admin may set
const pickDetails = (body) => {
  const details = {};
  DETAIL_FIELDS.forEach((field) => {
    if (body[field] !== undefined) details[field] = body[field];
  });
  if (details.emergencyContact === '') details.emergencyContact = null;
  if (details.location) {
    const { latitude = null, longitude = null } = details.location;
    details.location = {
      latitude: latitude === '' ? null : latitude,
      longitude: longitude === '' ? null : longitude
    };
  }
  return details;
};

const pickWards = (wards) => wards.map(({ wardType, totalBeds, availableBeds }) => ({ wardType, totalBeds, availableBeds }));

const isNonNegativeNumber = (value) => value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;

const sendError = (res, message, error) => {
  console.error(`${message}:`, error);
  if (error.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: error.message });
  }
  if (error.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid hospital ID' });
  }
  return res.status(500).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
};

// @desc    Get nearby hospitals with optional filtering
// @route   GET /api/referrals/nearby-hospitals
// @access  Private (Managers, Hospital Admin)
const getNearbyHospitalsController = async (req, res) => {
  try {
    const { ward, maxDistance, minAvailableBeds } = req.query;

    if (ward && !WARD_TYPES.includes(ward)) {
      return res.status(400).json({ success: false, message: `Ward must be one of: ${WARD_TYPES.join(', ')}` });
    }
    if ((maxDistance !== undefined && !isNonNegativeNumber(maxDistance)) ||
        (minAvailableBeds !== undefined && !isNonNegativeNumber(minAvailableBeds))) {
      return res.status(400).json({ success: false, message: 'maxDistance and minAvailableBeds must be numbers (0 or more)' });
    }

    const filters = {};
    if (ward) filters.ward = ward;
    if (maxDistance !== undefined) filters.maxDistance = maxDistance;
    if (minAvailableBeds !== undefined) filters.minAvailableBeds = minAvailableBeds;

    const hospitals = await getNearbyHospitals(filters);

    // Calculate summary statistics
    const summary = {
      totalHospitals: hospitals.length,
      averageDistance: hospitals.length > 0
        ? Math.round((hospitals.reduce((sum, h) => sum + h.distance, 0) / hospitals.length) * 10) / 10
        : null
    };

    if (ward) {
      summary.totalAvailableBeds = hospitals.reduce((sum, h) => sum + (h.wards[ward]?.available || 0), 0);
    }

    res.status(200).json({
      success: true,
      count: hospitals.length,
      summary,
      data: {
        hospitals,
        filters
      }
    });
  } catch (error) {
    sendError(res, 'Error fetching nearby hospitals', error);
  }
};

// @desc    Get specific hospital by ID
// @route   GET /api/referrals/hospitals/:id
// @access  Private (Managers, Hospital Admin)
const getHospitalByIdController = async (req, res) => {
  try {
    const hospital = await getHospitalById(req.params.id);

    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { hospital }
    });
  } catch (error) {
    sendError(res, 'Error fetching hospital details', error);
  }
};

// @desc    Get hospitals with available capacity for a specific ward
// @route   GET /api/referrals/available-capacity
// @access  Private (Managers, Hospital Admin)
const getAvailableCapacityController = async (req, res) => {
  try {
    const { ward } = req.query;

    if (!ward || !WARD_TYPES.includes(ward)) {
      return res.status(400).json({
        success: false,
        message: `Ward parameter is required (one of: ${WARD_TYPES.join(', ')})`
      });
    }

    const hospitals = await getHospitalsWithCapacity(ward);

    res.status(200).json({
      success: true,
      count: hospitals.length,
      data: {
        ward,
        hospitals
      }
    });
  } catch (error) {
    sendError(res, 'Error fetching available capacity', error);
  }
};

// @desc    Get referral recommendations based on urgency and bed availability
// @route   GET /api/referrals/recommendations
// @access  Private (Managers, Hospital Admin)
const getReferralRecommendationsController = async (req, res) => {
  try {
    const { ward, urgency = 'medium' } = req.query;

    if (!ward || !WARD_TYPES.includes(ward)) {
      return res.status(400).json({
        success: false,
        message: `Ward parameter is required (one of: ${WARD_TYPES.join(', ')})`
      });
    }

    let hospitals = await getNearbyHospitals({ ward });

    // Filter based on urgency level
    switch (urgency.toLowerCase()) {
      case 'high':
        // For high urgency: closest hospitals with any availability
        hospitals = hospitals.slice(0, 3);
        break;

      case 'medium':
        // For medium urgency: hospitals within 7km with at least 2 beds
        hospitals = hospitals
          .filter((h) => h.distance <= 7 && h.wards[ward].available >= 2)
          .slice(0, 5);
        break;

      case 'low':
        // For low urgency: hospitals with good availability (3+ beds), most beds first
        hospitals = hospitals
          .filter((h) => h.wards[ward].available >= 3)
          .sort((a, b) => b.wards[ward].available - a.wards[ward].available)
          .slice(0, 5);
        break;

      default:
        hospitals = hospitals.slice(0, 5);
    }

    // Add recommendation reasons
    hospitals = hospitals.map((hospital) => ({
      ...hospital,
      recommendationReason: getRecommendationReason(hospital, ward, urgency)
    }));

    res.status(200).json({
      success: true,
      count: hospitals.length,
      data: {
        ward,
        urgency,
        recommendations: hospitals
      }
    });
  } catch (error) {
    sendError(res, 'Error generating referral recommendations', error);
  }
};

// Helper function to generate recommendation reason
const getRecommendationReason = (hospital, ward, urgency) => {
  const wardData = hospital.wards[ward];
  const reasons = [];

  if (hospital.distance <= 3) {
    reasons.push('Very close proximity');
  } else if (hospital.distance <= 5) {
    reasons.push('Nearby location');
  }

  if (wardData.available >= 5) {
    reasons.push('High bed availability');
  } else if (wardData.available >= 2) {
    reasons.push('Adequate bed availability');
  }

  if (wardData.occupancyRate !== null && wardData.occupancyRate < 70) {
    reasons.push('Low occupancy rate');
  }

  if (urgency === 'high' && reasons.length === 0) {
    reasons.push('Available for emergency transfer');
  }

  return reasons.join(', ') || 'Suitable for referral';
};

// @desc    List every hospital in the directory (including inactive ones)
// @route   GET /api/referrals/hospitals
// @access  Private (Hospital Admin)
const listHospitalsController = async (req, res) => {
  try {
    const hospitals = await listHospitals();
    res.status(200).json({
      success: true,
      count: hospitals.length,
      data: { hospitals }
    });
  } catch (error) {
    sendError(res, 'Error fetching the hospital directory', error);
  }
};

// @desc    Add a hospital with its wards and current bed counts
// @route   POST /api/referrals/hospitals
// @access  Private (Hospital Admin)
const createHospitalController = async (req, res) => {
  try {
    const hospital = await createHospital(pickDetails(req.body), pickWards(req.body.wards), req.user._id);
    res.status(201).json({
      success: true,
      message: `${hospital.name} added to the directory`,
      data: { hospital }
    });
  } catch (error) {
    sendError(res, 'Error adding hospital', error);
  }
};

// @desc    Update a hospital's details (bed counts are updated separately)
// @route   PUT /api/referrals/hospitals/:id
// @access  Private (Hospital Admin)
const updateHospitalController = async (req, res) => {
  try {
    const hospital = await updateHospitalDetails(req.params.id, pickDetails(req.body));
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }
    res.status(200).json({
      success: true,
      message: `${hospital.name} updated`,
      data: { hospital }
    });
  } catch (error) {
    sendError(res, 'Error updating hospital', error);
  }
};

// @desc    Replace a hospital's ward bed counts (records when and by whom)
// @route   PUT /api/referrals/hospitals/:id/beds
// @access  Private (Hospital Admin)
const updateHospitalBedsController = async (req, res) => {
  try {
    const hospital = await updateHospitalBeds(req.params.id, pickWards(req.body.wards), req.user._id);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }
    res.status(200).json({
      success: true,
      message: `Bed counts updated for ${hospital.name}`,
      data: { hospital }
    });
  } catch (error) {
    sendError(res, 'Error updating bed counts', error);
  }
};

// @desc    Remove a hospital from the directory
// @route   DELETE /api/referrals/hospitals/:id
// @access  Private (Hospital Admin)
const deleteHospitalController = async (req, res) => {
  try {
    const deleted = await deleteHospital(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }
    res.status(200).json({
      success: true,
      message: 'Hospital removed from the directory'
    });
  } catch (error) {
    sendError(res, 'Error removing hospital', error);
  }
};

module.exports = {
  getNearbyHospitals: getNearbyHospitalsController,
  getHospitalById: getHospitalByIdController,
  getAvailableCapacity: getAvailableCapacityController,
  getReferralRecommendations: getReferralRecommendationsController,
  listHospitals: listHospitalsController,
  createHospital: createHospitalController,
  updateHospital: updateHospitalController,
  updateHospitalBeds: updateHospitalBedsController,
  deleteHospital: deleteHospitalController
};
