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
const { protect, authorize } = require('../middleware/authMiddleware');

// Reports aggregate occupancy across the hospital, so they need a login and a role
router.use(protect);

// Managers and hospital admins run and read reports
const canUseReports = authorize('manager', 'hospital_admin');

// Only hospital admins change what gets emailed on a schedule, or trigger a send
const canManageSchedules = authorize('hospital_admin');

// Report generation routes
router.post('/generate/pdf', canUseReports, generatePDFReport);
router.post('/generate/csv', canUseReports, generateCSVReport);
router.post('/email', canUseReports, emailReport);

// Report history routes
router.get('/history', canUseReports, getReportHistory);
router.get('/download/:fileName', canUseReports, downloadReport);
router.delete('/:fileName', canUseReports, deleteReport);

// Scheduled report routes
router.get('/schedules', canUseReports, getSchedules);
router.put('/schedules/:scheduleId', canManageSchedules, updateSchedule);
router.post('/schedules/:scheduleId/run', canManageSchedules, runScheduleNow);

module.exports = router;
