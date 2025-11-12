// backend/routes/analyticsRoutes.js
const express = require('express');
const router = express.Router();
const {
  getOccupancySummary,
  getOccupancyByWard,
  getBedHistory,
  getOccupancyTrends,
  getForecasting,
  getCleaningPerformance
} = require('../controllers/analyticsController');
const { validateObjectId } = require('../middleware/validators');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public analytics routes (no authentication required for MVP)
// TODO: Add protect middleware when role-based analytics is needed

/**
 * GET /api/analytics/occupancy-summary
 * Get overall occupancy metrics
 */
router.get('/occupancy-summary', getOccupancySummary);

/**
 * GET /api/analytics/occupancy-by-ward
 * Get occupancy breakdown by ward
 */
router.get('/occupancy-by-ward', getOccupancyByWard);

/**
 * GET /api/analytics/bed-history/:bedId
 * Get complete history of status changes for a specific bed
 * Supports pagination via query params: limit, skip
 */
router.get('/bed-history/:bedId', getBedHistory);

/**
 * GET /api/analytics/occupancy-trends
 * Get occupancy trends over time
 * Query params: startDate (ISO), endDate (ISO), granularity (hourly|daily|weekly)
 */
router.get('/occupancy-trends', getOccupancyTrends);

/**
 * GET /api/analytics/forecasting
 * Get forecasting data - predicted discharges and capacity insights
 */
router.get('/forecasting', getForecasting);

/**
 * GET /api/analytics/cleaning-performance
 * Get cleaning performance analytics
 * Task 2.5b: Cleaning duration tracking and analytics
 */
router.get('/cleaning-performance', protect, authorize('manager', 'hospital_admin'), getCleaningPerformance);

module.exports = router;

