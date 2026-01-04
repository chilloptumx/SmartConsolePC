import { Router } from 'express';
import { prisma } from '../services/database.js';
import { logger } from '../services/logger.js';
import { normalizeRegistryPathForStorage, normalizeValueName } from '../services/registry-path.js';
import { logAuditEvent } from '../services/audit.js';

const router = Router();

// ========== REGISTRY CHECKS ==========

// Get all registry checks
router.get('/registry-checks', async (req, res) => {
  const checks = await prisma.registryCheck.findMany({
    orderBy: { name: 'asc' },
  });
  res.json(checks);
});

// Create registry check
router.post('/registry-checks', async (req, res) => {
  const { name, registryPath, valueName, expectedValue, description } = req.body;

  if (!name || !registryPath) {
    return res.status(400).json({ error: 'Name and registry path required' });
  }

  const normalizedRegistryPath = normalizeRegistryPathForStorage(registryPath);
  const normalizedValueName = normalizeValueName(valueName);

  const check = await prisma.registryCheck.create({
    data: {
      name,
      registryPath: normalizedRegistryPath,
      valueName: normalizedValueName,
      expectedValue,
      description,
    },
  });

  logger.info(`Created registry check: ${name}`);
  await logAuditEvent({
    eventType: 'REGISTRY_CHECK_CREATED',
    message: `Registry check created: ${name}`,
    entityType: 'RegistryCheck',
    entityId: check.id,
    metadata: { id: check.id, name, registryPath: normalizedRegistryPath, valueName: normalizedValueName, expectedValue, isActive: check.isActive },
  });
  res.status(201).json(check);
});

// Update registry check
router.put('/registry-checks/:id', async (req, res) => {
  const { name, registryPath, valueName, expectedValue, description, isActive } = req.body;

  const check = await prisma.registryCheck.update({
    where: { id: req.params.id },
    data: {
      ...(name && { name }),
      ...(registryPath && { registryPath: normalizeRegistryPathForStorage(registryPath) }),
      ...(valueName !== undefined && { valueName: normalizeValueName(valueName) }),
      ...(expectedValue !== undefined && { expectedValue }),
      ...(description !== undefined && { description }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  await logAuditEvent({
    eventType: 'REGISTRY_CHECK_UPDATED',
    message: `Registry check updated: ${check.name}`,
    entityType: 'RegistryCheck',
    entityId: check.id,
    metadata: { id: check.id, name, registryPath, valueName, expectedValue, description, isActive },
  });
  res.json(check);
});

// Delete registry check
router.delete('/registry-checks/:id', async (req, res) => {
  const existing = await prisma.registryCheck.findUnique({ where: { id: req.params.id } });
  await prisma.registryCheck.delete({
    where: { id: req.params.id },
  });

  logger.info(`Deleted registry check: ${req.params.id}`);
  await logAuditEvent({
    eventType: 'REGISTRY_CHECK_DELETED',
    message: `Registry check deleted: ${existing?.name ?? req.params.id}`,
    entityType: 'RegistryCheck',
    entityId: req.params.id,
    metadata: { id: req.params.id, name: existing?.name, registryPath: existing?.registryPath, valueName: existing?.valueName },
  });
  res.json({ success: true });
});

// ========== FILE CHECKS ==========

// Get all file checks
router.get('/file-checks', async (req, res) => {
  const checks = await prisma.fileCheck.findMany({
    orderBy: { name: 'asc' },
  });
  res.json(checks);
});

// Create file check
router.post('/file-checks', async (req, res) => {
  const { name, filePath, checkExists, checkSize, checkCreated, checkModified, description } = req.body;

  if (!name || !filePath) {
    return res.status(400).json({ error: 'Name and file path required' });
  }

  const check = await prisma.fileCheck.create({
    data: {
      name,
      filePath,
      checkExists: checkExists ?? true,
      checkSize: checkSize ?? false,
      checkCreated: checkCreated ?? false,
      checkModified: checkModified ?? false,
      description,
    },
  });

  logger.info(`Created file check: ${name}`);
  await logAuditEvent({
    eventType: 'FILE_CHECK_CREATED',
    message: `File check created: ${name}`,
    entityType: 'FileCheck',
    entityId: check.id,
    metadata: { id: check.id, name, filePath, isActive: check.isActive },
  });
  res.status(201).json(check);
});

// Update file check
router.put('/file-checks/:id', async (req, res) => {
  const { name, filePath, checkExists, checkSize, checkCreated, checkModified, description, isActive } = req.body;

  const check = await prisma.fileCheck.update({
    where: { id: req.params.id },
    data: {
      ...(name && { name }),
      ...(filePath && { filePath }),
      ...(checkExists !== undefined && { checkExists }),
      ...(checkSize !== undefined && { checkSize }),
      ...(checkCreated !== undefined && { checkCreated }),
      ...(checkModified !== undefined && { checkModified }),
      ...(description !== undefined && { description }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  await logAuditEvent({
    eventType: 'FILE_CHECK_UPDATED',
    message: `File check updated: ${check.name}`,
    entityType: 'FileCheck',
    entityId: check.id,
    metadata: { id: check.id, name, filePath, isActive },
  });
  res.json(check);
});

// Delete file check
router.delete('/file-checks/:id', async (req, res) => {
  const existing = await prisma.fileCheck.findUnique({ where: { id: req.params.id } });
  await prisma.fileCheck.delete({
    where: { id: req.params.id },
  });

  logger.info(`Deleted file check: ${req.params.id}`);
  await logAuditEvent({
    eventType: 'FILE_CHECK_DELETED',
    message: `File check deleted: ${existing?.name ?? req.params.id}`,
    entityType: 'FileCheck',
    entityId: req.params.id,
    metadata: { id: req.params.id, name: existing?.name, filePath: existing?.filePath },
  });
  res.json({ success: true });
});

// ========== APP SETTINGS ==========

// Get app settings
router.get('/settings', async (req, res) => {
  const settings = await prisma.appSettings.findMany();
  
  // Convert to key-value object
  const settingsObj = settings.reduce((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {} as Record<string, string>);

  res.json(settingsObj);
});

// Update app setting
router.put('/settings/:key', async (req, res) => {
  const { value } = req.body;

  if (!value) {
    return res.status(400).json({ error: 'Value required' });
  }

  const setting = await prisma.appSettings.upsert({
    where: { key: req.params.key },
    update: { value },
    create: { key: req.params.key, value },
  });

  await logAuditEvent({
    eventType: 'APP_SETTING_UPDATED',
    message: `Setting updated: ${req.params.key}`,
    entityType: 'AppSettings',
    entityId: req.params.key,
    metadata: { key: req.params.key, value },
  });
  res.json(setting);
});

export default router;

