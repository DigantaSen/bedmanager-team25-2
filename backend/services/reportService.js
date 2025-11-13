const puppeteer = require('puppeteer');
const { Parser } = require('json2csv');
const fs = require('fs').promises;
const path = require('path');
const Bed = require('../models/Bed');
const OccupancyLog = require('../models/OccupancyLog');

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

  async generateReportData(options = {}) {
    const { reportType = 'comprehensive', dateRange = 'last7days', wards = [] } = options;

    // Fetch bed data
    let query = {};
    if (wards && wards.length > 0 && !wards.includes('All Wards')) {
      query.ward = { $in: wards };
    }

    const beds = await Bed.find(query);
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

    // Calculate date range
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
      case 'last7days':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'last30days':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'last90days':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    // Fetch occupancy logs for the period
    const occupancyLogs = await OccupancyLog.find({
      timestamp: { $gte: startDate, $lte: endDate }
    }).sort({ timestamp: -1 }).limit(100);

    return {
      reportType,
      dateRange,
      generatedDate: new Date().toISOString(),
      summary: {
        totalBeds,
        occupiedBeds,
        availableBeds,
        cleaningBeds,
        occupancyRate
      },
      wardStats,
      selectedWards: wards.length > 0 ? wards : ['All Wards'],
      occupancyLogs: occupancyLogs.slice(0, 10), // Include recent logs
      dateRangeLabel: this.getDateRangeLabel(dateRange),
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
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
    return labels[dateRange] || 'Custom Range';
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
      
      console.log('📄 Generating HTML report...');
      const html = this.generateHTMLReport(reportData);
      
      console.log('📝 Setting page content...');
      await page.setContent(html, { waitUntil: 'networkidle0' });

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
          <p style="color: #666; margin-top: 10px;">Comprehensive Bed Occupancy Analysis</p>
        </div>

        <div class="meta-info">
          <div><span class="meta-label">Report Type:</span> ${reportTypeLabel}</div>
          <div><span class="meta-label">Date Range:</span> ${data.dateRangeLabel}</div>
          <div><span class="meta-label">Generated:</span> ${new Date(data.generatedDate).toLocaleString()}</div>
          <div><span class="meta-label">Wards:</span> ${data.selectedWards.join(', ')}</div>
        </div>

        <div class="summary-section">
          <h2>Executive Summary</h2>
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
                    <td><strong>${ward}</strong></td>
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

  getReportTypeLabel(type) {
    const labels = {
      'comprehensive': 'Comprehensive Report',
      'occupancy': 'Occupancy Report',
      'financial': 'Financial Report',
      'performance': 'Performance Report',
      'custom': 'Custom Report'
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
    try {
      const filePath = path.join(this.reportsDir, fileName);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.error('Error deleting report:', error);
      return false;
    }
  }

  async getReport(fileName) {
    try {
      const filePath = path.join(this.reportsDir, fileName);
      const buffer = await fs.readFile(filePath);
      return buffer;
    } catch (error) {
      console.error('Error reading report:', error);
      return null;
    }
  }
}

module.exports = new ReportService();
