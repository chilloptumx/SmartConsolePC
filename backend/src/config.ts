import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  
  // Database
  databaseUrl: process.env.DATABASE_URL!,
  
  // Redis
  redisUrl: process.env.REDIS_URL!,
  
  // SMTP
  smtp: {
    host: process.env.SMTP_HOST!,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER!,
    password: process.env.SMTP_PASSWORD!,
    from: process.env.SMTP_FROM!,
  },
  
  // Windows credentials
  windows: {
    adminUser: process.env.WINDOWS_ADMIN_USER!,
    adminPassword: process.env.WINDOWS_ADMIN_PASSWORD!,
    connectionTimeout: parseInt(process.env.WINDOWS_CONNECTION_TIMEOUT || '30000', 10),
    maxRetries: parseInt(process.env.WINDOWS_MAX_RETRIES || '3', 10),
  },
};

// Validate required env vars
const requiredEnvVars = [
  'DATABASE_URL',
  'REDIS_URL',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

