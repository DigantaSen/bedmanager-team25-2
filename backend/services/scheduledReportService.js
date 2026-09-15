const cron = require('node-cron');
const reportService = require('./reportService');
const emailService = require('./emailService');
const { splitAddresses } = require('./reportRecipients');
const { WARDS } = require('../config/roles');

const { REPORT_TYPES, DATE_RANGES } = reportService;
const FORMATS = ['pdf', 'csv'];

// Only these fields may be changed through the API; id, name and anything else in a
// request body is ignored so a schedule cannot be renamed or replaced wholesale
const SCHEDULE_FIELDS = ['enabled', 'schedule', 'config'];
const CONFIG_FIELDS = ['reportType', 'dateRange', 'wards', 'format', 'recipients'];

class ScheduledReportService {
  constructor() {
    this.jobs = new Map();
    this.schedules = [
      // Daily report at 8 AM
      {
        id: 'daily-report',
        schedule: '0 8 * * *',
        name: 'Daily Comprehensive Report',
        enabled: true,
        config: {
          reportType: 'comprehensive',
          dateRange: 'yesterday',
          wards: [],
          format: 'pdf',
          recipients: []
        }
      },
      // Weekly report every Monday at 9 AM
      {
        id: 'weekly-report',
        schedule: '0 9 * * 1',
        name: 'Weekly Performance Report',
        enabled: false,
        config: {
          reportType: 'performance',
          dateRange: 'last7days',
          wards: [],
          format: 'pdf',
          recipients: []
        }
      },
      // Monthly report on 1st of every month at 10 AM
      {
        id: 'monthly-report',
        schedule: '0 10 1 * *',
        name: 'Monthly Occupancy Report',
        enabled: false,
        config: {
          reportType: 'occupancy',
          dateRange: 'lastMonth',
          wards: [],
          format: 'pdf',
          recipients: []
        }
      }
    ];
  }

  async initialize() {
    console.log('🕐 Initializing scheduled report service...');
    
    // Start enabled schedules
    this.schedules.forEach(schedule => {
      if (schedule.enabled) {
        this.startSchedule(schedule);
      }
    });

    console.log(`✅ Scheduled report service initialized with ${this.jobs.size} active jobs`);
  }

  startSchedule(schedule) {
    if (this.jobs.has(schedule.id)) {
      console.log(`⚠️  Schedule ${schedule.id} already running`);
      return;
    }

    const job = cron.schedule(schedule.schedule, async () => {
      console.log(`📊 Running scheduled report: ${schedule.name}`);
      await this.executeScheduledReport(schedule);
    });

    this.jobs.set(schedule.id, job);
    console.log(`✅ Started schedule: ${schedule.name} (${schedule.schedule})`);
  }

  stopSchedule(scheduleId) {
    const job = this.jobs.get(scheduleId);
    if (job) {
      job.stop();
      this.jobs.delete(scheduleId);
      console.log(`🛑 Stopped schedule: ${scheduleId}`);
      return true;
    }
    return false;
  }

  async executeScheduledReport(schedule) {
    try {
      // Generate report data
      const reportData = await reportService.generateReportData(schedule.config);

      let reportBuffer, fileName;

      // Generate report in specified format
      if (schedule.config.format === 'pdf') {
        const pdfResult = await reportService.generatePDF(reportData);
        reportBuffer = pdfResult.buffer;
        fileName = pdfResult.fileName;
      } else if (schedule.config.format === 'csv') {
        const csvResult = await reportService.generateCSV(reportData);
        reportBuffer = Buffer.from(csvResult.csv);
        fileName = csvResult.fileName;
      }

      // Addresses are re-checked at send time in case a schedule was configured before this check
      const { allowed, rejected } = splitAddresses(schedule.config.recipients || []);
      if (rejected.length > 0) {
        console.warn(`⚠️  Skipping ${rejected.length} malformed recipient(s) of ${schedule.name}`);
      }

      if (allowed.length > 0) {
        await emailService.sendScheduledReport(
          allowed,
          reportBuffer,
          fileName,
          schedule.name,
          schedule.config.format
        );
        console.log(`✅ Scheduled report sent to ${allowed.length} recipients`);
      } else {
        console.log(`ℹ️  Report generated but no recipients configured for ${schedule.name}`);
      }

      return {
        success: true,
        fileName,
        recipientCount: allowed.length,
        skippedRecipients: rejected.length
      };
    } catch (error) {
      console.error(`❌ Error executing scheduled report ${schedule.name}:`, error);
      return {
        success: false,
        status: 500,
        message: 'Error running scheduled report',
        error: error.message
      };
    }
  }

  getSchedules() {
    return this.schedules.map(schedule => ({
      ...schedule,
      isRunning: this.jobs.has(schedule.id)
    }));
  }

  /**
   * @desc    Check a request body against the fields a schedule actually has
   * @returns {Promise<{error: string}|{changes: object}>}
   */
  async validateUpdates(current, updates) {
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return { error: 'Invalid request body' };
    }

    const unknown = Object.keys(updates).filter((key) => !SCHEDULE_FIELDS.includes(key));
    if (unknown.length > 0) {
      return { error: `Unknown field(s): ${unknown.join(', ')}. Allowed: ${SCHEDULE_FIELDS.join(', ')}` };
    }

    const changes = {};

    if ('enabled' in updates) {
      if (typeof updates.enabled !== 'boolean') return { error: 'enabled must be true or false' };
      changes.enabled = updates.enabled;
    }

    if ('schedule' in updates) {
      if (typeof updates.schedule !== 'string' || !cron.validate(updates.schedule)) {
        return { error: 'schedule must be a valid cron expression' };
      }
      changes.schedule = updates.schedule;
    }

    if ('config' in updates) {
      const config = updates.config;
      if (!config || typeof config !== 'object' || Array.isArray(config)) {
        return { error: 'config must be an object' };
      }

      const unknownConfig = Object.keys(config).filter((key) => !CONFIG_FIELDS.includes(key));
      if (unknownConfig.length > 0) {
        return { error: `Unknown config field(s): ${unknownConfig.join(', ')}. Allowed: ${CONFIG_FIELDS.join(', ')}` };
      }

      const nextConfig = { ...current.config };

      if ('reportType' in config) {
        if (!REPORT_TYPES.includes(config.reportType)) {
          return { error: `Invalid reportType. Must be one of: ${REPORT_TYPES.join(', ')}` };
        }
        nextConfig.reportType = config.reportType;
      }

      if ('dateRange' in config) {
        if (!DATE_RANGES.includes(config.dateRange)) {
          return { error: `Invalid dateRange. Must be one of: ${DATE_RANGES.join(', ')}` };
        }
        nextConfig.dateRange = config.dateRange;
      }

      if ('format' in config) {
        if (!FORMATS.includes(config.format)) {
          return { error: 'Invalid format. Must be pdf or csv' };
        }
        nextConfig.format = config.format;
      }

      if ('wards' in config) {
        if (!Array.isArray(config.wards) || config.wards.some((ward) => !WARDS.includes(ward))) {
          return { error: `wards must be an array of: ${WARDS.join(', ')}` };
        }
        nextConfig.wards = [...config.wards];
      }

      if ('recipients' in config) {
        if (!Array.isArray(config.recipients)) {
          return { error: 'recipients must be an array of email addresses' };
        }
        // Any recipient is allowed, but each entry must be a single well-formed address
        const { allowed, rejected } = splitAddresses(config.recipients);
        if (rejected.length > 0) {
          return { error: `Invalid email address(es): ${rejected.join(', ')}` };
        }
        nextConfig.recipients = allowed;
      }

      changes.config = nextConfig;
    }

    return { changes };
  }

  async updateSchedule(scheduleId, updates) {
    const scheduleIndex = this.schedules.findIndex(s => s.id === scheduleId);
    if (scheduleIndex === -1) {
      return { success: false, status: 404, message: 'Schedule not found' };
    }

    const { error, changes } = await this.validateUpdates(this.schedules[scheduleIndex], updates);
    if (error) {
      return { success: false, status: 400, message: error };
    }

    // Stop existing job if running
    this.stopSchedule(scheduleId);

    // Update schedule
    this.schedules[scheduleIndex] = {
      ...this.schedules[scheduleIndex],
      ...changes
    };

    // Restart if enabled
    if (this.schedules[scheduleIndex].enabled) {
      this.startSchedule(this.schedules[scheduleIndex]);
    }

    return {
      success: true,
      schedule: this.schedules[scheduleIndex]
    };
  }

  async runScheduleNow(scheduleId) {
    const schedule = this.schedules.find(s => s.id === scheduleId);
    if (!schedule) {
      return { success: false, status: 404, message: 'Schedule not found' };
    }

    console.log(`▶️  Manually running schedule: ${schedule.name}`);
    return await this.executeScheduledReport(schedule);
  }

  shutdown() {
    console.log('🛑 Shutting down scheduled report service...');
    this.jobs.forEach((job, scheduleId) => {
      job.stop();
      console.log(`  Stopped: ${scheduleId}`);
    });
    this.jobs.clear();
    console.log('✅ Scheduled report service shut down');
  }
}

module.exports = new ScheduledReportService();
