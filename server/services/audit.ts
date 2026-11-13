import type { Prisma, PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logging/logger";

type Db = PrismaClient | Prisma.TransactionClient;

export type AuditAction =
  | "asset.upload"
  | "asset.delete"
  | "analysis.create"
  | "report.questionnaire.create"
  | "account.export"
  | "account.delete";

/** Records a security-relevant event. Metadata must not contain health data or free text. */
export async function audit(
  db: Db,
  entry: {
    actorUserId: string | null;
    action: AuditAction;
    resourceType?: string;
    resourceId?: string;
    requestId?: string;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  try {
    await db.auditLog.create({ data: entry });
  } catch (error) {
    // Auditing must not break the user's request; the failure itself is logged.
    logger.error("audit.write_failed", { action: entry.action, error });
  }
}
