// backend/controllers/hospitalReferralController.js
// Controller for handling hospital referral and nearby hospital requests

const {
  getNearbyHospitals,
  getHospitalById,
  getHospitalsWithCapacity
} = require('../services/nearbyHospitalsService');

// @desc    Get nearby hospitals with optional filtering
// @route   GET /api/referrals/nearby-hospitals
// @access  Private (Managers, Hospital Admin)
const getNearbyHospitalsController = async (req, res) => {
  try {
    const { ward, maxDistance, minAvailableBeds } = req.query;

    const filters = {};
    if (ward) filters.ward = ward;
    if (maxDistance) filters.maxDistance = maxDistance;
    if (minAvailableBeds) filters.minAvailableBeds = minAvailableBeds;

    const hospitals = await getNearbyHospitals(filters); // Added await

    // Calculate summary statistics
    const summary = {
      totalHospitals: hospitals.length,
      averageDistance: hospitals.length > 0 
        ? (hospitals.reduce((sum, h) => sum + h.distance, 0) / hospitals.length).toFixed(1)
        : 0
    };

    if (ward) {
      summary.totalAvailableBeds = hospitals.reduce((sum, h) => 
        sum + (h.wards[ward]?.available || 0), 0
      );
    }

    res.status(200).json({
      success: true,
      count: hospitals.length,
      summary,
      data: {
        hospitals,
        filters: filters
      }
    });
  } catch (error) {
    console.error('Error in getNearbyHospitalsController:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching nearby hospitals',
      error: error.message
    });
  }
};

// @desc    Get specific hospital by ID
// @route   GET /api/referrals/hospitals/:id
// @access  Private (Managers, Hospital Admin)
const getHospitalByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    const hospital = await getHospitalById(id); // Added await

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
    console.error('Error in getHospitalByIdController:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching hospital details',
      error: error.message
    });
  }
};

// @desc    Get hospitals with available capacity for a specific ward
// @route   GET /api/referrals/available-capacity
// @access  Private (Managers, Hospital Admin)
const getAvailableCapacityController = async (req, res) => {
  try {
    const { ward } = req.query;

    if (!ward) {
      return res.status(400).json({
        success: false,
        message: 'Ward parameter is required'
      });
    }

    const hospitals = await getHospitalsWithCapacity(ward); // Added await

    res.status(200).json({
      success: true,
      count: hospitals.length,
      data: {
        ward,
        hospitals
      }
    });
  } catch (error) {
    console.error('Error in getAvailableCapacityController:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available capacity',
      error: error.message
    });
  }
};

// @desc    Get referral recommendations based on urgency and bed availability
// @route   GET /api/referrals/recommendations
// @access  Private (Managers, Hospital Admin)
const getReferralRecommendationsController = async (req, res) => {
  try {
    const { ward, urgency = 'medium' } = req.query;

    if (!ward) {
      return res.status(400).json({
        success: false,
        message: 'Ward parameter is required'
      });
    }

    let filters = { ward };
    let hospitals = await getNearbyHospitals(filters); // Added await

    // Filter based on urgency level
    switch (urgency.toLowerCase()) {
      case 'high':
        // For high urgency: closest hospitals with any availability
        hospitals = hospitals
          .filter(h => h.wards[ward]?.available > 0)
          .slice(0, 3); // Top 3 closest
        break;

      case 'medium':
        // For medium urgency: hospitals within 7km with at least 2 beds
        hospitals = hospitals
          .filter(h => h.distance <= 7 && h.wards[ward]?.available >= 2)
          .slice(0, 5); // Top 5
        break;

      case 'low':
        // For low urgency: hospitals with good availability (3+ beds), sorted by rating
        hospitals = hospitals
          .filter(h => h.wards[ward]?.available >= 3)
          .sort((a, b) => b.rating - a.rating)
          .slice(0, 5); // Top 5 by rating
        break;

      default:
        hospitals = hospitals.slice(0, 5);
    }

    // Add recommendation reasons
    hospitals = hospitals.map(hospital => ({
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
    console.error('Error in getReferralRecommendationsController:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating referral recommendations',
      error: error.message
    });
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

  if (hospital.rating >= 4.5) {
    reasons.push('Excellent rating');
  } else if (hospital.rating >= 4.0) {
    reasons.push('Good rating');
  }

  if (wardData.occupancyRate < 70) {
    reasons.push('Low occupancy rate');
  }

  if (urgency === 'high' && reasons.length === 0) {
    reasons.push('Available for emergency transfer');
  }

  return reasons.join(', ') || 'Suitable for referral';
};

module.exports = {
  getNearbyHospitals: getNearbyHospitalsController,
  getHospitalById: getHospitalByIdController,
  getAvailableCapacity: getAvailableCapacityController,
  getReferralRecommendations: getReferralRecommendationsController
};
