import { prisma } from "@/src/lib/prisma";
import { AuditAction, AuditActorType, Prisma } from "@/src/generated/prisma/client";

type AuditInput = {
  businessId?: string | null;
  actorId?: string | null;
  actorType?: AuditActorType;
  action: AuditAction;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function createAuditLog(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      businessId: input.businessId ?? null,
      actorId: input.actorId ?? null,
      actorType: input.actorType ?? AuditActorType.USER,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata,
    },
  });
}
