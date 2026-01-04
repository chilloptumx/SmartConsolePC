import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { logger } from './logger.js';
import { prisma } from './database.js';
import { logAuditEvent } from './audit.js';

// Create SMTP transporter
const createTransporter = () => {
  if (!config.smtp.host || !config.smtp.user) {
    logger.warn('SMTP not configured, email sending disabled');
    return null;
  }

  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.password,
    },
  });
};

export interface EmailOptions {
  to: string[];
  subject: string;
  html: string;
}

/**
 * Send email
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const transporter = createTransporter();
  
  if (!transporter) {
    logger.warn('Cannot send email - SMTP not configured');
    return false;
  }

  try {
    await transporter.sendMail({
      from: config.smtp.from,
      to: options.to.join(', '),
      subject: options.subject,
      html: options.html,
    });

    logger.info(`Email sent to ${options.to.join(', ')}`);
    return true;
  } catch (error: any) {
    logger.error('Failed to send email:', error);
    return false;
  }
}

/**
 * Generate HTML table from check results
 */
function generateResultsTable(results: any[], columns: string[]): string {
  if (results.length === 0) {
    return '<p>No results to display.</p>';
  }

  let html = '<table style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif;">';
  
  // Header
  html += '<thead><tr style="background-color: #1e293b; color: white;">';
  for (const col of columns) {
    html += `<th style="padding: 12px; text-align: left; border: 1px solid #cbd5e1;">${col}</th>`;
  }
  html += '</tr></thead>';

  // Body
  html += '<tbody>';
  for (const result of results) {
    html += '<tr style="background-color: #f8fafc;">';
    for (const col of columns) {
      const value = result[col] || '-';
      const displayValue = typeof value === 'object' ? JSON.stringify(value) : value;
      html += `<td style="padding: 12px; border: 1px solid #cbd5e1;">${displayValue}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';

  return html;
}

/**
 * Send scheduled email report
 */
export async function sendScheduledReport(reportId: string): Promise<boolean> {
  try {
    const report = await prisma.emailReport.findUnique({
      where: { id: reportId },
    });

    if (!report || !report.isActive) {
      logger.warn(`Report ${reportId} not found or inactive`);
      return false;
    }

    // Build query based on filter config
    const filters = report.filterConfig as any;
    const whereClause: any = {};

    if (filters.machineIds && filters.machineIds.length > 0) {
      whereClause.machineId = { in: filters.machineIds };
    }

    if (filters.checkTypes && filters.checkTypes.length > 0) {
      whereClause.checkType = { in: filters.checkTypes };
    }

    if (filters.status && filters.status.length > 0) {
      whereClause.status = { in: filters.status };
    }

    if (filters.dateFrom) {
      whereClause.createdAt = { gte: new Date(filters.dateFrom) };
    }

    if (filters.dateTo) {
      whereClause.createdAt = { ...whereClause.createdAt, lte: new Date(filters.dateTo) };
    }

    // Fetch results
    const results = await prisma.checkResult.findMany({
      where: whereClause,
      include: {
        machine: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1000, // Limit to prevent huge emails
    });

    // Format results for email
    const formattedResults = results.map((r) => ({
      Machine: r.machine.hostname,
      'Check Type': r.checkType,
      'Check Name': r.checkName,
      Status: r.status,
      Timestamp: new Date(r.createdAt).toLocaleString(),
      Duration: `${r.duration}ms`,
      Message: r.message || '-',
    }));

    // Generate email HTML
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background-color: #1e293b; color: white; padding: 20px; }
          .content { padding: 20px; }
          .summary { background-color: #f1f5f9; padding: 15px; margin: 20px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Windows PC Health Monitor Report</h1>
          <p>${report.name}</p>
        </div>
        <div class="content">
          <div class="summary">
            <h2>Summary</h2>
            <p><strong>Total Results:</strong> ${results.length}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <h2>Check Results</h2>
          ${generateResultsTable(formattedResults, report.columns)}
        </div>
      </body>
      </html>
    `;

    // Send email
    const success = await sendEmail({
      to: report.recipients,
      subject: `Health Monitor Report: ${report.name}`,
      html,
    });

    if (success) {
      // Update last sent timestamp
      await prisma.emailReport.update({
        where: { id: reportId },
        data: { lastSentAt: new Date() },
      });

      await logAuditEvent({
        eventType: 'EMAIL_SENT',
        message: `Email sent: ${report.name}`,
        entityType: 'EmailReport',
        entityId: report.id,
        metadata: { reportId: report.id, name: report.name, recipients: report.recipients },
      });
    } else {
      await logAuditEvent({
        eventType: 'EMAIL_SEND_FAILED',
        level: 'ERROR',
        message: `Email send failed: ${report.name}`,
        entityType: 'EmailReport',
        entityId: report.id,
        metadata: { reportId: report.id, name: report.name, recipients: report.recipients },
      });
    }

    return success;
  } catch (error: any) {
    logger.error(`Failed to send report ${reportId}:`, error);
    await logAuditEvent({
      eventType: 'EMAIL_SEND_ERROR',
      level: 'ERROR',
      message: `Email send error: ${reportId}`,
      entityType: 'EmailReport',
      entityId: reportId,
      metadata: { error: error?.message ?? String(error) },
    });
    return false;
  }
}

