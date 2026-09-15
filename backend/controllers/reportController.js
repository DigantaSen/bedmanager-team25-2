const reportService = require('../services/reportService');
const emailService = require('../services/emailService');
const scheduledReportService = require('../services/scheduledReportService');
const { normalizeAddress } = require('../services/reportRecipients');
const { WARDS } = require('../config/roles');

const { REPORT_TYPES, DATE_RANGES } = reportService;
const FORMATS = ['pdf', 'csv'];

// Reject unknown report types, date ranges and wards instead of silently producing a
// different report or writing an arbitrary string from the body into the PDF
const getReportOptionsError = ({ reportType = 'comprehensive', dateRange = 'last7days', wards = [] }) => {
  if (!REPORT_TYPES.includes(reportType)) {
    return `Invalid reportType. Must be one of: ${REPORT_TYPES.join(', ')}`;
  }
  if (!DATE_RANGES.includes(dateRange)) {
    return `Invalid dateRange. Must be one of: ${DATE_RANGES.join(', ')}`;
  }
  if (!Array.isArray(wards)) {
    return 'wards must be an array';
  }
  const unknownWards = wards.filter((ward) => ward !== 'All Wards' && !WARDS.includes(ward));
  if (unknownWards.length > 0) {
    return `Invalid ward(s). Must be one of: ${WARDS.join(', ')}`;
  }
  return null;
};

/**
 * @desc    Generate PDF report
 * @route   POST /api/reports/generate/pdf
 * @access  Private
 */
exports.generatePDFReport = async (req, res) => {
  try {
    console.log('📊 PDF Report generation requested');
    const { reportType, dateRange, wards } = req.body;
    console.log('Config:', { reportType, dateRange, wards: wards?.length || 0 });

    const optionsError = getReportOptionsError(req.body);
    if (optionsError) {
      return res.status(400).json({ success: false, message: optionsError });
    }

    // Generate report data
    console.log('🔍 Fetching report data from database...');
    const reportData = await reportService.generateReportData({
      reportType,
      dateRange,
      wards
    });
    console.log('✅ Report data fetched');

    // Generate PDF
    console.log('📄 Starting PDF generation...');
    const pdfResult = await reportService.generatePDF(reportData);
    console.log('✅ PDF generation complete');

    // Send PDF as response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfResult.fileName}"`);
    res.send(pdfResult.buffer);
    console.log('✅ PDF sent to client');
  } catch (error) {
    console.error('❌ Generate PDF report error:', error.message);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error generating PDF report: ' + error.message,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Generate CSV report
 * @route   POST /api/reports/generate/csv
 * @access  Private
 */
exports.generateCSVReport = async (req, res) => {
  try {
    const { reportType, dateRange, wards } = req.body;

    const optionsError = getReportOptionsError(req.body);
    if (optionsError) {
      return res.status(400).json({ success: false, message: optionsError });
    }

    // Generate report data
    const reportData = await reportService.generateReportData({
      reportType,
      dateRange,
      wards
    });

    // Generate CSV
    const csvResult = await reportService.generateCSV(reportData);

    // Send CSV as response
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${csvResult.fileName}"`);
    res.send(csvResult.csv);
  } catch (error) {
    console.error('Generate CSV report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating CSV report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Email report
 * @route   POST /api/reports/email
 * @access  Private
 */
exports.emailReport = async (req, res) => {
  try {
    const { reportType, dateRange, wards, email, format = 'pdf' } = req.body;

    const optionsError = getReportOptionsError(req.body);
    if (optionsError) {
      return res.status(400).json({ success: false, message: optionsError });
    }

    if (!FORMATS.includes(format)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid format. Must be pdf or csv'
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required'
      });
    }

    // Managers choose who receives a report; the address only has to be a single valid one
    const recipient = normalizeAddress(email);
    if (!recipient) {
      return res.status(400).json({
        success: false,
        message: 'Enter a single valid email address'
      });
    }

    // Generate report data
    const reportData = await reportService.generateReportData({
      reportType,
      dateRange,
      wards
    });

    let reportBuffer, fileName;

    // Generate report in specified format
    if (format === 'pdf') {
      const pdfResult = await reportService.generatePDF(reportData);
      reportBuffer = pdfResult.buffer;
      fileName = pdfResult.fileName;
    } else {
      const csvResult = await reportService.generateCSV(reportData);
      reportBuffer = Buffer.from(csvResult.csv);
      fileName = csvResult.fileName;
    }

    // Send to the cleaned-up address, not the raw one from the request
    await emailService.sendReportEmail(recipient, null, reportBuffer, fileName, format);

    res.status(200).json({
      success: true,
      message: `Report sent to ${recipient}`,
      format,
      fileName
    });
  } catch (error) {
    console.error('Email report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error emailing report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get report history
 * @route   GET /api/reports/history
 * @access  Private
 */
exports.getReportHistory = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const reports = await reportService.getReportHistory(limit);

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports
    });
  } catch (error) {
    console.error('Get report history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching report history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Download report from history
 * @route   GET /api/reports/download/:fileName
 * @access  Private
 */
exports.downloadReport = async (req, res) => {
  try {
    const { fileName } = req.params;

    // Reject invalid/unsafe names (path traversal) before touching the filesystem
    if (!reportService.resolveReportPath(fileName)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report file name'
      });
    }

    const buffer = await reportService.getReport(fileName);

    if (!buffer) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    const ext = fileName.split('.').pop();
    const contentType = ext === 'pdf' ? 'application/pdf' : 'text/csv';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Download report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Delete report from history
 * @route   DELETE /api/reports/:fileName
 * @access  Private
 */
exports.deleteReport = async (req, res) => {
  try {
    const { fileName } = req.params;

    // Reject invalid/unsafe names (path traversal) before touching the filesystem
    if (!reportService.resolveReportPath(fileName)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report file name'
      });
    }

    const deleted = await reportService.deleteReport(fileName);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Report not found or could not be deleted'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get scheduled reports
 * @route   GET /api/reports/schedules
 * @access  Private
 */
exports.getSchedules = async (req, res) => {
  try {
    const schedules = scheduledReportService.getSchedules();

    res.status(200).json({
      success: true,
      count: schedules.length,
      data: schedules
    });
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching schedules',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Update scheduled report
 * @route   PUT /api/reports/schedules/:scheduleId
 * @access  Private
 */
exports.updateSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;

    // The service accepts only known fields; anything else in the body is ignored
    const result = await scheduledReportService.updateSchedule(scheduleId, req.body);

    if (!result.success) {
      const { status = 400, ...body } = result;
      return res.status(status).json(body);
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating schedule',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Run scheduled report now
 * @route   POST /api/reports/schedules/:scheduleId/run
 * @access  Private
 */
exports.runScheduleNow = async (req, res) => {
  try {
    const { scheduleId } = req.params;

    const result = await scheduledReportService.runScheduleNow(scheduleId);

    if (!result.success) {
      const { status = 500, ...body } = result;
      return res.status(status).json(body);
    }

    res.status(200).json({
      success: true,
      message: 'Schedule executed successfully',
      data: result
    });
  } catch (error) {
    console.error('Run schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Error running schedule',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
