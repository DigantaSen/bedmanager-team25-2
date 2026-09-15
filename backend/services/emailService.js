const nodemailer = require('nodemailer');
const dns = require('dns');
const net = require('net');

// The file name reaches this template from the caller, so it is escaped rather than trusted
const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// How long a resolved SMTP address is reused before looking it up again
const ADDRESS_TTL_MS = 5 * 60 * 1000;

// Marks the transporters this service builds, so one swapped in from outside (a test, or a
// different provider) is left exactly as it was given
const MANAGED = Symbol('managedTransporter');

class EmailService {
  constructor() {
    this.address = null;
    this.addressExpires = 0;
    this.transporter = this.createTransporter();
  }

  get host() {
    return process.env.SMTP_HOST || 'smtp.gmail.com';
  }

  get port() {
    return Number(process.env.SMTP_PORT) || 587;
  }

  createTransporter(address) {
    const host = address || this.host;
    const transporter = nodemailer.createTransport({
      host,
      port: this.port,
      secure: this.port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      // When connecting by address, TLS still has to be told the real host name or the
      // certificate will not validate
      ...(address && address !== this.host ? { tls: { servername: this.host } } : {})
    });
    transporter[MANAGED] = true;
    return transporter;
  }

  /**
   * @desc    Resolve the mail host through the operating system resolver.
   * @note    nodemailer resolves host names with dns.Resolver, which sends DNS queries
   *          directly. On networks that only allow the system resolver those queries time
   *          out with ETIMEOUT - a code nodemailer treats as fatal rather than falling back
   *          to dns.lookup - and no mail can be sent. Resolving here first and handing over
   *          an address avoids that path entirely. Returns null if the lookup fails, in
   *          which case the host name is used and nodemailer resolves it as usual.
   */
  async resolveHost() {
    const host = this.host;
    if (net.isIP(host)) {
      return host;
    }

    if (this.address && Date.now() < this.addressExpires) {
      return this.address;
    }

    try {
      const { address } = await dns.promises.lookup(host);
      this.address = address;
      this.addressExpires = Date.now() + ADDRESS_TTL_MS;
      return address;
    } catch (error) {
      console.warn(`⚠️  Could not resolve ${host} (${error.code}); letting nodemailer resolve it`);
      return null;
    }
  }

  /**
   * @desc    The transporter to send with, rebuilt when the resolved address goes stale
   */
  async getTransporter() {
    // A transporter assigned from outside is used as-is
    if (this.transporter && !this.transporter[MANAGED]) {
      return this.transporter;
    }

    const address = await this.resolveHost();
    if (!this.transporter || address !== this.transporterAddress) {
      this.transporter = this.createTransporter(address);
      this.transporterAddress = address;
    }
    return this.transporter;
  }

  async sendReportEmail(to, subject, reportBuffer, fileName, format = 'pdf') {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject: subject || 'Hospital Bed Management Report',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4a90e2;">Hospital Bed Management Report</h2>
            <p>Please find the attached report generated from the Hospital Bed Management System.</p>

            <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Report Details</h3>
              <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
              <p><strong>Format:</strong> ${escapeHtml(String(format).toUpperCase())}</p>
              <p><strong>File:</strong> ${escapeHtml(fileName)}</p>
            </div>

            <p style="color: #666; font-size: 14px;">
              This is an automated email from the Hospital Bed Management System.
              Please do not reply to this email.
            </p>
          </div>
        `,
        attachments: [
          {
            filename: fileName,
            content: reportBuffer,
            contentType: format === 'pdf' ? 'application/pdf' : 'text/csv'
          }
        ]
      };

      const transporter = await this.getTransporter();
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId, info };
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  async sendScheduledReport(recipients, reportBuffer, fileName, reportType, format) {
    try {
      const subject = `Scheduled ${reportType} Report - ${new Date().toLocaleDateString()}`;

      const results = await Promise.all(
        recipients.map(recipient =>
          this.sendReportEmail(recipient, subject, reportBuffer, fileName, format)
        )
      );

      return {
        success: true,
        sent: results.length,
        recipients
      };
    } catch (error) {
      console.error('Error sending scheduled reports:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      const transporter = await this.getTransporter();
      await transporter.verify();
      return { success: true, message: 'Email service is ready' };
    } catch (error) {
      console.error('Email service error:', error);
      return { success: false, message: error.message };
    }
  }
}

module.exports = new EmailService();
