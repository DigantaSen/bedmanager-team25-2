# Report Generation System Documentation

## Overview
This implementation provides a comprehensive report generation system with PDF/CSV export, email delivery, scheduled reports, and report archiving capabilities.

## Features Implemented

### 1. PDF/CSV Report Generation (using Puppeteer)
- **Location**: `backend/services/reportService.js`
- **Functionality**:
  - Generates professional PDF reports with formatted HTML
  - Exports data to CSV format
  - Includes executive summary, ward-wise breakdown, and occupancy metrics
  - Saves reports to disk for archiving

### 2. Scheduled Report Generation (Cron Jobs)
- **Location**: `backend/services/scheduledReportService.js`
- **Functionality**:
  - Three predefined schedules:
    - Daily report at 8 AM
    - Weekly report every Monday at 9 AM
    - Monthly report on 1st of every month at 10 AM
  - Can be enabled/disabled via API
  - Supports manual execution
  - Automatically emails reports to configured recipients

### 3. Email Delivery System
- **Location**: `backend/services/emailService.js`
- **Functionality**:
  - Uses Nodemailer with SMTP
  - Sends reports as email attachments
  - Supports both PDF and CSV formats
  - Formatted HTML email body with report details
  - Can send to multiple recipients

### 4. Report Archive/History
- **Location**: `backend/services/reportService.js`
- **Functionality**:
  - Stores all generated reports in `backend/reports/` directory
  - Tracks report metadata (filename, size, creation date, type)
  - Provides API to list, download, and delete archived reports
  - Automatically limits history to 20 most recent reports

### 5. Frontend Report Download UI
- **Location**: `frontend/src/pages/ReportsPage.jsx`
- **Functionality**:
  - Report generation form with type, date range, and format selection
  - Direct download button for PDF/CSV
  - Email report functionality with recipient input
  - Report history list with download and delete options
  - Scheduled reports management (view, enable/disable, run now)
  - Real-time feedback with success/error messages

## API Endpoints

### Report Generation
- `POST /api/reports/generate/pdf` - Generate and download PDF report
- `POST /api/reports/generate/csv` - Generate and download CSV report
- `POST /api/reports/email` - Generate and email report

### Report History
- `GET /api/reports/history` - Get list of archived reports
- `GET /api/reports/download/:fileName` - Download specific report
- `DELETE /api/reports/:fileName` - Delete report from archive

### Scheduled Reports
- `GET /api/reports/schedules` - Get all scheduled reports
- `PUT /api/reports/schedules/:scheduleId` - Update schedule configuration
- `POST /api/reports/schedules/:scheduleId/run` - Execute schedule immediately

## Configuration

### Environment Variables (.env)
```env
# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
```

### For Gmail:
1. Enable 2-Factor Authentication
2. Generate App Password at: https://myaccount.google.com/apppasswords
3. Use the App Password in `SMTP_PASS`

## Installation

### Backend Dependencies
```bash
npm install puppeteer node-cron nodemailer json2csv
```

### File Structure
```
backend/
├── services/
│   ├── reportService.js          # PDF/CSV generation
│   ├── emailService.js            # Email delivery
│   └── scheduledReportService.js # Cron job management
├── controllers/
│   └── reportController.js        # API endpoints
├── routes/
│   └── reportRoutes.js            # Route definitions
└── reports/                       # Report archive directory (auto-created)

frontend/
└── src/
    └── pages/
        └── ReportsPage.jsx        # Report management UI
```

## Usage

### Generate Report Manually
```javascript
// Frontend
const response = await api.post('/reports/generate/pdf', {
  reportType: 'comprehensive',
  dateRange: 'last7days',
  wards: []
}, { responseType: 'blob' });
```

### Email Report
```javascript
await api.post('/reports/email', {
  reportType: 'occupancy',
  dateRange: 'last30days',
  wards: [],
  email: 'recipient@example.com',
  format: 'pdf'
});
```

### Configure Scheduled Report
```javascript
await api.put('/reports/schedules/daily-report', {
  enabled: true,
  config: {
    reportType: 'comprehensive',
    dateRange: 'yesterday',
    recipients: ['admin@hospital.com']
  }
});
```

## Report Types
- **Comprehensive**: Full analysis of all metrics
- **Occupancy**: Bed occupancy and utilization
- **Financial**: Revenue and cost analysis
- **Performance**: KPI and efficiency metrics

## Date Ranges
- Today
- Yesterday
- Last 7 Days
- Last 30 Days
- Last 90 Days
- This Month
- Last Month

## Cron Schedule Format
```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-6, Sunday=0)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

Examples:
- `0 8 * * *` - Daily at 8:00 AM
- `0 9 * * 1` - Every Monday at 9:00 AM
- `0 10 1 * *` - First day of every month at 10:00 AM

## Notes
- Reports are automatically archived in the `backend/reports/` directory
- Puppeteer requires Chrome/Chromium to be installed
- Email service requires valid SMTP credentials
- All endpoints require authentication (JWT token)
- Report history is limited to 20 most recent reports in API response
- Files are saved with timestamp in filename for uniqueness

## Security Considerations
- All endpoints protected with JWT authentication
- Email credentials stored in environment variables
- Report files stored outside public directory
- File deletion validates filename to prevent directory traversal
