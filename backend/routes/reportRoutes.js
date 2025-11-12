const express = require('express');
const router = express.Router();
const {
  generatePDFReport,
  generateCSVReport,
  emailReport,
  getReportHistory,
  downloadReport,
  deleteReport,
  getSchedules,
  updateSchedule,
  runScheduleNow
} = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');

// Report generation routes
router.post('/generate/pdf', protect, generatePDFReport);
router.post('/generate/csv', protect, generateCSVReport);
router.post('/email', protect, emailReport);

// Report history routes
router.get('/history', protect, getReportHistory);
router.get('/download/:fileName', protect, downloadReport);
router.delete('/:fileName', protect, deleteReport);

// Scheduled report routes
router.get('/schedules', protect, getSchedules);
router.put('/schedules/:scheduleId', protect, updateSchedule);
router.post('/schedules/:scheduleId/run', protect, runScheduleNow);

module.exports = router;
