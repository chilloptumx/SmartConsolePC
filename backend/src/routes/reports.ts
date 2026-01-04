import { Router } from 'express';
import { prisma } from '../services/database.js';
import { sendScheduledReport } from '../services/email-service.js';
import { logger } from '../services/logger.js';
import { logAuditEvent } from '../services/audit.js';

const router = Router();

// Get all email reports
router.get('/', async (req, res) => {
  const reports = await prisma.emailReport.findMany({
    orderBy: { name: 'asc' },
  });
  res.json(reports);
});

// Get single report
router.get('/:id', async (req, res) => {
  const report = await prisma.emailReport.findUnique({
    where: { id: req.params.id },
  });

  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }

  res.json(report);
});

// Create email report
router.post('/', async (req, res) => {
  const { name, recipients, schedule, filterConfig, columns } = req.body;

  if (!name || !recipients || !schedule || !columns) {
    return res.status(400).json({ error: 'Name, recipients, schedule, and columns required' });
  }

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'At least one recipient required' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const email of recipients) {
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: `Invalid email format: ${email}` });
    }
  }

  const report = await prisma.emailReport.create({
    data: {
      name,
      recipients,
      schedule,
      filterConfig: filterConfig || {},
      columns,
    },
  });

  logger.info(`Created email report: ${name}`);
  await logAuditEvent({
    eventType: 'EMAIL_REPORT_CREATED',
    message: `Email report created: ${name}`,
    entityType: 'EmailReport',
    entityId: report.id,
    metadata: { id: report.id, name, recipients, schedule, columns, isActive: report.isActive },
  });
  res.status(201).json(report);
});

// Update email report
router.put('/:id', async (req, res) => {
  const { name, recipients, schedule, filterConfig, columns, isActive } = req.body;

  const updateData: any = {};

  if (name) updateData.name = name;
  if (recipients) updateData.recipients = recipients;
  if (schedule) updateData.schedule = schedule;
  if (filterConfig) updateData.filterConfig = filterConfig;
  if (columns) updateData.columns = columns;
  if (isActive !== undefined) updateData.isActive = isActive;

  const report = await prisma.emailReport.update({
    where: { id: req.params.id },
    data: updateData,
  });

  await logAuditEvent({
    eventType: 'EMAIL_REPORT_UPDATED',
    message: `Email report updated: ${report.name}`,
    entityType: 'EmailReport',
    entityId: report.id,
    metadata: { id: report.id, update: updateData },
  });
  res.json(report);
});

// Delete email report
router.delete('/:id', async (req, res) => {
  const existing = await prisma.emailReport.findUnique({ where: { id: req.params.id } });
  await prisma.emailReport.delete({
    where: { id: req.params.id },
  });

  logger.info(`Deleted email report: ${req.params.id}`);
  await logAuditEvent({
    eventType: 'EMAIL_REPORT_DELETED',
    message: `Email report deleted: ${existing?.name ?? req.params.id}`,
    entityType: 'EmailReport',
    entityId: req.params.id,
    metadata: { id: req.params.id, name: existing?.name },
  });
  res.json({ success: true });
});

// Send report now
router.post('/:id/send-now', async (req, res) => {
  const report = await prisma.emailReport.findUnique({
    where: { id: req.params.id },
  });

  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }

  const success = await sendScheduledReport(req.params.id);

  if (success) {
    logger.info(`Sent email report: ${report.name}`);
    await logAuditEvent({
      eventType: 'EMAIL_REPORT_SENT',
      message: `Email report sent: ${report.name}`,
      entityType: 'EmailReport',
      entityId: report.id,
      metadata: { id: report.id, name: report.name, recipients: report.recipients },
    });
    res.json({ success: true, message: 'Report sent successfully' });
  } else {
    await logAuditEvent({
      eventType: 'EMAIL_REPORT_SEND_FAILED',
      level: 'ERROR',
      message: `Email report send failed: ${report.name}`,
      entityType: 'EmailReport',
      entityId: report.id,
      metadata: { id: report.id, name: report.name, recipients: report.recipients },
    });
    res.status(500).json({ success: false, error: 'Failed to send report' });
  }
});

export default router;

