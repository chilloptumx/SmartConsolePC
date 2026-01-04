import { prisma } from './database.js';
import { logger } from './logger.js';

export type AuditLevel = 'INFO' | 'WARN' | 'ERROR';

export type AuditEventInput = {
  eventType: string;
  message: string;
  level?: AuditLevel;
  machineId?: string;
  entityType?: string;
  entityId?: string;
  metadata?: any;
};

export async function logAuditEvent(input: AuditEventInput) {
  try {
    await prisma.auditEvent.create({
      data: {
        eventType: input.eventType,
        level: (input.level ?? 'INFO') as any,
        message: input.message,
        machineId: input.machineId ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        metadata: input.metadata ?? {},
      },
    });
  } catch (error: any) {
    // Never block core workflows due to logging failures.
    logger.warn({ error, input }, 'Failed to write audit event');
  }
}


