import { prisma } from "@/src/lib/prisma";
import { ApiError } from "@/src/server/api/errors";
import { MembershipStatus } from "@/src/generated/prisma/enums";

export async function requireBusinessPermission(userId: string, businessId: string, permissionKey: string) {
  const membership = await prisma.businessMembership.findFirst({
    where: {
      businessId,
      userId,
      status: MembershipStatus.ACTIVE,
    },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  if (!membership) {
    throw new ApiError(403, "FORBIDDEN", "User is not an active member of the business");
  }

  const hasPermission = membership.role.permissions.some((rp) => rp.permission.key === permissionKey);
  if (!hasPermission) {
    throw new ApiError(403, "FORBIDDEN", `Missing required permission: ${permissionKey}`);
  }

  return membership;
}

export async function requireGlobalPermission(userId: string, permissionKey: string) {
  const membership = await prisma.businessMembership.findFirst({
    where: {
      userId,
      status: MembershipStatus.ACTIVE,
      role: {
        permissions: {
          some: {
            permission: {
              key: permissionKey,
            },
          },
        },
      },
    },
    include: {
      role: true,
    },
  });

  if (!membership) {
    throw new ApiError(403, "FORBIDDEN", `Missing required permission: ${permissionKey}`);
  }

  return membership;
}
