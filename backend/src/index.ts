import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'express-async-errors';
import { config } from './config.js';
import { logger } from './services/logger.js';
import { prisma } from './services/database.js';
import { initJobScheduler } from './services/job-scheduler.js';
import { normalizeRegistryPathForStorage, normalizeValueName } from './services/registry-path.js';

// Import routes
import machineRoutes from './routes/machines.js';
import configRoutes from './routes/config.js';
import scheduleRoutes from './routes/schedules.js';
import dataRoutes from './routes/data.js';
import reportRoutes from './routes/reports.js';
import monitorRoutes from './routes/monitor.js';
import settingsRoutes from './routes/settings.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/machines', machineRoutes);
app.use('/api/config', configRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/monitor', monitorRoutes);
app.use('/api/settings', settingsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(config.nodeEnv === 'development' && { stack: err.stack })
  });
});

// Startup
const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected successfully');

    // Normalize registry check formats to a canonical regedit-style path so UI/exec are consistent.
    const registryChecks = await prisma.registryCheck.findMany();
    for (const rc of registryChecks) {
      const normalizedPath = normalizeRegistryPathForStorage(rc.registryPath);
      const normalizedValueName = normalizeValueName(rc.valueName);
      const needsUpdate = normalizedPath !== rc.registryPath || (normalizedValueName ?? null) !== rc.valueName;

      if (needsUpdate) {
        await prisma.registryCheck.update({
          where: { id: rc.id },
          data: {
            registryPath: normalizedPath,
            valueName: normalizedValueName,
          },
        });
      }
    }

    // Initialize job scheduler
    await initJobScheduler();
    logger.info('Job scheduler initialized');

    // Start server
    const port = config.port;
    app.listen(port, () => {
      logger.info(`Server running on port ${port} in ${config.nodeEnv} mode`);
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();

