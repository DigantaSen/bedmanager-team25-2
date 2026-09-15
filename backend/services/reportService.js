const puppeteer = require('puppeteer');
const { Parser } = require('json2csv');
const fs = require('fs').promises;
const path = require('path');
const OccupancyLog = require('../models/OccupancyLog');
const CleaningLog = require('../models/CleaningLog');
const {
  DAY_MS,
  getBedsInScope,
  buildOccupancyPoints,
  summarizeOccupancy,
  getStaysAndTurnarounds
} = require('./occupancyHistory');

const REPORT_TYPES = ['comprehensive', 'occupancy', 'performance'];
const DATE_RANGES = ['today', 'yesterday', 'last7days', 'last30days', 'last90days', 'thisMonth', 'lastMonth'];

// Exactly the file names the generator produces: report_<timestamp>.pdf|csv (see generatePDF/generateCSV)
const REPORT_FILE_NAME = /^report_\d+\.(pdf|csv)$/;

// Ward names come from bed records and from the request body, so nothing is written into the
// report HTML unescaped - otherwise a ward called "<script>..." would run while the PDF renders
const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

class ReportService {
  constructor() {
    this.reportsDir = path.join(__dirname, '../reports');
    this.ensureReportsDirectory();
  }

  async ensureReportsDirectory() {
    try {
      await fs.mkdir(this.reportsDir, { recursive: true });
    } catch (error) {
      console.error('Error creating reports directory:', error);
    }
  }

  /**
   * @desc    Resolve a report file name to an absolute path inside the reports directory.
   *          Guards against path traversal (e.g. "..%2F..%2F.env"): the name must match the
   *          generator's format and the resolved path must stay within reportsDir.
   * @returns {string|null} the absolute path, or null for an invalid/unsafe name
   */
  resolveReportPath(fileName) {
    if (typeof fileName !== 'string' || !REPORT_FILE_NAME.test(fileName)) {
      return null;
    }
    const filePath = path.resolve(this.reportsDir, fileName);
    const root = path.resolve(this.reportsDir);
    if (filePath !== path.join(root, fileName)) {
      return null;
    }
    return filePath;
  }

  async generateReportData(options = {}) {
    const { reportType = 'comprehensive', dateRange = 'last7days', wards = [] } = options;
    const selectedWards = Array.isArray(wards) ? wards.filter((ward) => ward && ward !== 'All Wards') : [];

    // Current bed snapshot (beds in service); retired beds still count for the history they were part of
    const historyBeds = await getBedsInScope(selectedWards, { includeRetired: true });
    const beds = historyBeds.filter((bed) => !bed.retiredAt);
    const totalBeds = beds.length;
    const occupiedBeds = beds.filter(bed => bed.status === 'occupied').length;
    const availableBeds = beds.filter(bed => bed.status === 'available').length;
    const cleaningBeds = beds.filter(bed => bed.status === 'cleaning').length;
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    // Group by ward
    const wardStats = {};
    beds.forEach(bed => {
      if (!wardStats[bed.ward]) {
        wardStats[bed.ward] = { total: 0, occupied: 0, available: 0, cleaning: 0 };
      }
      wardStats[bed.ward].total++;
      wardStats[bed.ward][bed.status]++;
    });

    const { startDate, endDate } = this.getDateRange(dateRange);
    const summary = { totalBeds, occupiedBeds, availableBeds, cleaningBeds, occupancyRate };

    const reportData = {
      reportType,
      dateRange,
      generatedDate: new Date().toISOString(),
      summary,
      wardStats,
      selectedWards: selectedWards.length > 0 ? selectedWards : ['All Wards'],
      dateRangeLabel: this.getDateRangeLabel(dateRange),
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };

    if (reportType === 'comprehensive' || reportType === 'occupancy') {
      reportData.occupancy = await this.getOccupancyMetrics(historyBeds, summary, startDate, endDate);
    }
    if (reportType === 'comprehensive' || reportType === 'performance') {
      reportData.performance = await this.getPerformanceMetrics(historyBeds, selectedWards, startDate, endDate);
    }

    return reportData;
  }

  /**
   * @desc    Occupancy over the period, reconstructed from recorded assignments and releases
   */
  async getOccupancyMetrics(beds, summary, startDate, endDate) {
    const { totalBeds } = summary;
    if (beds.length === 0) {
      return { averageOccupancy: null, peakOccupancy: null, lowOccupancy: null, availabilityRate: null, cleaningRate: null };
    }

    // `beds` includes retired beds, which count only for the time they were in service
    const { points, capacityPoints, historyStart } = await buildOccupancyPoints(beds, startDate);
    const [period] = summarizeOccupancy(points, [{ start: startDate, end: endDate }], capacityPoints, historyStart);

    return {
      averageOccupancy: period.averageOccupancy,
      peakOccupancy: period.peakOccupancy,
      lowOccupancy: period.lowOccupancy,
      availabilityRate: totalBeds > 0 ? Math.round((summary.availableBeds / totalBeds) * 100) : null,
      cleaningRate: totalBeds > 0 ? Math.round((summary.cleaningBeds / totalBeds) * 100) : null
    };
  }

  /**
   * @desc    Admissions, discharges, stays and cleaning from occupancy and cleaning logs
   */
  async getPerformanceMetrics(beds, selectedWards, startDate, endDate) {
    const days = Math.max(1, (endDate - startDate) / DAY_MS);
    const bedIds = beds.map((bed) => bed._id);
    const inPeriod = { $gte: startDate, $lte: endDate };

    const cleaningQuery = { status: 'completed', actualDuration: { $ne: null }, endTime: inPeriod };
    if (selectedWards.length > 0) cleaningQuery.ward = { $in: selectedWards };

    const [admissions, discharges, { stayHours, turnaroundHours }, cleanings] = await Promise.all([
      OccupancyLog.countDocuments({ bedId: { $in: bedIds }, statusChange: 'assigned', timestamp: inPeriod }),
      OccupancyLog.countDocuments({ bedId: { $in: bedIds }, statusChange: 'released', timestamp: inPeriod }),
      getStaysAndTurnarounds(beds, startDate, endDate),
      CleaningLog.find(cleaningQuery).select('actualDuration estimatedDuration').lean()
    ]);

    const average = (values) => (values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
    const round1 = (value) => (value === null ? null : Math.round(value * 10) / 10);
    const avgStayHours = average(stayHours);
    const onTimeCleanings = cleanings.filter((log) => log.actualDuration <= log.estimatedDuration).length;

    return {
      admissions,
      discharges,
      dailyAdmissions: round1(admissions / days),
      dailyDischarges: round1(discharges / days),
      avgLengthOfStayDays: avgStayHours === null ? null : round1(avgStayHours / 24),
      bedTurnoverRate: beds.length > 0 ? round1((discharges / beds.length) * 100) : null,
      avgTurnaroundHours: round1(average(turnaroundHours)),
      completedCleanings: cleanings.length,
      avgCleaningMinutes: round1(average(cleanings.map((log) => log.actualDuration))),
      cleaningOnTimeRate: cleanings.length > 0 ? Math.round((onTimeCleanings / cleanings.length) * 100) : null
    };
  }

  getDateRange(dateRange) {
    const endDate = new Date();
    const startDate = new Date();

    switch (dateRange) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'yesterday':
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last30days':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'last90days':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case 'thisMonth':
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'lastMonth':
        startDate.setMonth(startDate.getMonth() - 1, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(0); // last day of the previous month
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last7days':
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    return { startDate, endDate };
  }

  getDateRangeLabel(dateRange) {
    const labels = {
      'today': 'Today',
      'yesterday': 'Yesterday',
      'last7days': 'Last 7 Days',
      'last30days': 'Last 30 Days',
      'last90days': 'Last 90 Days',
      'thisMonth': 'This Month',
      'lastMonth': 'Last Month'
    };
    return labels[dateRange] || 'Last 7 Days';
  }

  async generatePDF(reportData) {
    let browser;
    try {
      console.log('🔧 Launching puppeteer browser...');
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ],
        timeout: 30000
      });

      console.log('✅ Browser launched successfully');
      const page = await browser.newPage();

      // The report is a self-contained document: no script needs to run and nothing is fetched.
      // Turning both off means a value that slipped through escaping still cannot execute or
      // call out to a remote host while the PDF renders.
      await page.setJavaScriptEnabled(false);
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const url = request.url();
        if (url === 'about:blank' || url.startsWith('data:')) {
          return request.continue();
        }
        return request.abort();
      });

      console.log('📄 Generating HTML report...');
      const html = this.generateHTMLReport(reportData);

      console.log('📝 Setting page content...');
      await page.setContent(html, { waitUntil: 'load', timeout: 15000 });

      console.log('🖨️  Generating PDF...');
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });

      console.log('✅ PDF generated successfully');
      await browser.close();

      // Save PDF to file
      const fileName = `report_${Date.now()}.pdf`;
      const filePath = path.join(this.reportsDir, fileName);
      console.log(`💾 Saving PDF to: ${filePath}`);
      await fs.writeFile(filePath, pdfBuffer);

      console.log('✅ PDF saved successfully');
      return {
        buffer: pdfBuffer,
        fileName,
        filePath
      };
    } catch (error) {
      console.error('❌ Error generating PDF:', error.message);
      console.error('Stack:', error.stack);
      if (browser) {
        await browser.close();
      }
      throw error;
    }
  }

  generateHTMLReport(data) {
    const reportTypeLabel = this.getReportTypeLabel(data.reportType);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Hospital Bed Management Report</title>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #4a90e2;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          h1 {
            color: #2c3e50;
            margin: 0;
            font-size: 28px;
          }
          .meta-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin: 20px 0;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 5px;
          }
          .meta-label {
            font-weight: bold;
            color: #555;
          }
          .summary-section {
            margin: 30px 0;
          }
          h2 {
            color: #4a90e2;
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin: 20px 0;
          }
          .summary-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            border-left: 4px solid #4a90e2;
          }
          .summary-card h3 {
            margin: 0;
            font-size: 14px;
            color: #666;
            font-weight: normal;
          }
          .summary-card .value {
            font-size: 32px;
            font-weight: bold;
            color: #2c3e50;
            margin: 10px 0;
          }
          .summary-card .percentage {
            font-size: 14px;
            color: #4a90e2;
          }
          .note {
            color: #666;
            font-size: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th {
            background: #4a90e2;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
          }
          td {
            padding: 12px;
            border-bottom: 1px solid #e0e0e0;
          }
          tr:nth-child(even) {
            background: #f8f9fa;
          }
          .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 2px solid #e0e0e0;
            text-align: center;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Hospital Bed Management Report</h1>
          <p style="color: #666; margin-top: 10px;">Bed Occupancy Analysis</p>
        </div>

        <div class="meta-info">
          <div><span class="meta-label">Report Type:</span> ${escapeHtml(reportTypeLabel)}</div>
          <div><span class="meta-label">Date Range:</span> ${escapeHtml(data.dateRangeLabel)} (${escapeHtml(new Date(data.startDate).toLocaleString())} - ${escapeHtml(new Date(data.endDate).toLocaleString())})</div>
          <div><span class="meta-label">Generated:</span> ${escapeHtml(new Date(data.generatedDate).toLocaleString())}</div>
          <div><span class="meta-label">Wards:</span> ${data.selectedWards.map(escapeHtml).join(', ')}</div>
        </div>

        <div class="summary-section">
          <h2>Current Bed Status</h2>
          <div class="summary-grid">
            <div class="summary-card">
              <h3>Total Beds</h3>
              <div class="value">${data.summary.totalBeds}</div>
            </div>
            <div class="summary-card">
              <h3>Occupied</h3>
              <div class="value">${data.summary.occupiedBeds}</div>
              <div class="percentage">${data.summary.occupancyRate}%</div>
            </div>
            <div class="summary-card">
              <h3>Available</h3>
              <div class="value">${data.summary.availableBeds}</div>
            </div>
            <div class="summary-card">
              <h3>Cleaning</h3>
              <div class="value">${data.summary.cleaningBeds}</div>
            </div>
          </div>
        </div>

        ${this.generateReportTypeSpecificHTML(data)}

        <div class="summary-section">
          <h2>Ward-wise Breakdown</h2>
          <table>
            <thead>
              <tr>
                <th>Ward</th>
                <th>Total Beds</th>
                <th>Occupied</th>
                <th>Available</th>
                <th>Cleaning</th>
                <th>Occupancy Rate</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(data.wardStats).map(([ward, stats]) => {
                const wardOccupancy = stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0;
                return `
                  <tr>
                    <td><strong>${escapeHtml(ward)}</strong></td>
                    <td>${stats.total}</td>
                    <td>${stats.occupied}</td>
                    <td>${stats.available}</td>
                    <td>${stats.cleaning || 0}</td>
                    <td><strong>${wardOccupancy}%</strong></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div class="footer">
          <p>Generated by Hospital Bed Management System</p>
          <p>Report ID: ${Date.now()} | Generated on ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `;
  }

  generateReportTypeSpecificHTML(data) {
    // Metrics without recorded data are shown as "No data" instead of an estimate
    const show = (value, suffix = '') => (value === null || value === undefined ? 'No data' : `${escapeHtml(value)}${suffix}`);
    let html = '';

    if (data.occupancy) {
      const occupancy = data.occupancy;
      html += `
        <div class="summary-section">
          <h2>Occupancy Over the Period</h2>
          <div class="summary-grid">
            <div class="summary-card">
              <h3>Average Occupancy</h3>
              <div class="value">${show(occupancy.averageOccupancy, '%')}</div>
            </div>
            <div class="summary-card">
              <h3>Peak Occupancy</h3>
              <div class="value">${show(occupancy.peakOccupancy, '%')}</div>
            </div>
            <div class="summary-card">
              <h3>Lowest Occupancy</h3>
              <div class="value">${show(occupancy.lowOccupancy, '%')}</div>
            </div>
            <div class="summary-card">
              <h3>Available Now</h3>
              <div class="value">${show(occupancy.availabilityRate, '%')}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Beds Currently Being Cleaned</td>
                <td>${show(occupancy.cleaningRate, '%')}</td>
              </tr>
            </tbody>
          </table>
          <p class="note">Occupancy is reconstructed from recorded bed assignments and releases.</p>
        </div>
      `;
    }

    if (data.performance) {
      const performance = data.performance;
      html += `
        <div class="summary-section">
          <h2>Admissions &amp; Discharges</h2>
          <div class="summary-grid">
            <div class="summary-card">
              <h3>Admissions</h3>
              <div class="value">${performance.admissions}</div>
            </div>
            <div class="summary-card">
              <h3>Discharges</h3>
              <div class="value">${performance.discharges}</div>
            </div>
            <div class="summary-card">
              <h3>Avg Length of Stay</h3>
              <div class="value">${show(performance.avgLengthOfStayDays)}</div>
              <div class="percentage">days</div>
            </div>
            <div class="summary-card">
              <h3>Bed Turnover</h3>
              <div class="value">${show(performance.bedTurnoverRate)}</div>
              <div class="percentage">discharges per 100 beds</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Admissions per Day</td>
                <td>${show(performance.dailyAdmissions)}</td>
              </tr>
              <tr>
                <td>Discharges per Day</td>
                <td>${show(performance.dailyDischarges)}</td>
              </tr>
              <tr>
                <td>Average Time from Discharge to Next Admission</td>
                <td>${show(performance.avgTurnaroundHours, ' hours')}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="summary-section">
          <h2>Cleaning</h2>
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Completed Cleanings</td>
                <td>${performance.completedCleanings}</td>
              </tr>
              <tr>
                <td>Average Cleaning Time</td>
                <td>${show(performance.avgCleaningMinutes, ' minutes')}</td>
              </tr>
              <tr>
                <td>Finished Within Estimate</td>
                <td>${show(performance.cleaningOnTimeRate, '%')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    return html;
  }

  getReportTypeLabel(type) {
    const labels = {
      'comprehensive': 'Comprehensive Report',
      'occupancy': 'Occupancy Report',
      'performance': 'Performance Report'
    };
    return labels[type] || 'Report';
  }

  async generateCSV(reportData) {
    // Prepare data for CSV
    const csvData = [];

    // Add ward statistics
    Object.entries(reportData.wardStats).forEach(([ward, stats]) => {
      const wardOccupancy = stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0;
      csvData.push({
        Ward: ward,
        'Total Beds': stats.total,
        'Occupied Beds': stats.occupied,
        'Available Beds': stats.available,
        'Cleaning Beds': stats.cleaning || 0,
        'Occupancy Rate (%)': wardOccupancy
      });
    });

    const parser = new Parser({
      fields: ['Ward', 'Total Beds', 'Occupied Beds', 'Available Beds', 'Cleaning Beds', 'Occupancy Rate (%)']
    });

    const csv = parser.parse(csvData);

    // Save CSV to file
    const fileName = `report_${Date.now()}.csv`;
    const filePath = path.join(this.reportsDir, fileName);
    await fs.writeFile(filePath, csv);

    return {
      csv,
      fileName,
      filePath
    };
  }

  async getReportHistory(limit = 20) {
    try {
      const files = await fs.readdir(this.reportsDir);
      const reportFiles = files.filter(file => file.startsWith('report_'));

      const reports = await Promise.all(
        reportFiles.map(async (file) => {
          const filePath = path.join(this.reportsDir, file);
          const stats = await fs.stat(filePath);
          const ext = path.extname(file);

          return {
            fileName: file,
            filePath,
            size: stats.size,
            createdAt: stats.birthtime,
            type: ext === '.pdf' ? 'PDF' : 'CSV'
          };
        })
      );

      // Sort by creation date (newest first)
      reports.sort((a, b) => b.createdAt - a.createdAt);

      return reports.slice(0, limit);
    } catch (error) {
      console.error('Error reading report history:', error);
      return [];
    }
  }

  async deleteReport(fileName) {
    const filePath = this.resolveReportPath(fileName);
    if (!filePath) {
      return false;
    }
    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.error('Error deleting report:', error);
      return false;
    }
  }

  async getReport(fileName) {
    const filePath = this.resolveReportPath(fileName);
    if (!filePath) {
      return null;
    }
    try {
      const buffer = await fs.readFile(filePath);
      return buffer;
    } catch (error) {
      console.error('Error reading report:', error);
      return null;
    }
  }
}

module.exports = new ReportService();
module.exports.REPORT_TYPES = REPORT_TYPES;
module.exports.DATE_RANGES = DATE_RANGES;
