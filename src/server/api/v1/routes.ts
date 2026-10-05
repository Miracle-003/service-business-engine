import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

import { prisma } from "@/src/lib/prisma";
import { Prisma } from "@/src/generated/prisma/client";
import {
  AuditAction,
  AuditActorType,
  BookingSource,
  BookingStatus,
  BusinessStatus,
  BusinessTypeStatus,
  CustomerStatus,
  InvitationStatus,
  MembershipStatus,
  QuoteRequestStatus,
  QuoteStatus,
  ReviewStatus,
  ServiceStatus,
  StaffStatus,
  UserStatus,
} from "@/src/generated/prisma/enums";
import { createAuditLog } from "@/src/server/api/audit";
import { requireAuth, type AuthContext } from "@/src/server/api/auth";
import { assertValidBookingStatusTransition } from "@/src/server/api/bookings";
import { ApiError, isRecordNotFound, isUniqueConstraint } from "@/src/server/api/errors";
import { getPagination, toPageMeta } from "@/src/server/api/pagination";
import { requireBusinessPermission, requireGlobalPermission } from "@/src/server/api/permissions";
import { dispatchRoute, type RouteDefinition } from "@/src/server/api/router";
import { created, errorResponse, listed, noContent, ok } from "@/src/server/api/response";
import { parseJsonBody, parseSchema } from "@/src/server/api/validation";

const uuidSchema = z.uuid();
const dateStringSchema = z.string().datetime();
const timeStringSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const decimalStringSchema = z.string().regex(/^-?[0-9]+(\.[0-9]{1,2})?$/);

const businessCreateSchema = z
  .object({
    businessTypeId: uuidSchema,
    name: z.string().min(1),
    slug: z.string().min(1),
    description: z.string().nullable().optional(),
    email: z.string().email().nullable().optional(),
    phone: z.string().nullable().optional(),
    websiteUrl: z.string().url().nullable().optional(),
    logoUrl: z.string().url().nullable().optional(),
    status: z.nativeEnum(BusinessStatus).optional(),
  })
  .strict();

const businessUpdateSchema = businessCreateSchema.partial().strict();

const businessTypeCreateSchema = z
  .object({
    name: z.string().min(1),
    slug: z.string().min(1),
    description: z.string().optional().nullable(),
    status: z.nativeEnum(BusinessTypeStatus).optional(),
  })
  .strict();

const businessTypeUpdateSchema = businessTypeCreateSchema.partial().strict();

const businessSettingsUpsertSchema = z
  .object({
    currency: z.string().min(1).optional(),
    timezone: z.string().min(1).optional(),
    bookingEnabled: z.boolean().optional(),
    quoteEnabled: z.boolean().optional(),
  })
  .strict();

const locationCreateSchema = z
  .object({
    name: z.string().min(1),
    addressLine1: z.string().min(1),
    addressLine2: z.string().optional().nullable(),
    city: z.string().min(1),
    state: z.string().optional().nullable(),
    postalCode: z.string().optional().nullable(),
    country: z.string().min(1),
    latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(),
    phone: z.string().optional().nullable(),
    isPrimary: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

const locationUpdateSchema = locationCreateSchema.partial().strict();

const hoursCreateSchema = z
  .object({
    locationId: uuidSchema.optional().nullable(),
    dayOfWeek: z.number().int().min(0).max(6),
    opensAt: timeStringSchema.optional().nullable(),
    closesAt: timeStringSchema.optional().nullable(),
    isClosed: z.boolean().optional(),
  })
  .strict();

const hoursUpdateSchema = hoursCreateSchema.partial().strict();

const holidayCreateSchema = z
  .object({
    date: dateStringSchema,
    name: z.string().min(1),
    isClosed: z.boolean().optional(),
  })
  .strict();

const holidayUpdateSchema = holidayCreateSchema.partial().strict();

const membershipCreateSchema = z
  .object({
    userId: uuidSchema,
    roleId: uuidSchema,
    status: z.nativeEnum(MembershipStatus).optional(),
  })
  .strict();

const membershipUpdateSchema = z
  .object({
    roleId: uuidSchema.optional(),
    status: z.nativeEnum(MembershipStatus).optional(),
  })
  .strict();

const invitationCreateSchema = z
  .object({
    email: z.string().email(),
    roleId: uuidSchema,
    expiresAt: dateStringSchema,
  })
  .strict();

const serviceCategoryCreateSchema = z
  .object({
    name: z.string().min(1),
    slug: z.string().min(1),
    description: z.string().optional().nullable(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

const serviceCategoryUpdateSchema = serviceCategoryCreateSchema.partial().strict();

const serviceCreateSchema = z
  .object({
    categoryId: uuidSchema.optional().nullable(),
    name: z.string().min(1),
    slug: z.string().min(1),
    description: z.string().optional().nullable(),
    durationMinutes: z.number().int().positive(),
    price: decimalStringSchema,
    currency: z.string().min(1).optional(),
    status: z.nativeEnum(ServiceStatus).optional(),
    sortOrder: z.number().int().optional(),
  })
  .strict();

const serviceUpdateSchema = serviceCreateSchema.partial().strict();

const staffCreateSchema = z
  .object({
    userId: uuidSchema.optional().nullable(),
    firstName: z.string().min(1),
    lastName: z.string().optional().nullable(),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    title: z.string().optional().nullable(),
    bio: z.string().optional().nullable(),
    avatarUrl: z.string().url().optional().nullable(),
    status: z.nativeEnum(StaffStatus).optional(),
  })
  .strict();

const staffUpdateSchema = staffCreateSchema.partial().strict();

const staffAvailabilityCreateSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startsAt: timeStringSchema,
    endsAt: timeStringSchema,
    isActive: z.boolean().optional(),
  })
  .strict();

const staffAvailabilityUpdateSchema = staffAvailabilityCreateSchema.partial().strict();

const staffTimeOffCreateSchema = z
  .object({
    startsAt: dateStringSchema,
    endsAt: dateStringSchema,
    reason: z.string().optional().nullable(),
  })
  .strict();

const staffTimeOffUpdateSchema = staffTimeOffCreateSchema.partial().strict();

const customerCreateSchema = z
  .object({
    firstName: z.string().min(1),
    lastName: z.string().optional().nullable(),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    status: z.nativeEnum(CustomerStatus).optional(),
  })
  .strict();

const customerUpdateSchema = customerCreateSchema.partial().strict();

const customerAddressCreateSchema = z
  .object({
    label: z.string().optional().nullable(),
    addressLine1: z.string().min(1),
    addressLine2: z.string().optional().nullable(),
    city: z.string().min(1),
    state: z.string().optional().nullable(),
    postalCode: z.string().optional().nullable(),
    country: z.string().min(1),
    isPrimary: z.boolean().optional(),
  })
  .strict();

const customerAddressUpdateSchema = customerAddressCreateSchema.partial().strict();

const customerNoteCreateSchema = z
  .object({
    content: z.string().min(1),
  })
  .strict();

const customerPreferenceUpsertSchema = z
  .object({
    notes: z.string().optional().nullable(),
    preferredStaffId: uuidSchema.optional().nullable(),
    preferredContactMethod: z.string().optional().nullable(),
  })
  .strict();

const bookingItemCreateSchema = z
  .object({
    serviceId: uuidSchema,
    serviceName: z.string().min(1),
    durationMinutes: z.number().int().positive(),
    unitPrice: decimalStringSchema,
    quantity: z.number().int().positive(),
  })
  .strict();

const bookingCreateSchema = z
  .object({
    locationId: uuidSchema.optional().nullable(),
    customerId: uuidSchema,
    staffId: uuidSchema.optional().nullable(),
    startsAt: dateStringSchema,
    endsAt: dateStringSchema,
    status: z.nativeEnum(BookingStatus).optional(),
    source: z.nativeEnum(BookingSource).optional(),
    customerNote: z.string().optional().nullable(),
    items: z.array(bookingItemCreateSchema).min(1),
  })
  .strict();

const bookingUpdateSchema = z
  .object({
    locationId: uuidSchema.optional().nullable(),
    customerId: uuidSchema.optional(),
    staffId: uuidSchema.optional().nullable(),
    startsAt: dateStringSchema.optional(),
    endsAt: dateStringSchema.optional(),
    status: z.nativeEnum(BookingStatus).optional(),
    source: z.nativeEnum(BookingSource).optional(),
    customerNote: z.string().optional().nullable(),
  })
  .strict();

const bookingStatusSchema = z
  .object({
    toStatus: z.nativeEnum(BookingStatus),
    reason: z.string().optional().nullable(),
  })
  .strict();

const quoteRequestCreateSchema = z
  .object({
    customerId: uuidSchema,
    title: z.string().min(1),
    description: z.string().min(1),
    status: z.nativeEnum(QuoteRequestStatus).optional(),
  })
  .strict();

const quoteRequestUpdateSchema = quoteRequestCreateSchema.partial().strict();

const quoteItemCreateSchema = z
  .object({
    serviceId: uuidSchema.optional().nullable(),
    description: z.string().min(1),
    quantity: z.number().int().positive(),
    unitPrice: decimalStringSchema,
    total: decimalStringSchema,
  })
  .strict();

const quoteCreateSchema = z
  .object({
    quoteRequestId: uuidSchema,
    quoteNumber: z.string().min(1),
    status: z.nativeEnum(QuoteStatus).optional(),
    subtotal: decimalStringSchema,
    total: decimalStringSchema,
    currency: z.string().min(1).optional(),
    validUntil: dateStringSchema.optional().nullable(),
    notes: z.string().optional().nullable(),
    items: z.array(quoteItemCreateSchema).min(1),
  })
  .strict();

const quoteUpdateSchema = z
  .object({
    status: z.nativeEnum(QuoteStatus).optional(),
    subtotal: decimalStringSchema.optional(),
    total: decimalStringSchema.optional(),
    currency: z.string().min(1).optional(),
    validUntil: dateStringSchema.optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .strict();

const reviewCreateSchema = z
  .object({
    customerId: uuidSchema,
    bookingId: uuidSchema.optional().nullable(),
    rating: z.number().int().min(1).max(5),
    title: z.string().optional().nullable(),
    content: z.string().optional().nullable(),
    status: z.nativeEnum(ReviewStatus).optional(),
  })
  .strict();

const reviewUpdateSchema = reviewCreateSchema.partial().strict();

const reviewResponseUpsertSchema = z
  .object({
    content: z.string().min(1),
  })
  .strict();

const mediaCreateSchema = z
  .object({
    bucket: z.string().min(1),
    path: z.string().min(1),
    fileName: z.string().min(1),
    mimeType: z.string().optional().nullable(),
    sizeBytes: z.number().int().nonnegative().optional().nullable(),
    altText: z.string().optional().nullable(),
  })
  .strict();

const mediaUpdateSchema = mediaCreateSchema.partial().strict();

const roleCreateSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional().nullable(),
  })
  .strict();

const roleUpdateSchema = roleCreateSchema.partial().strict();

const permissionCreateSchema = z
  .object({
    key: z.string().min(1),
    description: z.string().optional().nullable(),
  })
  .strict();

const rolePermissionsPutSchema = z
  .object({
    permissionIds: z.array(uuidSchema),
  })
  .strict();

type RouteContext = {
  auth: AuthContext;
};

function parseUuidOrThrow(value: string, field: string): string {
  try {
    return parseSchema(uuidSchema, value);
  } catch {
    throw new ApiError(422, "VALIDATION_ERROR", `${field} must be a valid UUID`);
  }
}

function buildListQuery(searchParams: URLSearchParams, allowedFilters: string[]) {
  const filters: Record<string, string> = {};
  for (const key of allowedFilters) {
    const value = searchParams.get(key);
    if (value !== null) {
      filters[key] = value;
    }
  }

  return filters;
}

function validateListFilters(resource: string, filters: Record<string, string>) {
  const enumFilters: Record<string, z.ZodTypeAny> = {
    status:
      resource === "services"
        ? z.nativeEnum(ServiceStatus)
        : resource === "staff"
          ? z.nativeEnum(StaffStatus)
          : resource === "customers"
            ? z.nativeEnum(CustomerStatus)
            : resource === "bookings"
              ? z.nativeEnum(BookingStatus)
              : resource === "quote-requests"
                ? z.nativeEnum(QuoteRequestStatus)
                : resource === "quotes"
                  ? z.nativeEnum(QuoteStatus)
                  : resource === "reviews"
                    ? z.nativeEnum(ReviewStatus)
                    : z.string(),
    source: z.nativeEnum(BookingSource),
    actorType: z.nativeEnum(AuditActorType),
    action: z.nativeEnum(AuditAction),
  };

  for (const [key, schema] of Object.entries(enumFilters)) {
    if (filters[key] !== undefined && resource !== "audit-logs" && (key === "actorType" || key === "action")) {
      continue;
    }
    if (filters[key] !== undefined) {
      parseSchema(schema, filters[key]);
    }
  }

  for (const key of ["customerId", "staffId", "locationId", "categoryId", "quoteRequestId", "actorId", "entityId"]) {
    if (filters[key] !== undefined) {
      parseUuidOrThrow(filters[key], key);
    }
  }

  for (const key of ["from", "to"]) {
    if (filters[key] !== undefined) {
      parseSchema(dateStringSchema, filters[key]);
    }
  }

  if (filters.from && filters.to && new Date(filters.from).getTime() > new Date(filters.to).getTime()) {
    throw new ApiError(422, "VALIDATION_ERROR", "from must be before or equal to to");
  }
}

function parseDateOrder(start: string, end: string, startName: string, endName: string) {
  if (new Date(start).getTime() >= new Date(end).getTime()) {
    throw new ApiError(422, "VALIDATION_ERROR", `${startName} must be before ${endName}`);
  }
}

async function ensureBusinessAndPermission(authUserId: string, businessId: string, permission: string) {
  parseUuidOrThrow(businessId, "businessId");
  await requireBusinessPermission(authUserId, businessId, permission);
}

async function ensureSharedBusinessAccess(viewerUserId: string, targetUserId: string) {
  const shared = await prisma.businessMembership.findFirst({
    where: {
      userId: viewerUserId,
      status: MembershipStatus.ACTIVE,
      business: {
        memberships: {
          some: {
            userId: targetUserId,
            status: MembershipStatus.ACTIVE,
          },
        },
      },
    },
  });

  if (!shared) {
    throw new ApiError(403, "FORBIDDEN", "No shared business membership with requested user");
  }
}

async function requireStaffInBusiness(staffId: string, businessId: string) {
  const staff = await prisma.staff.findFirst({ where: { id: staffId, businessId } });
  if (!staff) {
    throw new ApiError(404, "NOT_FOUND", "Staff not found in business");
  }
  return staff;
}

async function requireCustomerInBusiness(customerId: string, businessId: string) {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, businessId } });
  if (!customer) {
    throw new ApiError(404, "NOT_FOUND", "Customer not found in business");
  }
  return customer;
}

function parseSegments(segments: string[] | undefined): string {
  if (!segments || segments.length === 0) {
    return "/";
  }

  return `/${segments.join("/")}`;
}

async function listWithPagination(findMany: (args: { skip: number; take: number }) => Promise<unknown[]>, count: () => Promise<number>, searchParams: URLSearchParams) {
  const pagination = getPagination(searchParams);
  const [rows, total] = await Promise.all([
    findMany({ skip: pagination.skip, take: pagination.take }),
    count(),
  ]);

  return listed(rows, toPageMeta(pagination.page, pagination.pageSize, total));
}

async function getBusinessScopedRecordOr404(model: keyof typeof prisma, idField: string, idValue: string, businessId: string) {
  const delegate = prisma[model] as { findFirst: (args: unknown) => Promise<unknown | null> };
  const record = await delegate.findFirst({
    where: {
      [idField]: idValue,
      businessId,
    },
  });

  if (!record) {
    throw new ApiError(404, "NOT_FOUND", "Resource not found");
  }

  return record;
}

function permissionFromSegment(segment: string, action: "read" | "create" | "update" | "delete") {
  return `${segment}.${action}`;
}

function publicInvitation<T extends { tokenHash?: unknown }>(invitation: T) {
  const safeInvitation = { ...invitation };
  delete safeInvitation.tokenHash;
  return safeInvitation;
}

const routes: RouteDefinition<RouteContext>[] = [
  {
    method: "GET",
    pattern: "/auth/me",
    handler: async ({ context }) => {
      const memberships = await prisma.businessMembership.findMany({
        where: { userId: context.auth.authUserId },
        include: {
          role: true,
          business: true,
        },
      });

      const profile = await prisma.profile.findUnique({ where: { userId: context.auth.authUserId } });

      return ok({
        user: context.auth.appUser,
        profile,
        memberships,
      });
    },
  },
  {
    method: "POST",
    pattern: "/auth/invitations/accept",
    handler: async ({ request, context }) => {
      const body = await parseJsonBody(
        request,
        z
          .object({
            token: z.string().min(1),
          })
          .strict(),
      );

      const hashed = createHash("sha256").update(body.token).digest("hex");
      const invitation = await prisma.businessInvitation.findFirst({
        where: {
          OR: [{ tokenHash: body.token }, { tokenHash: hashed }],
        },
      });

      if (!invitation) {
        throw new ApiError(404, "INVITATION_NOT_FOUND", "Invitation not found");
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw new ApiError(409, "INVITATION_NOT_PENDING", "Invitation is not in pending state");
      }

      if (invitation.expiresAt.getTime() < Date.now()) {
        throw new ApiError(410, "INVITATION_EXPIRED", "Invitation is expired");
      }

      const membership = await prisma.businessMembership.upsert({
        where: {
          businessId_userId: {
            businessId: invitation.businessId,
            userId: context.auth.authUserId,
          },
        },
        create: {
          businessId: invitation.businessId,
          userId: context.auth.authUserId,
          roleId: invitation.roleId,
          status: MembershipStatus.ACTIVE,
        },
        update: {
          roleId: invitation.roleId,
          status: MembershipStatus.ACTIVE,
        },
      });

      const accepted = await prisma.businessInvitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
          userId: context.auth.authUserId,
        },
      });

      await createAuditLog({
        businessId: invitation.businessId,
        actorId: context.auth.authUserId,
        action: AuditAction.ACCEPT_INVITATION,
        entityType: "BusinessInvitation",
        entityId: invitation.id,
      });

      return ok({ invitation: publicInvitation(accepted), membership });
    },
  },
  {
    method: "GET",
    pattern: "/users/me",
    handler: async ({ context }) => ok(context.auth.appUser),
  },
  {
    method: "PATCH",
    pattern: "/users/me",
    handler: async ({ request, context }) => {
      const body = await parseJsonBody(
        request,
        z
          .object({
            firstName: z.string().optional().nullable(),
            lastName: z.string().optional().nullable(),
            phone: z.string().optional().nullable(),
            avatarUrl: z.string().url().optional().nullable(),
            status: z.nativeEnum(UserStatus).optional(),
          })
          .strict(),
      );

      const user = await prisma.user.update({
        where: { id: context.auth.authUserId },
        data: body,
      });

      return ok(user);
    },
  },
  {
    method: "GET",
    pattern: "/users/:userId",
    handler: async ({ context, params }) => {
      await requireGlobalPermission(context.auth.authUserId, "users.read");
      const userId = parseUuidOrThrow(params.userId, "userId");
      await ensureSharedBusinessAccess(context.auth.authUserId, userId);
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new ApiError(404, "NOT_FOUND", "User not found");
      }

      return ok(user);
    },
  },
  {
    method: "GET",
    pattern: "/profiles/me",
    handler: async ({ context }) => {
      const profile = await prisma.profile.findUnique({ where: { userId: context.auth.authUserId } });
      return ok(profile);
    },
  },
  {
    method: "PATCH",
    pattern: "/profiles/me",
    handler: async ({ request, context }) => {
      const body = await parseJsonBody(
        request,
        z
          .object({
            bio: z.string().optional().nullable(),
            timezone: z.string().optional(),
            locale: z.string().optional(),
            dateOfBirth: dateStringSchema.optional().nullable(),
          })
          .strict(),
      );

      const profile = await prisma.profile.upsert({
        where: { userId: context.auth.authUserId },
        create: {
          userId: context.auth.authUserId,
          ...body,
          dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        },
        update: {
          ...body,
          dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        },
      });

      return ok(profile);
    },
  },
  {
    method: "GET",
    pattern: "/profiles/:userId",
    handler: async ({ context, params }) => {
      await requireGlobalPermission(context.auth.authUserId, "profiles.read");
      const userId = parseUuidOrThrow(params.userId, "userId");
      await ensureSharedBusinessAccess(context.auth.authUserId, userId);
      const profile = await prisma.profile.findUnique({ where: { userId } });
      if (!profile) {
        throw new ApiError(404, "NOT_FOUND", "Profile not found");
      }

      return ok(profile);
    },
  },
  {
    method: "GET",
    pattern: "/businesses",
    handler: async ({ context, searchParams }) => {
      await requireGlobalPermission(context.auth.authUserId, "businesses.read");

      if (searchParams.get("status")) {
        parseSchema(z.nativeEnum(BusinessStatus), searchParams.get("status"));
      }
      if (searchParams.get("businessTypeId")) {
        parseUuidOrThrow(searchParams.get("businessTypeId") as string, "businessTypeId");
      }

      const where: Prisma.BusinessWhereInput = {
        memberships: {
          some: {
            userId: context.auth.authUserId,
            status: MembershipStatus.ACTIVE,
          },
        },
        ...(searchParams.get("status") ? { status: searchParams.get("status") as BusinessStatus } : {}),
        ...(searchParams.get("businessTypeId") ? { businessTypeId: searchParams.get("businessTypeId") as string } : {}),
        ...(searchParams.get("search")
          ? {
              OR: [
                { name: { contains: searchParams.get("search") ?? "", mode: "insensitive" } },
                { slug: { contains: searchParams.get("search") ?? "", mode: "insensitive" } },
              ],
            }
          : {}),
      };

      return listWithPagination(
        ({ skip, take }) =>
          prisma.business.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
        () => prisma.business.count({ where }),
        searchParams,
      );
    },
  },
  {
    method: "POST",
    pattern: "/businesses",
    handler: async ({ request, context }) => {
      const body = await parseJsonBody(request, businessCreateSchema);

      const businessType = await prisma.businessType.findFirst({
        where: { id: body.businessTypeId, status: BusinessTypeStatus.ACTIVE },
      });
      if (!businessType) {
        throw new ApiError(404, "NOT_FOUND", "Business type not found or inactive");
      }

      const result = await prisma.$transaction(async (tx) => {
        const ownerRole = await tx.role.findFirst({
          where: {
            name: {
              equals: "OWNER",
              mode: "insensitive",
            },
          },
        });

        if (!ownerRole) {
          throw new ApiError(409, "OWNER_ROLE_NOT_CONFIGURED", "The canonical OWNER role is not configured");
        }

        const business = await tx.business.create({
          data: {
            ...body,
            status: body.status ?? BusinessStatus.DRAFT,
          },
        });

        const membership = await tx.businessMembership.create({
          data: {
            businessId: business.id,
            userId: context.auth.authUserId,
            roleId: ownerRole.id,
            status: MembershipStatus.ACTIVE,
          },
          include: { role: true },
        });

        const settings = await tx.businessSettings.create({
          data: { businessId: business.id },
        });

        await tx.auditLog.createMany({
          data: [
            {
              businessId: business.id,
              actorId: context.auth.authUserId,
              actorType: AuditActorType.USER,
              action: AuditAction.CREATE,
              entityType: "Business",
              entityId: business.id,
            },
            {
              businessId: business.id,
              actorId: context.auth.authUserId,
              actorType: AuditActorType.USER,
              action: AuditAction.CREATE,
              entityType: "BusinessMembership",
              entityId: membership.id,
              metadata: { role: ownerRole.name },
            },
          ],
        });

        return { business, membership, settings };
      });

      return created(result);
    },
  },
  {
    method: "GET",
    pattern: "/business-types",
    handler: async ({ searchParams }) => {
      const where: Prisma.BusinessTypeWhereInput = {
        ...(searchParams.get("status") ? { status: searchParams.get("status") as BusinessTypeStatus } : {}),
        ...(searchParams.get("search")
          ? {
              OR: [
                { name: { contains: searchParams.get("search") ?? "", mode: "insensitive" } },
                { slug: { contains: searchParams.get("search") ?? "", mode: "insensitive" } },
              ],
            }
          : {}),
      };

      return listWithPagination(
        ({ skip, take }) => prisma.businessType.findMany({ where, skip, take, orderBy: { name: "asc" } }),
        () => prisma.businessType.count({ where }),
        searchParams,
      );
    },
  },
  {
    method: "POST",
    pattern: "/business-types",
    handler: async ({ request, context }) => {
      await requireGlobalPermission(context.auth.authUserId, "businesses.create");
      const body = await parseJsonBody(request, businessTypeCreateSchema);
      const businessType = await prisma.businessType.create({
        data: {
          ...body,
          status: body.status ?? BusinessTypeStatus.ACTIVE,
        },
      });
      await createAuditLog({
        actorId: context.auth.authUserId,
        action: AuditAction.CREATE,
        entityType: "BusinessType",
        entityId: businessType.id,
      });
      return created(businessType);
    },
  },
  {
    method: "GET",
    pattern: "/business-types/:businessTypeId",
    handler: async ({ context, params }) => {
      await requireGlobalPermission(context.auth.authUserId, "businesses.read");
      const businessTypeId = parseUuidOrThrow(params.businessTypeId, "businessTypeId");
      const businessType = await prisma.businessType.findUnique({ where: { id: businessTypeId } });
      if (!businessType) {
        throw new ApiError(404, "NOT_FOUND", "Business type not found");
      }
      return ok(businessType);
    },
  },
  {
    method: "PATCH",
    pattern: "/business-types/:businessTypeId",
    handler: async ({ request, context, params }) => {
      await requireGlobalPermission(context.auth.authUserId, "businesses.update");
      const businessTypeId = parseUuidOrThrow(params.businessTypeId, "businessTypeId");
      const body = await parseJsonBody(request, businessTypeUpdateSchema);
      const businessType = await prisma.businessType.update({ where: { id: businessTypeId }, data: body });
      await createAuditLog({
        actorId: context.auth.authUserId,
        action: AuditAction.UPDATE,
        entityType: "BusinessType",
        entityId: businessTypeId,
      });
      return ok(businessType);
    },
  },
  {
    method: "DELETE",
    pattern: "/business-types/:businessTypeId",
    handler: async ({ context, params }) => {
      await requireGlobalPermission(context.auth.authUserId, "businesses.delete");
      const businessTypeId = parseUuidOrThrow(params.businessTypeId, "businessTypeId");
      await prisma.businessType.delete({ where: { id: businessTypeId } });
      await createAuditLog({
        actorId: context.auth.authUserId,
        action: AuditAction.DELETE,
        entityType: "BusinessType",
        entityId: businessTypeId,
      });
      return noContent();
    },
  },
  {
    method: "GET",
    pattern: "/businesses/:businessId",
    handler: async ({ context, params }) => {
      await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "businesses.read");
      const business = await prisma.business.findUnique({ where: { id: params.businessId } });
      if (!business) {
        throw new ApiError(404, "NOT_FOUND", "Business not found");
      }

      return ok(business);
    },
  },
  {
    method: "PATCH",
    pattern: "/businesses/:businessId",
    handler: async ({ request, context, params }) => {
      await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "businesses.update");
      const body = await parseJsonBody(request, businessUpdateSchema);

      const business = await prisma.business.update({
        where: { id: params.businessId },
        data: body,
      });

      await createAuditLog({
        businessId: params.businessId,
        actorId: context.auth.authUserId,
        action: AuditAction.UPDATE,
        entityType: "Business",
        entityId: params.businessId,
      });

      return ok(business);
    },
  },
  {
    method: "GET",
    pattern: "/businesses/:businessId/settings",
    handler: async ({ context, params }) => {
      await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "business_settings.read");
      const settings = await prisma.businessSettings.findUnique({ where: { businessId: params.businessId } });
      if (!settings) {
        throw new ApiError(404, "NOT_FOUND", "Business settings not found");
      }

      return ok(settings);
    },
  },
  {
    method: "PATCH",
    pattern: "/businesses/:businessId/settings",
    handler: async ({ request, context, params }) => {
      await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "business_settings.update");
      const body = await parseJsonBody(request, businessSettingsUpsertSchema);

      const settings = await prisma.businessSettings.upsert({
        where: { businessId: params.businessId },
        create: {
          businessId: params.businessId,
          ...body,
        },
        update: body,
      });

      await createAuditLog({
        businessId: params.businessId,
        actorId: context.auth.authUserId,
        action: AuditAction.UPDATE,
        entityType: "BusinessSettings",
        entityId: settings.id,
      });

      return ok(settings);
    },
  },
  {
    method: "GET",
    pattern: "/businesses/:businessId/locations",
    handler: async ({ context, params, searchParams }) => {
      await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "locations.read");
      const where: Prisma.BusinessLocationWhereInput = {
        businessId: params.businessId,
        ...(searchParams.get("city") ? { city: { contains: searchParams.get("city") ?? "", mode: "insensitive" } } : {}),
        ...(searchParams.get("country") ? { country: searchParams.get("country") ?? "" } : {}),
        ...(searchParams.get("isActive") ? { isActive: searchParams.get("isActive") === "true" } : {}),
      };

      return listWithPagination(
        ({ skip, take }) => prisma.businessLocation.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
        () => prisma.businessLocation.count({ where }),
        searchParams,
      );
    },
  },
  {
    method: "POST",
    pattern: "/businesses/:businessId/locations",
    handler: async ({ request, context, params }) => {
      await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "locations.create");
      const body = await parseJsonBody(request, locationCreateSchema);

      const location = await prisma.businessLocation.create({
        data: {
          ...body,
          businessId: params.businessId,
        },
      });

      return created(location);
    },
  },
  {
    method: "GET",
    pattern: "/businesses/:businessId/locations/:locationId",
    handler: async ({ context, params }) => {
      await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "locations.read");
      const locationId = parseUuidOrThrow(params.locationId, "locationId");
      const location = await prisma.businessLocation.findFirst({ where: { id: locationId, businessId: params.businessId } });
      if (!location) {
        throw new ApiError(404, "NOT_FOUND", "Location not found");
      }

      return ok(location);
    },
  },
  {
    method: "PATCH",
    pattern: "/businesses/:businessId/locations/:locationId",
    handler: async ({ request, context, params }) => {
      await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "locations.update");
      const locationId = parseUuidOrThrow(params.locationId, "locationId");
      const body = await parseJsonBody(request, locationUpdateSchema);

      await getBusinessScopedRecordOr404("businessLocation", "id", locationId, params.businessId);
      const location = await prisma.businessLocation.update({ where: { id: locationId }, data: body });
      return ok(location);
    },
  },
  {
    method: "DELETE",
    pattern: "/businesses/:businessId/locations/:locationId",
    handler: async ({ context, params }) => {
      await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "locations.delete");
      const locationId = parseUuidOrThrow(params.locationId, "locationId");
      await getBusinessScopedRecordOr404("businessLocation", "id", locationId, params.businessId);
      await prisma.businessLocation.delete({ where: { id: locationId } });
      return noContent();
    },
  },
  {
    method: "GET",
    pattern: "/businesses/:businessId/hours",
    handler: async ({ context, params, searchParams }) => {
      await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "hours.read");
      const where = {
        businessId: params.businessId,
        ...(searchParams.get("dayOfWeek") ? { dayOfWeek: Number(searchParams.get("dayOfWeek")) } : {}),
        ...(searchParams.get("locationId") ? { locationId: searchParams.get("locationId") } : {}),
      };

      return listWithPagination(
        ({ skip, take }) => prisma.businessHours.findMany({ where, skip, take }),
        () => prisma.businessHours.count({ where }),
        searchParams,
      );
    },
  },
  {
    method: "POST",
    pattern: "/businesses/:businessId/hours",
    handler: async ({ request, context, params }) => {
      await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "hours.create");
      const body = await parseJsonBody(request, hoursCreateSchema);
      if (!body.isClosed && body.opensAt && body.closesAt && body.opensAt >= body.closesAt) {
        throw new ApiError(422, "VALIDATION_ERROR", "opensAt must be before closesAt");
      }

      if (body.locationId) {
        const location = await prisma.businessLocation.findFirst({ where: { id: body.locationId, businessId: params.businessId } });
        if (!location) {
          throw new ApiError(404, "NOT_FOUND", "Location not found in business");
        }
      }

      const hours = await prisma.businessHours.create({
        data: {
          ...body,
          businessId: params.businessId,
        },
      });

      return created(hours);
    },
  },
  {
    method: "PATCH",
    pattern: "/businesses/:businessId/hours/:hoursId",
    handler: async ({ request, context, params }) => {
      await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "hours.update");
      const hoursId = parseUuidOrThrow(params.hoursId, "hoursId");
      const body = await parseJsonBody(request, hoursUpdateSchema);

      await prisma.businessHours.findFirstOrThrow({ where: { id: hoursId, businessId: params.businessId } });
      if (!body.isClosed && body.opensAt && body.closesAt && body.opensAt >= body.closesAt) {
        throw new ApiError(422, "VALIDATION_ERROR", "opensAt must be before closesAt");
      }
      if (body.locationId) {
        const location = await prisma.businessLocation.findFirst({ where: { id: body.locationId, businessId: params.businessId } });
        if (!location) {
          throw new ApiError(404, "NOT_FOUND", "Location not found in business");
        }
      }
      const hours = await prisma.businessHours.update({ where: { id: hoursId }, data: body });
      return ok(hours);
    },
  },
  {
    method: "DELETE",
    pattern: "/businesses/:businessId/hours/:hoursId",
    handler: async ({ context, params }) => {
      await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "hours.delete");
      const hoursId = parseUuidOrThrow(params.hoursId, "hoursId");
      await prisma.businessHours.findFirstOrThrow({ where: { id: hoursId, businessId: params.businessId } });
      await prisma.businessHours.delete({ where: { id: hoursId } });
      return noContent();
    },
  },
  {
    method: "GET",
    pattern: "/businesses/:businessId/holidays",
    handler: async ({ context, params, searchParams }) => {
      await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "holidays.read");

      const where: Record<string, unknown> = { businessId: params.businessId };
      const fromDate = searchParams.get("fromDate");
      const toDate = searchParams.get("toDate");
      if (fromDate || toDate) {
        where.date = {
          ...(fromDate ? { gte: new Date(fromDate) } : {}),
          ...(toDate ? { lte: new Date(toDate) } : {}),
        };
      }

      return listWithPagination(
        ({ skip, take }) => prisma.businessHoliday.findMany({ where, skip, take, orderBy: { date: "desc" } }),
        () => prisma.businessHoliday.count({ where }),
        searchParams,
      );
    },
  },
  {
    method: "POST",
    pattern: "/businesses/:businessId/holidays",
    handler: async ({ request, context, params }) => {
      await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "holidays.create");
      const body = await parseJsonBody(request, holidayCreateSchema);
      const holiday = await prisma.businessHoliday.create({
        data: {
          businessId: params.businessId,
          date: new Date(body.date),
          name: body.name,
          isClosed: body.isClosed ?? true,
        },
      });
      return created(holiday);
    },
  },
  {
    method: "PATCH",
    pattern: "/businesses/:businessId/holidays/:holidayId",
    handler: async ({ request, context, params }) => {
      await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "holidays.update");
      const holidayId = parseUuidOrThrow(params.holidayId, "holidayId");
      const body = await parseJsonBody(request, holidayUpdateSchema);
      await prisma.businessHoliday.findFirstOrThrow({ where: { id: holidayId, businessId: params.businessId } });
      const holiday = await prisma.businessHoliday.update({
        where: { id: holidayId },
        data: {
          ...(body.date ? { date: new Date(body.date) } : {}),
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.isClosed !== undefined ? { isClosed: body.isClosed } : {}),
        },
      });
      return ok(holiday);
    },
  },
  {
    method: "DELETE",
    pattern: "/businesses/:businessId/holidays/:holidayId",
    handler: async ({ context, params }) => {
      await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "holidays.delete");
      const holidayId = parseUuidOrThrow(params.holidayId, "holidayId");
      await prisma.businessHoliday.findFirstOrThrow({ where: { id: holidayId, businessId: params.businessId } });
      await prisma.businessHoliday.delete({ where: { id: holidayId } });
      return noContent();
    },
  },
  {
    method: "GET",
    pattern: "/businesses/:businessId/memberships",
    handler: async ({ context, params, searchParams }) => {
      await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "memberships.read");
      const where: Prisma.BusinessMembershipWhereInput = {
        businessId: params.businessId,
        ...(searchParams.get("status") ? { status: searchParams.get("status") as MembershipStatus } : {}),
        ...(searchParams.get("roleId") ? { roleId: searchParams.get("roleId") as string } : {}),
        ...(searchParams.get("userId") ? { userId: searchParams.get("userId") as string } : {}),
      };
      return listWithPagination(
        ({ skip, take }) =>
          prisma.businessMembership.findMany({
            where,
            skip,
            take,
            include: { user: true, role: true },
            orderBy: { joinedAt: "desc" },
          }),
        () => prisma.businessMembership.count({ where }),
        searchParams,
      );
    },
  },
  {
    method: "POST",
    pattern: "/businesses/:businessId/memberships",
    handler: async ({ request, context, params }) => {
      await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "memberships.create");
      const body = await parseJsonBody(request, membershipCreateSchema);

      const [user, role] = await Promise.all([
        prisma.user.findUnique({ where: { id: body.userId } }),
        prisma.role.findUnique({ where: { id: body.roleId } }),
      ]);
      if (!user || !role) {
        throw new ApiError(404, "NOT_FOUND", "User or role not found");
      }

      const membership = await prisma.businessMembership.create({
        data: {
          businessId: params.businessId,
          userId: body.userId,
          roleId: body.roleId,
          status: body.status ?? MembershipStatus.ACTIVE,
        },
      });

      await createAuditLog({
        businessId: params.businessId,
        actorId: context.auth.authUserId,
        action: AuditAction.CREATE,
        entityType: "BusinessMembership",
        entityId: membership.id,
      });

      return created(membership);
    },
  },
  {
    method: "PATCH",
    pattern: "/businesses/:businessId/memberships/:membershipId",
    handler: async ({ request, context, params }) => {
      await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "memberships.update");
      const membershipId = parseUuidOrThrow(params.membershipId, "membershipId");
      const body = await parseJsonBody(request, membershipUpdateSchema);
      const membership = await prisma.businessMembership.findFirst({ where: { id: membershipId, businessId: params.businessId } });
      if (!membership) {
        throw new ApiError(404, "NOT_FOUND", "Membership not found");
      }

      const updated = await prisma.businessMembership.update({
        where: { id: membershipId },
        data: body,
      });

      await createAuditLog({
        businessId: params.businessId,
        actorId: context.auth.authUserId,
        action: AuditAction.UPDATE,
        entityType: "BusinessMembership",
        entityId: membershipId,
      });

      return ok(updated);
    },
  },
  {
    method: "DELETE",
    pattern: "/businesses/:businessId/memberships/:membershipId",
    handler: async ({ context, params }) => {
      await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "memberships.delete");
      const membershipId = parseUuidOrThrow(params.membershipId, "membershipId");
      await prisma.businessMembership.findFirstOrThrow({ where: { id: membershipId, businessId: params.businessId } });
      await prisma.businessMembership.delete({ where: { id: membershipId } });
      await createAuditLog({
        businessId: params.businessId,
        actorId: context.auth.authUserId,
        action: AuditAction.DELETE,
        entityType: "BusinessMembership",
        entityId: membershipId,
      });
      return noContent();
    },
  },
  {
    method: "GET",
    pattern: "/businesses/:businessId/invitations",
    handler: async ({ context, params, searchParams }) => {
      await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "invitations.read");
      const where: Prisma.BusinessInvitationWhereInput = {
        businessId: params.businessId,
        ...(searchParams.get("status") ? { status: searchParams.get("status") as InvitationStatus } : {}),
        ...(searchParams.get("email") ? { email: { contains: searchParams.get("email") ?? "", mode: "insensitive" } } : {}),
      };
      return listWithPagination(
        ({ skip, take }) =>
          prisma.businessInvitation.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              businessId: true,
              email: true,
              roleId: true,
              invitedById: true,
              userId: true,
              status: true,
              expiresAt: true,
              acceptedAt: true,
              createdAt: true,
            },
          }),
        () => prisma.businessInvitation.count({ where }),
        searchParams,
      );
    },
  },
  {
    method: "POST",
    pattern: "/businesses/:businessId/invitations",
    handler: async ({ request, context, params }) => {
      await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "invitations.create");
      const body = await parseJsonBody(request, invitationCreateSchema);

      const role = await prisma.role.findUnique({ where: { id: body.roleId } });
      if (!role) {
        throw new ApiError(404, "NOT_FOUND", "Role not found");
      }

      const token = createHash("sha256")
        .update(`${params.businessId}:${body.email}:${Date.now()}`)
        .digest("hex");

      const invitation = await prisma.businessInvitation.create({
        data: {
          businessId: params.businessId,
          email: body.email,
          roleId: body.roleId,
          invitedById: context.auth.authUserId,
          expiresAt: new Date(body.expiresAt),
          tokenHash: token,
        },
      });

      await createAuditLog({
        businessId: params.businessId,
        actorId: context.auth.authUserId,
        action: AuditAction.INVITE,
        entityType: "BusinessInvitation",
        entityId: invitation.id,
      });

      return created(publicInvitation(invitation));
    },
  },
  {
    method: "GET",
    pattern: "/businesses/:businessId/invitations/:invitationId",
    handler: async ({ context, params }) => {
      await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "invitations.read");
      const invitationId = parseUuidOrThrow(params.invitationId, "invitationId");
      const invitation = await prisma.businessInvitation.findFirst({ where: { id: invitationId, businessId: params.businessId } });
      if (!invitation) {
        throw new ApiError(404, "NOT_FOUND", "Invitation not found");
      }
      return ok(publicInvitation(invitation));
    },
  },
  {
    method: "PATCH",
    pattern: "/businesses/:businessId/invitations/:invitationId/revoke",
    handler: async ({ context, params }) => {
      await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "invitations.update");
      const invitationId = parseUuidOrThrow(params.invitationId, "invitationId");
      const invitation = await prisma.businessInvitation.findFirst({ where: { id: invitationId, businessId: params.businessId } });
      if (!invitation) {
        throw new ApiError(404, "NOT_FOUND", "Invitation not found");
      }
      if (invitation.status !== InvitationStatus.PENDING) {
        throw new ApiError(409, "INVALID_STATE", "Only pending invitations can be revoked");
      }

      const revoked = await prisma.businessInvitation.update({
        where: { id: invitationId },
        data: { status: InvitationStatus.REVOKED },
      });

      await createAuditLog({
        businessId: params.businessId,
        actorId: context.auth.authUserId,
        action: AuditAction.STATUS_CHANGE,
        entityType: "BusinessInvitation",
        entityId: invitationId,
      });

      return ok(publicInvitation(revoked));
    },
  },
];

async function crudBusinessResourceHandlers(args: {
  request: Request;
  context: RouteContext;
  params: Record<string, string>;
  searchParams: URLSearchParams;
  resource:
    | "services"
    | "service-categories"
    | "staff"
    | "customers"
    | "bookings"
    | "quote-requests"
    | "quotes"
    | "reviews"
    | "media"
    | "audit-logs";
  action: "list" | "create" | "get" | "update" | "delete";
}) {
  const { context, params, searchParams, request, resource, action } = args;
  const businessId = params.businessId;

  const map: Record<
    string,
    {
      permissionBase: string;
      model: keyof typeof prisma;
      idParam: string;
      createSchema?: z.ZodTypeAny;
      updateSchema?: z.ZodTypeAny;
      include?: Record<string, unknown>;
      listFilters?: string[];
      searchFields?: string[];
      defaultOrderBy?: Record<string, "asc" | "desc">;
      beforeCreate?: (body: Record<string, unknown>, businessId: string) => Promise<void>;
      beforeUpdate?: (id: string, body: Record<string, unknown>, businessId: string) => Promise<void>;
    }
  > = {
    services: {
      permissionBase: "services",
      model: "service",
      idParam: "serviceId",
      createSchema: serviceCreateSchema,
      updateSchema: serviceUpdateSchema,
      listFilters: ["status", "categoryId", "search"],
      searchFields: ["name", "slug", "description"],
      defaultOrderBy: { createdAt: "desc" },
      beforeCreate: async (body, bId) => {
        if (body.categoryId) {
          const category = await prisma.serviceCategory.findFirst({ where: { id: String(body.categoryId), businessId: bId } });
          if (!category) {
            throw new ApiError(404, "NOT_FOUND", "Category not found in business");
          }
        }
      },
      beforeUpdate: async (_id, body, bId) => {
        if (body.categoryId) {
          const category = await prisma.serviceCategory.findFirst({ where: { id: String(body.categoryId), businessId: bId } });
          if (!category) {
            throw new ApiError(404, "NOT_FOUND", "Category not found in business");
          }
        }
      },
    },
    "service-categories": {
      permissionBase: "service_categories",
      model: "serviceCategory",
      idParam: "categoryId",
      createSchema: serviceCategoryCreateSchema,
      updateSchema: serviceCategoryUpdateSchema,
      listFilters: ["isActive", "search"],
      searchFields: ["name", "slug", "description"],
      defaultOrderBy: { sortOrder: "asc" },
    },
    staff: {
      permissionBase: "staff",
      model: "staff",
      idParam: "staffId",
      createSchema: staffCreateSchema,
      updateSchema: staffUpdateSchema,
      listFilters: ["status", "search"],
      searchFields: ["firstName", "lastName", "email", "phone", "title"],
      defaultOrderBy: { createdAt: "desc" },
      beforeCreate: async (body) => {
        if (body.userId) {
          const user = await prisma.user.findUnique({ where: { id: String(body.userId) } });
          if (!user) {
            throw new ApiError(404, "NOT_FOUND", "Linked user not found");
          }
        }
      },
    },
    customers: {
      permissionBase: "customers",
      model: "customer",
      idParam: "customerId",
      createSchema: customerCreateSchema,
      updateSchema: customerUpdateSchema,
      listFilters: ["status", "email", "phone", "search"],
      searchFields: ["firstName", "lastName", "email", "phone"],
      defaultOrderBy: { createdAt: "desc" },
    },
    bookings: {
      permissionBase: "bookings",
      model: "booking",
      idParam: "bookingId",
      createSchema: bookingCreateSchema,
      updateSchema: bookingUpdateSchema,
      listFilters: ["status", "customerId", "staffId", "locationId", "source", "from", "to"],
      searchFields: ["bookingNumber", "customerNote"],
      defaultOrderBy: { startsAt: "desc" },
      beforeUpdate: async (_id, body, bId) => {
        if (body.customerId) {
          await requireCustomerInBusiness(String(body.customerId), bId);
        }
        if (body.staffId) {
          await requireStaffInBusiness(String(body.staffId), bId);
        }
        if (body.locationId) {
          const location = await prisma.businessLocation.findFirst({ where: { id: String(body.locationId), businessId: bId } });
          if (!location) {
            throw new ApiError(404, "NOT_FOUND", "Location not found in business");
          }
        }
      },
    },
    "quote-requests": {
      permissionBase: "quote_requests",
      model: "quoteRequest",
      idParam: "quoteRequestId",
      createSchema: quoteRequestCreateSchema,
      updateSchema: quoteRequestUpdateSchema,
      listFilters: ["status", "customerId", "from", "to"],
      searchFields: ["title", "description"],
      defaultOrderBy: { createdAt: "desc" },
    },
    quotes: {
      permissionBase: "quotes",
      model: "quote",
      idParam: "quoteId",
      createSchema: quoteCreateSchema,
      updateSchema: quoteUpdateSchema,
      listFilters: ["status", "quoteRequestId", "from", "to"],
      searchFields: ["quoteNumber", "notes"],
      defaultOrderBy: { createdAt: "desc" },
    },
    reviews: {
      permissionBase: "reviews",
      model: "review",
      idParam: "reviewId",
      createSchema: reviewCreateSchema,
      updateSchema: reviewUpdateSchema,
      listFilters: ["status", "customerId", "bookingId"],
      searchFields: ["title", "content"],
      defaultOrderBy: { createdAt: "desc" },
    },
    media: {
      permissionBase: "media",
      model: "mediaAsset",
      idParam: "mediaId",
      createSchema: mediaCreateSchema,
      updateSchema: mediaUpdateSchema,
      listFilters: ["bucket", "mimeType", "search"],
      searchFields: ["fileName", "path", "altText"],
      defaultOrderBy: { createdAt: "desc" },
    },
    "audit-logs": {
      permissionBase: "audit_logs",
      model: "auditLog",
      idParam: "auditLogId",
      listFilters: ["actorId", "actorType", "action", "entityType", "entityId", "from", "to"],
      searchFields: ["entityType", "entityId"],
      defaultOrderBy: { createdAt: "desc" },
    },
  };

  const config = map[resource];
  if (!config) {
    throw new ApiError(404, "NOT_FOUND", "Resource not found");
  }

  if (resource === "audit-logs" && action !== "list" && action !== "get") {
    throw new ApiError(404, "NOT_FOUND", "Endpoint not found");
  }

  const permission = permissionFromSegment(config.permissionBase, action === "list" || action === "get" ? "read" : action === "create" ? "create" : action === "update" ? "update" : "delete");
  await ensureBusinessAndPermission(context.auth.authUserId, businessId, permission);

  const delegate = prisma[config.model] as unknown as {
    findMany: (args: Record<string, unknown>) => Promise<unknown[]>;
    count: (args: Record<string, unknown>) => Promise<number>;
    create: (args: Record<string, unknown>) => Promise<unknown>;
    findFirst: (args: Record<string, unknown>) => Promise<unknown | null>;
    update: (args: Record<string, unknown>) => Promise<unknown>;
    delete: (args: Record<string, unknown>) => Promise<unknown>;
  };

  if (action === "list") {
    const filterValues = buildListQuery(searchParams, config.listFilters ?? []);
    validateListFilters(resource, filterValues);

    const where: Record<string, unknown> = { businessId };
    if (filterValues.status) {
      where.status = filterValues.status;
    }
    if (filterValues.customerId) {
      where.customerId = filterValues.customerId;
    }
    if (filterValues.staffId) {
      where.staffId = filterValues.staffId;
    }
    if (filterValues.locationId) {
      where.locationId = filterValues.locationId;
    }
    if (filterValues.source) {
      where.source = filterValues.source;
    }
    if (filterValues.categoryId) {
      where.categoryId = filterValues.categoryId;
    }
    if (filterValues.bucket) {
      where.bucket = filterValues.bucket;
    }
    if (filterValues.mimeType) {
      where.mimeType = filterValues.mimeType;
    }
    if (filterValues.actorId) {
      where.actorId = filterValues.actorId;
    }
    if (filterValues.actorType) {
      where.actorType = filterValues.actorType;
    }
    if (filterValues.action) {
      where.action = filterValues.action;
    }
    if (filterValues.entityType) {
      where.entityType = filterValues.entityType;
    }
    if (filterValues.entityId) {
      where.entityId = filterValues.entityId;
    }
    if (filterValues.roleId) {
      where.roleId = filterValues.roleId;
    }
    if (filterValues.userId) {
      where.userId = filterValues.userId;
    }
    if (filterValues.email) {
      where.email = { contains: filterValues.email, mode: "insensitive" };
    }
    if (filterValues.phone) {
      where.phone = { contains: filterValues.phone, mode: "insensitive" };
    }
    if (filterValues.search) {
      const search = filterValues.search;
      where.OR = (config.searchFields ?? []).map((field) => ({
        [field]: { contains: search, mode: "insensitive" },
      }));
    }

    if (filterValues.from || filterValues.to) {
      const dateWhere: Record<string, unknown> = {};
      if (filterValues.from) {
        dateWhere.gte = new Date(filterValues.from);
      }
      if (filterValues.to) {
        dateWhere.lte = new Date(filterValues.to);
      }

      if (resource === "bookings") {
        where.startsAt = dateWhere;
      } else {
        where.createdAt = dateWhere;
      }
    }

    return listWithPagination(
      ({ skip, take }) => delegate.findMany({ where, skip, take, orderBy: config.defaultOrderBy }),
      () => delegate.count({ where }),
      searchParams,
    );
  }

  if (action === "create") {
    if (!config.createSchema) {
      throw new ApiError(404, "NOT_FOUND", "Create not supported");
    }

    const body = (await parseJsonBody(request, config.createSchema)) as Record<string, unknown>;
    if (config.beforeCreate) {
      await config.beforeCreate(body, businessId);
    }

    if (resource === "bookings") {
      const bookingBody = body as z.infer<typeof bookingCreateSchema>;
      parseDateOrder(bookingBody.startsAt, bookingBody.endsAt, "startsAt", "endsAt");

      const [customer, staff, location] = await Promise.all([
        prisma.customer.findFirst({ where: { id: bookingBody.customerId, businessId } }),
        bookingBody.staffId ? prisma.staff.findFirst({ where: { id: bookingBody.staffId, businessId } }) : Promise.resolve(null),
        bookingBody.locationId
          ? prisma.businessLocation.findFirst({ where: { id: bookingBody.locationId, businessId } })
          : Promise.resolve(null),
      ]);

      if (!customer) {
        throw new ApiError(404, "NOT_FOUND", "Customer not found in business");
      }
      if (bookingBody.staffId && !staff) {
        throw new ApiError(404, "NOT_FOUND", "Staff not found in business");
      }
      if (bookingBody.locationId && !location) {
        throw new ApiError(404, "NOT_FOUND", "Location not found in business");
      }

      const serviceIds = bookingBody.items.map((item) => item.serviceId);
      const countServices = await prisma.service.count({ where: { id: { in: serviceIds }, businessId } });
      if (countServices !== serviceIds.length) {
        throw new ApiError(422, "VALIDATION_ERROR", "One or more booking item services are outside the business");
      }

      const booking = await prisma.$transaction(async (tx) => {
        const createdBooking = await tx.booking.create({
          data: {
            businessId,
            locationId: bookingBody.locationId ?? null,
            customerId: bookingBody.customerId,
            staffId: bookingBody.staffId ?? null,
            bookingNumber: `BKG-${randomUUID()}`,
            startsAt: new Date(bookingBody.startsAt),
            endsAt: new Date(bookingBody.endsAt),
            status: bookingBody.status ?? BookingStatus.PENDING,
            source: bookingBody.source ?? BookingSource.PLATFORM,
            customerNote: bookingBody.customerNote ?? null,
          },
        });

        await tx.bookingItem.createMany({
          data: bookingBody.items.map((item) => ({
            bookingId: createdBooking.id,
            serviceId: item.serviceId,
            serviceName: item.serviceName,
            durationMinutes: item.durationMinutes,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
          })),
        });

        await tx.bookingStatusHistory.create({
          data: {
            bookingId: createdBooking.id,
            fromStatus: null,
            toStatus: createdBooking.status,
            changedById: context.auth.authUserId,
            reason: "Booking created",
          },
        });

        await tx.auditLog.create({
          data: {
            businessId,
            actorId: context.auth.authUserId,
            actorType: AuditActorType.USER,
            action: AuditAction.CREATE,
            entityType: "Booking",
            entityId: createdBooking.id,
          },
        });

        return createdBooking;
      });

      return created(booking);
    }

    if (resource === "quote-requests") {
      const quoteBody = body as z.infer<typeof quoteRequestCreateSchema>;
      const customer = await prisma.customer.findFirst({ where: { id: quoteBody.customerId, businessId } });
      if (!customer) {
        throw new ApiError(404, "NOT_FOUND", "Customer not found in business");
      }
    }

    if (resource === "quotes") {
      const quoteBody = body as z.infer<typeof quoteCreateSchema>;
      const quoteRequest = await prisma.quoteRequest.findFirst({ where: { id: quoteBody.quoteRequestId, businessId } });
      if (!quoteRequest) {
        throw new ApiError(404, "NOT_FOUND", "Quote request not found in business");
      }

      if (quoteBody.items.some((item) => item.serviceId)) {
        const serviceIds = quoteBody.items
          .filter((item) => item.serviceId)
          .map((item) => item.serviceId) as string[];
        const serviceCount = await prisma.service.count({ where: { id: { in: serviceIds }, businessId } });
        if (serviceCount !== serviceIds.length) {
          throw new ApiError(422, "VALIDATION_ERROR", "One or more quote item services are outside business scope");
        }
      }

      const quote = await prisma.$transaction(async (tx) => {
        const createdQuote = await tx.quote.create({
          data: {
            businessId,
            quoteRequestId: quoteBody.quoteRequestId,
            quoteNumber: quoteBody.quoteNumber,
            status: quoteBody.status ?? QuoteStatus.DRAFT,
            subtotal: quoteBody.subtotal,
            total: quoteBody.total,
            currency: quoteBody.currency ?? "USD",
            validUntil: quoteBody.validUntil ? new Date(quoteBody.validUntil) : null,
            notes: quoteBody.notes ?? null,
          },
        });

        await tx.quoteItem.createMany({
          data: quoteBody.items.map((item) => ({
            quoteId: createdQuote.id,
            serviceId: item.serviceId ?? null,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
        });

        await tx.auditLog.create({
          data: {
            businessId,
            actorId: context.auth.authUserId,
            actorType: AuditActorType.USER,
            action: AuditAction.CREATE,
            entityType: "Quote",
            entityId: createdQuote.id,
          },
        });

        return createdQuote;
      });

      return created(quote);
    }

    if (resource === "reviews") {
      const reviewBody = body as z.infer<typeof reviewCreateSchema>;
      const customer = await prisma.customer.findFirst({ where: { id: reviewBody.customerId, businessId } });
      if (!customer) {
        throw new ApiError(404, "NOT_FOUND", "Customer not found in business");
      }
      if (reviewBody.bookingId) {
        const booking = await prisma.booking.findFirst({ where: { id: reviewBody.bookingId, businessId } });
        if (!booking) {
          throw new ApiError(404, "NOT_FOUND", "Booking not found in business");
        }
      }
    }

    const createdRecord = await delegate.create({
      data: {
        ...body,
        businessId,
      },
    });

    await createAuditLog({
      businessId,
      actorId: context.auth.authUserId,
      action: AuditAction.CREATE,
      entityType: String(config.model),
      entityId: String((createdRecord as { id?: string }).id ?? ""),
    });

    return created(createdRecord);
  }

  const idValue = parseUuidOrThrow(params[config.idParam], config.idParam);
  const record = await delegate.findFirst({ where: { id: idValue, businessId } });
  if (!record) {
    throw new ApiError(404, "NOT_FOUND", "Resource not found");
  }

  if (action === "get") {
    return ok(record);
  }

  if (action === "update") {
    if (!config.updateSchema) {
      throw new ApiError(404, "NOT_FOUND", "Update not supported");
    }

    const body = (await parseJsonBody(request, config.updateSchema)) as Record<string, unknown>;
    if (config.beforeUpdate) {
      await config.beforeUpdate(idValue, body, businessId);
    }

    if (resource === "bookings") {
      const bookingBody = body as z.infer<typeof bookingUpdateSchema>;
      const bookingRecord = record as { startsAt: Date; endsAt: Date };
      const nextStartsAt = bookingBody.startsAt ?? bookingRecord.startsAt.toISOString();
      const nextEndsAt = bookingBody.endsAt ?? bookingRecord.endsAt.toISOString();
      if (bookingBody.startsAt || bookingBody.endsAt) {
        parseDateOrder(nextStartsAt, nextEndsAt, "startsAt", "endsAt");
      }
    }

    const updateData: Record<string, unknown> = { ...body };
    if (resource === "bookings") {
      if (typeof body.startsAt === "string") {
        updateData.startsAt = new Date(body.startsAt);
      }
      if (typeof body.endsAt === "string") {
        updateData.endsAt = new Date(body.endsAt);
      }
    }
    if (resource === "quotes" && typeof body.validUntil === "string") {
      updateData.validUntil = new Date(body.validUntil);
    }

    let updatedRecord: unknown;
    if (resource === "bookings" && body.status !== undefined) {
      const bookingRecord = record as { status: BookingStatus };
      assertValidBookingStatusTransition(bookingRecord.status, body.status as BookingStatus);
      updatedRecord = await prisma.$transaction(async (tx) => {
        const updated = await tx.booking.update({
          where: { id: idValue },
          data: updateData,
        });
        await tx.bookingStatusHistory.create({
          data: {
            bookingId: idValue,
            fromStatus: bookingRecord.status,
            toStatus: body.status as BookingStatus,
            changedById: context.auth.authUserId,
            reason: "Booking updated",
          },
        });
        await tx.auditLog.create({
          data: {
            businessId,
            actorId: context.auth.authUserId,
            actorType: AuditActorType.USER,
            action: AuditAction.STATUS_CHANGE,
            entityType: "Booking",
            entityId: idValue,
          },
        });
        return updated;
      });
    } else {
      updatedRecord = await delegate.update({
        where: { id: idValue },
        data: updateData,
      });
    }

    if (!(resource === "bookings" && body.status !== undefined)) {
      await createAuditLog({
        businessId,
        actorId: context.auth.authUserId,
        action: AuditAction.UPDATE,
        entityType: String(config.model),
        entityId: idValue,
      });
    }

    return ok(updatedRecord);
  }

  await delegate.delete({ where: { id: idValue } });

  await createAuditLog({
    businessId,
    actorId: context.auth.authUserId,
    action: AuditAction.DELETE,
    entityType: String(config.model),
    entityId: idValue,
  });

  return noContent();
}

async function handleSpecialRoute(method: string, path: string, routeContext: { request: Request; context: RouteContext; searchParams: URLSearchParams }) {
  const specialRoutes: RouteDefinition<RouteContext>[] = [
    {
      method: "PUT",
      pattern: "/businesses/:businessId/services/:serviceId/locations",
      handler: async ({ request, context, params }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "services.update");
        const body = await parseJsonBody(
          request,
          z
            .object({
              locationIds: z.array(uuidSchema),
            })
            .strict(),
        );

        const serviceId = parseUuidOrThrow(params.serviceId, "serviceId");
        const service = await prisma.service.findFirst({ where: { id: serviceId, businessId: params.businessId } });
        if (!service) {
          throw new ApiError(404, "NOT_FOUND", "Service not found in business");
        }

        const countLocations = await prisma.businessLocation.count({
          where: { id: { in: body.locationIds }, businessId: params.businessId },
        });

        if (countLocations !== body.locationIds.length) {
          throw new ApiError(422, "VALIDATION_ERROR", "One or more locationIds are outside this business");
        }

        await prisma.$transaction(async (tx) => {
          await tx.serviceLocation.deleteMany({ where: { serviceId } });
          if (body.locationIds.length > 0) {
            await tx.serviceLocation.createMany({
              data: body.locationIds.map((locationId) => ({ serviceId, locationId })),
            });
          }
        });

        const links = await prisma.serviceLocation.findMany({ where: { serviceId } });
        return ok(links);
      },
    },
    {
      method: "PUT",
      pattern: "/businesses/:businessId/services/:serviceId/staff",
      handler: async ({ request, context, params }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "services.update");
        const body = await parseJsonBody(
          request,
          z
            .object({
              staffIds: z.array(uuidSchema),
            })
            .strict(),
        );

        const serviceId = parseUuidOrThrow(params.serviceId, "serviceId");
        const service = await prisma.service.findFirst({ where: { id: serviceId, businessId: params.businessId } });
        if (!service) {
          throw new ApiError(404, "NOT_FOUND", "Service not found in business");
        }

        const countStaff = await prisma.staff.count({
          where: { id: { in: body.staffIds }, businessId: params.businessId },
        });

        if (countStaff !== body.staffIds.length) {
          throw new ApiError(422, "VALIDATION_ERROR", "One or more staffIds are outside this business");
        }

        await prisma.$transaction(async (tx) => {
          await tx.serviceStaff.deleteMany({ where: { serviceId } });
          if (body.staffIds.length > 0) {
            await tx.serviceStaff.createMany({
              data: body.staffIds.map((staffId) => ({ serviceId, staffId })),
            });
          }
        });

        const links = await prisma.serviceStaff.findMany({ where: { serviceId } });
        return ok(links);
      },
    },
    {
      method: "PUT",
      pattern: "/businesses/:businessId/staff/:staffId/locations",
      handler: async ({ request, context, params }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "staff.update");
        const body = await parseJsonBody(
          request,
          z
            .object({
              locationIds: z.array(uuidSchema),
            })
            .strict(),
        );

        const staffId = parseUuidOrThrow(params.staffId, "staffId");
        const staff = await prisma.staff.findFirst({ where: { id: staffId, businessId: params.businessId } });
        if (!staff) {
          throw new ApiError(404, "NOT_FOUND", "Staff not found in business");
        }

        const countLocations = await prisma.businessLocation.count({
          where: { id: { in: body.locationIds }, businessId: params.businessId },
        });

        if (countLocations !== body.locationIds.length) {
          throw new ApiError(422, "VALIDATION_ERROR", "One or more locationIds are outside this business");
        }

        await prisma.$transaction(async (tx) => {
          await tx.staffLocation.deleteMany({ where: { staffId } });
          if (body.locationIds.length > 0) {
            await tx.staffLocation.createMany({
              data: body.locationIds.map((locationId) => ({ staffId, locationId })),
            });
          }
        });

        const links = await prisma.staffLocation.findMany({ where: { staffId } });
        return ok(links);
      },
    },
    {
      method: "PUT",
      pattern: "/businesses/:businessId/staff/:staffId/services",
      handler: async ({ request, context, params }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "staff.update");
        const body = await parseJsonBody(
          request,
          z
            .object({
              serviceIds: z.array(uuidSchema),
            })
            .strict(),
        );

        const staffId = parseUuidOrThrow(params.staffId, "staffId");
        const staff = await prisma.staff.findFirst({ where: { id: staffId, businessId: params.businessId } });
        if (!staff) {
          throw new ApiError(404, "NOT_FOUND", "Staff not found in business");
        }

        const countServices = await prisma.service.count({
          where: { id: { in: body.serviceIds }, businessId: params.businessId },
        });

        if (countServices !== body.serviceIds.length) {
          throw new ApiError(422, "VALIDATION_ERROR", "One or more serviceIds are outside this business");
        }

        await prisma.$transaction(async (tx) => {
          await tx.serviceStaff.deleteMany({ where: { staffId } });
          if (body.serviceIds.length > 0) {
            await tx.serviceStaff.createMany({
              data: body.serviceIds.map((serviceId) => ({ serviceId, staffId })),
            });
          }
        });

        const links = await prisma.serviceStaff.findMany({ where: { staffId } });
        return ok(links);
      },
    },
    {
      method: "GET",
      pattern: "/businesses/:businessId/staff/:staffId/availability",
      handler: async ({ context, params, searchParams }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "staff.read");
        const staffId = parseUuidOrThrow(params.staffId, "staffId");
        await requireStaffInBusiness(staffId, params.businessId);

        const where = {
          staffId,
          ...(searchParams.get("dayOfWeek") ? { dayOfWeek: Number(searchParams.get("dayOfWeek")) } : {}),
          ...(searchParams.get("isActive") ? { isActive: searchParams.get("isActive") === "true" } : {}),
        };

        return listWithPagination(
          ({ skip, take }) => prisma.staffAvailability.findMany({ where, skip, take }),
          () => prisma.staffAvailability.count({ where }),
          searchParams,
        );
      },
    },
    {
      method: "POST",
      pattern: "/businesses/:businessId/staff/:staffId/availability",
      handler: async ({ request, context, params }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "staff.update");
        const staffId = parseUuidOrThrow(params.staffId, "staffId");
        await requireStaffInBusiness(staffId, params.businessId);
        const body = await parseJsonBody(request, staffAvailabilityCreateSchema);
        if (body.startsAt >= body.endsAt) {
          throw new ApiError(422, "VALIDATION_ERROR", "startsAt must be before endsAt");
        }

        const row = await prisma.staffAvailability.create({ data: { staffId, ...body } });
        return created(row);
      },
    },
    {
      method: "PATCH",
      pattern: "/businesses/:businessId/staff/:staffId/availability/:availabilityId",
      handler: async ({ request, context, params }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "staff.update");
        const staffId = parseUuidOrThrow(params.staffId, "staffId");
        const availabilityId = parseUuidOrThrow(params.availabilityId, "availabilityId");
        const body = await parseJsonBody(request, staffAvailabilityUpdateSchema);
        const existing = await prisma.staffAvailability.findFirst({ where: { id: availabilityId, staffId } });
        if (!existing) {
          throw new ApiError(404, "NOT_FOUND", "Availability not found");
        }

        const row = await prisma.staffAvailability.update({ where: { id: availabilityId }, data: body });
        return ok(row);
      },
    },
    {
      method: "DELETE",
      pattern: "/businesses/:businessId/staff/:staffId/availability/:availabilityId",
      handler: async ({ context, params }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "staff.update");
        const staffId = parseUuidOrThrow(params.staffId, "staffId");
        const availabilityId = parseUuidOrThrow(params.availabilityId, "availabilityId");
        const existing = await prisma.staffAvailability.findFirst({ where: { id: availabilityId, staffId } });
        if (!existing) {
          throw new ApiError(404, "NOT_FOUND", "Availability not found");
        }

        await prisma.staffAvailability.delete({ where: { id: availabilityId } });
        return noContent();
      },
    },
    {
      method: "GET",
      pattern: "/businesses/:businessId/staff/:staffId/time-off",
      handler: async ({ context, params, searchParams }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "staff.read");
        const staffId = parseUuidOrThrow(params.staffId, "staffId");
        await requireStaffInBusiness(staffId, params.businessId);

        const where: Record<string, unknown> = { staffId };
        const from = searchParams.get("from");
        const to = searchParams.get("to");
        if (from || to) {
          where.startsAt = {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          };
        }

        return listWithPagination(
          ({ skip, take }) => prisma.staffTimeOff.findMany({ where, skip, take, orderBy: { startsAt: "desc" } }),
          () => prisma.staffTimeOff.count({ where }),
          searchParams,
        );
      },
    },
    {
      method: "POST",
      pattern: "/businesses/:businessId/staff/:staffId/time-off",
      handler: async ({ request, context, params }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "staff.update");
        const staffId = parseUuidOrThrow(params.staffId, "staffId");
        await requireStaffInBusiness(staffId, params.businessId);
        const body = await parseJsonBody(request, staffTimeOffCreateSchema);
        parseDateOrder(body.startsAt, body.endsAt, "startsAt", "endsAt");

        const row = await prisma.staffTimeOff.create({
          data: {
            staffId,
            startsAt: new Date(body.startsAt),
            endsAt: new Date(body.endsAt),
            reason: body.reason ?? null,
          },
        });
        return created(row);
      },
    },
    {
      method: "PATCH",
      pattern: "/businesses/:businessId/staff/:staffId/time-off/:timeOffId",
      handler: async ({ request, context, params }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "staff.update");
        const staffId = parseUuidOrThrow(params.staffId, "staffId");
        const timeOffId = parseUuidOrThrow(params.timeOffId, "timeOffId");
        const body = await parseJsonBody(request, staffTimeOffUpdateSchema);
        const existing = await prisma.staffTimeOff.findFirst({ where: { id: timeOffId, staffId } });
        if (!existing) {
          throw new ApiError(404, "NOT_FOUND", "Time off not found");
        }

        if (body.startsAt && body.endsAt) {
          parseDateOrder(body.startsAt, body.endsAt, "startsAt", "endsAt");
        }

        const row = await prisma.staffTimeOff.update({
          where: { id: timeOffId },
          data: {
            ...(body.startsAt ? { startsAt: new Date(body.startsAt) } : {}),
            ...(body.endsAt ? { endsAt: new Date(body.endsAt) } : {}),
            ...(body.reason !== undefined ? { reason: body.reason } : {}),
          },
        });
        return ok(row);
      },
    },
    {
      method: "DELETE",
      pattern: "/businesses/:businessId/staff/:staffId/time-off/:timeOffId",
      handler: async ({ context, params }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "staff.update");
        const staffId = parseUuidOrThrow(params.staffId, "staffId");
        const timeOffId = parseUuidOrThrow(params.timeOffId, "timeOffId");
        const existing = await prisma.staffTimeOff.findFirst({ where: { id: timeOffId, staffId } });
        if (!existing) {
          throw new ApiError(404, "NOT_FOUND", "Time off not found");
        }
        await prisma.staffTimeOff.delete({ where: { id: timeOffId } });
        return noContent();
      },
    },
    {
      method: "GET",
      pattern: "/businesses/:businessId/customers/:customerId/addresses",
      handler: async ({ context, params, searchParams }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "customers.read");
        const customerId = parseUuidOrThrow(params.customerId, "customerId");
        await requireCustomerInBusiness(customerId, params.businessId);

        const where = {
          customerId,
          ...(searchParams.get("isPrimary") ? { isPrimary: searchParams.get("isPrimary") === "true" } : {}),
        };

        return listWithPagination(
          ({ skip, take }) => prisma.customerAddress.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
          () => prisma.customerAddress.count({ where }),
          searchParams,
        );
      },
    },
    {
      method: "POST",
      pattern: "/businesses/:businessId/customers/:customerId/addresses",
      handler: async ({ request, context, params }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "customers.update");
        const customerId = parseUuidOrThrow(params.customerId, "customerId");
        await requireCustomerInBusiness(customerId, params.businessId);
        const body = await parseJsonBody(request, customerAddressCreateSchema);
        const address = await prisma.customerAddress.create({ data: { customerId, ...body } });
        return created(address);
      },
    },
    {
      method: "PATCH",
      pattern: "/businesses/:businessId/customers/:customerId/addresses/:addressId",
      handler: async ({ request, context, params }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "customers.update");
        const customerId = parseUuidOrThrow(params.customerId, "customerId");
        const addressId = parseUuidOrThrow(params.addressId, "addressId");
        const body = await parseJsonBody(request, customerAddressUpdateSchema);
        const existing = await prisma.customerAddress.findFirst({ where: { id: addressId, customerId } });
        if (!existing) {
          throw new ApiError(404, "NOT_FOUND", "Address not found");
        }

        const row = await prisma.customerAddress.update({ where: { id: addressId }, data: body });
        return ok(row);
      },
    },
    {
      method: "DELETE",
      pattern: "/businesses/:businessId/customers/:customerId/addresses/:addressId",
      handler: async ({ context, params }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "customers.update");
        const customerId = parseUuidOrThrow(params.customerId, "customerId");
        const addressId = parseUuidOrThrow(params.addressId, "addressId");
        const existing = await prisma.customerAddress.findFirst({ where: { id: addressId, customerId } });
        if (!existing) {
          throw new ApiError(404, "NOT_FOUND", "Address not found");
        }

        await prisma.customerAddress.delete({ where: { id: addressId } });
        return noContent();
      },
    },
    {
      method: "GET",
      pattern: "/businesses/:businessId/customers/:customerId/notes",
      handler: async ({ context, params, searchParams }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "customers.read");
        const customerId = parseUuidOrThrow(params.customerId, "customerId");
        await requireCustomerInBusiness(customerId, params.businessId);

        const where = {
          customerId,
          ...(searchParams.get("authorId") ? { authorId: searchParams.get("authorId") } : {}),
        };

        return listWithPagination(
          ({ skip, take }) => prisma.customerNote.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
          () => prisma.customerNote.count({ where }),
          searchParams,
        );
      },
    },
    {
      method: "POST",
      pattern: "/businesses/:businessId/customers/:customerId/notes",
      handler: async ({ request, context, params }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "customers.update");
        const customerId = parseUuidOrThrow(params.customerId, "customerId");
        await requireCustomerInBusiness(customerId, params.businessId);
        const body = await parseJsonBody(request, customerNoteCreateSchema);
        const note = await prisma.customerNote.create({
          data: {
            customerId,
            content: body.content,
            authorId: context.auth.authUserId,
          },
        });
        return created(note);
      },
    },
    {
      method: "DELETE",
      pattern: "/businesses/:businessId/customers/:customerId/notes/:noteId",
      handler: async ({ context, params }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "customers.update");
        const customerId = parseUuidOrThrow(params.customerId, "customerId");
        const noteId = parseUuidOrThrow(params.noteId, "noteId");
        const existing = await prisma.customerNote.findFirst({ where: { id: noteId, customerId } });
        if (!existing) {
          throw new ApiError(404, "NOT_FOUND", "Note not found");
        }

        await prisma.customerNote.delete({ where: { id: noteId } });
        return noContent();
      },
    },
    {
      method: "GET",
      pattern: "/businesses/:businessId/customers/:customerId/preferences",
      handler: async ({ context, params }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "customers.read");
        const customerId = parseUuidOrThrow(params.customerId, "customerId");
        await requireCustomerInBusiness(customerId, params.businessId);
        const preferences = await prisma.customerPreference.findUnique({ where: { customerId } });
        return ok(preferences);
      },
    },
    {
      method: "PUT",
      pattern: "/businesses/:businessId/customers/:customerId/preferences",
      handler: async ({ request, context, params }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "customers.update");
        const customerId = parseUuidOrThrow(params.customerId, "customerId");
        const body = await parseJsonBody(request, customerPreferenceUpsertSchema);
        await requireCustomerInBusiness(customerId, params.businessId);

        if (body.preferredStaffId) {
          const staff = await prisma.staff.findFirst({ where: { id: body.preferredStaffId, businessId: params.businessId } });
          if (!staff) {
            throw new ApiError(422, "VALIDATION_ERROR", "preferredStaffId must belong to the same business");
          }
        }

        const pref = await prisma.customerPreference.upsert({
          where: { customerId },
          create: {
            customerId,
            notes: body.notes ?? null,
            preferredStaffId: body.preferredStaffId ?? null,
            preferredContactMethod: body.preferredContactMethod ?? null,
          },
          update: {
            notes: body.notes ?? null,
            preferredStaffId: body.preferredStaffId ?? null,
            preferredContactMethod: body.preferredContactMethod ?? null,
          },
        });
        return ok(pref);
      },
    },
    {
      method: "GET",
      pattern: "/businesses/:businessId/bookings/:bookingId/items",
      handler: async ({ context, params, searchParams }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "bookings.read");
        const bookingId = parseUuidOrThrow(params.bookingId, "bookingId");
        await prisma.booking.findFirstOrThrow({ where: { id: bookingId, businessId: params.businessId } });

        return listWithPagination(
          ({ skip, take }) => prisma.bookingItem.findMany({ where: { bookingId }, skip, take }),
          () => prisma.bookingItem.count({ where: { bookingId } }),
          searchParams,
        );
      },
    },
    {
      method: "POST",
      pattern: "/businesses/:businessId/bookings/:bookingId/items",
      handler: async ({ request, context, params }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "bookings.update");
        const bookingId = parseUuidOrThrow(params.bookingId, "bookingId");
        await prisma.booking.findFirstOrThrow({ where: { id: bookingId, businessId: params.businessId } });
        const body = await parseJsonBody(request, bookingItemCreateSchema);
        const service = await prisma.service.findFirst({ where: { id: body.serviceId, businessId: params.businessId } });
        if (!service) {
          throw new ApiError(404, "NOT_FOUND", "Service not found in business");
        }

        const item = await prisma.bookingItem.create({
          data: {
            bookingId,
            serviceId: body.serviceId,
            serviceName: body.serviceName,
            durationMinutes: body.durationMinutes,
            unitPrice: body.unitPrice,
            quantity: body.quantity,
          },
        });
        return created(item);
      },
    },
    {
      method: "PATCH",
      pattern: "/businesses/:businessId/bookings/:bookingId/items/:itemId",
      handler: async ({ request, context, params }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "bookings.update");
        const bookingId = parseUuidOrThrow(params.bookingId, "bookingId");
        const itemId = parseUuidOrThrow(params.itemId, "itemId");
        await prisma.booking.findFirstOrThrow({ where: { id: bookingId, businessId: params.businessId } });
        const body = await parseJsonBody(request, bookingItemCreateSchema.partial().strict());

        const existing = await prisma.bookingItem.findFirst({ where: { id: itemId, bookingId } });
        if (!existing) {
          throw new ApiError(404, "NOT_FOUND", "Booking item not found");
        }

        if (body.serviceId) {
          const service = await prisma.service.findFirst({ where: { id: body.serviceId, businessId: params.businessId } });
          if (!service) {
            throw new ApiError(404, "NOT_FOUND", "Service not found in business");
          }
        }

        const item = await prisma.bookingItem.update({ where: { id: itemId }, data: body });
        return ok(item);
      },
    },
    {
      method: "DELETE",
      pattern: "/businesses/:businessId/bookings/:bookingId/items/:itemId",
      handler: async ({ context, params }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "bookings.update");
        const bookingId = parseUuidOrThrow(params.bookingId, "bookingId");
        const itemId = parseUuidOrThrow(params.itemId, "itemId");
        await prisma.booking.findFirstOrThrow({ where: { id: bookingId, businessId: params.businessId } });

        const existing = await prisma.bookingItem.findFirst({ where: { id: itemId, bookingId } });
        if (!existing) {
          throw new ApiError(404, "NOT_FOUND", "Booking item not found");
        }

        await prisma.bookingItem.delete({ where: { id: itemId } });
        return noContent();
      },
    },
    {
      method: "GET",
      pattern: "/businesses/:businessId/bookings/:bookingId/status-history",
      handler: async ({ context, params, searchParams }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "bookings.read");
        const bookingId = parseUuidOrThrow(params.bookingId, "bookingId");
        await prisma.booking.findFirstOrThrow({ where: { id: bookingId, businessId: params.businessId } });

        const where: Record<string, unknown> = { bookingId };
        const from = searchParams.get("from");
        const to = searchParams.get("to");
        if (from || to) {
          where.createdAt = {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          };
        }

        return listWithPagination(
          ({ skip, take }) => prisma.bookingStatusHistory.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
          () => prisma.bookingStatusHistory.count({ where }),
          searchParams,
        );
      },
    },
    {
      method: "PATCH",
      pattern: "/businesses/:businessId/bookings/:bookingId/status",
      handler: async ({ request, context, params }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "bookings.status.update");
        const bookingId = parseUuidOrThrow(params.bookingId, "bookingId");
        const body = await parseJsonBody(request, bookingStatusSchema);

        const booking = await prisma.booking.findFirst({ where: { id: bookingId, businessId: params.businessId } });
        if (!booking) {
          throw new ApiError(404, "NOT_FOUND", "Booking not found");
        }

        assertValidBookingStatusTransition(booking.status, body.toStatus);

        const result = await prisma.$transaction(async (tx) => {
          const updated = await tx.booking.update({
            where: { id: bookingId },
            data: { status: body.toStatus },
          });

          const history = await tx.bookingStatusHistory.create({
            data: {
              bookingId,
              fromStatus: booking.status,
              toStatus: body.toStatus,
              changedById: context.auth.authUserId,
              reason: body.reason ?? null,
            },
          });

          await tx.auditLog.create({
            data: {
              businessId: params.businessId,
              actorId: context.auth.authUserId,
              actorType: AuditActorType.USER,
              action: AuditAction.STATUS_CHANGE,
              entityType: "Booking",
              entityId: bookingId,
              metadata: {
                fromStatus: booking.status,
                toStatus: body.toStatus,
                reason: body.reason ?? null,
              },
            },
          });

          return { booking: updated, history };
        });

        return ok(result);
      },
    },
    {
      method: "GET",
      pattern: "/businesses/:businessId/quotes/:quoteId/items",
      handler: async ({ context, params, searchParams }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "quotes.read");
        const quoteId = parseUuidOrThrow(params.quoteId, "quoteId");
        await prisma.quote.findFirstOrThrow({ where: { id: quoteId, businessId: params.businessId } });
        return listWithPagination(
          ({ skip, take }) => prisma.quoteItem.findMany({ where: { quoteId }, skip, take }),
          () => prisma.quoteItem.count({ where: { quoteId } }),
          searchParams,
        );
      },
    },
    {
      method: "POST",
      pattern: "/businesses/:businessId/quotes/:quoteId/items",
      handler: async ({ request, context, params }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "quotes.update");
        const quoteId = parseUuidOrThrow(params.quoteId, "quoteId");
        await prisma.quote.findFirstOrThrow({ where: { id: quoteId, businessId: params.businessId } });
        const body = await parseJsonBody(request, quoteItemCreateSchema);
        if (body.serviceId) {
          const service = await prisma.service.findFirst({ where: { id: body.serviceId, businessId: params.businessId } });
          if (!service) {
            throw new ApiError(404, "NOT_FOUND", "Service not found in business");
          }
        }

        const item = await prisma.quoteItem.create({
          data: {
            quoteId,
            serviceId: body.serviceId ?? null,
            description: body.description,
            quantity: body.quantity,
            unitPrice: body.unitPrice,
            total: body.total,
          },
        });
        return created(item);
      },
    },
    {
      method: "PATCH",
      pattern: "/businesses/:businessId/quotes/:quoteId/items/:itemId",
      handler: async ({ request, context, params }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "quotes.update");
        const quoteId = parseUuidOrThrow(params.quoteId, "quoteId");
        const itemId = parseUuidOrThrow(params.itemId, "itemId");
        await prisma.quote.findFirstOrThrow({ where: { id: quoteId, businessId: params.businessId } });
        const body = await parseJsonBody(request, quoteItemCreateSchema.partial().strict());

        const existing = await prisma.quoteItem.findFirst({ where: { id: itemId, quoteId } });
        if (!existing) {
          throw new ApiError(404, "NOT_FOUND", "Quote item not found");
        }

        if (body.serviceId) {
          const service = await prisma.service.findFirst({ where: { id: body.serviceId, businessId: params.businessId } });
          if (!service) {
            throw new ApiError(404, "NOT_FOUND", "Service not found in business");
          }
        }

        const row = await prisma.quoteItem.update({ where: { id: itemId }, data: body });
        return ok(row);
      },
    },
    {
      method: "DELETE",
      pattern: "/businesses/:businessId/quotes/:quoteId/items/:itemId",
      handler: async ({ context, params }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "quotes.update");
        const quoteId = parseUuidOrThrow(params.quoteId, "quoteId");
        const itemId = parseUuidOrThrow(params.itemId, "itemId");
        await prisma.quote.findFirstOrThrow({ where: { id: quoteId, businessId: params.businessId } });

        const existing = await prisma.quoteItem.findFirst({ where: { id: itemId, quoteId } });
        if (!existing) {
          throw new ApiError(404, "NOT_FOUND", "Quote item not found");
        }

        await prisma.quoteItem.delete({ where: { id: itemId } });
        return noContent();
      },
    },
    {
      method: "GET",
      pattern: "/businesses/:businessId/reviews/:reviewId/response",
      handler: async ({ context, params }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "review_responses.read");
        const reviewId = parseUuidOrThrow(params.reviewId, "reviewId");
        await prisma.review.findFirstOrThrow({ where: { id: reviewId, businessId: params.businessId } });
        const response = await prisma.reviewResponse.findUnique({ where: { reviewId } });
        return ok(response);
      },
    },
    {
      method: "PUT",
      pattern: "/businesses/:businessId/reviews/:reviewId/response",
      handler: async ({ request, context, params }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "review_responses.update");
        const reviewId = parseUuidOrThrow(params.reviewId, "reviewId");
        await prisma.review.findFirstOrThrow({ where: { id: reviewId, businessId: params.businessId } });
        const body = await parseJsonBody(request, reviewResponseUpsertSchema);

        const response = await prisma.reviewResponse.upsert({
          where: { reviewId },
          create: {
            reviewId,
            content: body.content,
            authorId: context.auth.authUserId,
          },
          update: {
            content: body.content,
            authorId: context.auth.authUserId,
          },
        });
        return ok(response);
      },
    },
    {
      method: "DELETE",
      pattern: "/businesses/:businessId/reviews/:reviewId/response",
      handler: async ({ context, params }) => {
        await ensureBusinessAndPermission(context.auth.authUserId, params.businessId, "review_responses.delete");
        const reviewId = parseUuidOrThrow(params.reviewId, "reviewId");
        await prisma.review.findFirstOrThrow({ where: { id: reviewId, businessId: params.businessId } });
        const response = await prisma.reviewResponse.findUnique({ where: { reviewId } });
        if (!response) {
          throw new ApiError(404, "NOT_FOUND", "Review response not found");
        }

        await prisma.reviewResponse.delete({ where: { reviewId } });
        return noContent();
      },
    },
    {
      method: "GET",
      pattern: "/roles",
      handler: async ({ context, searchParams }) => {
        await requireGlobalPermission(context.auth.authUserId, "roles.read");
        const search = searchParams.get("search");
        const where: Prisma.RoleWhereInput = search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
              ],
            }
          : {};

        return listWithPagination(
          ({ skip, take }) => prisma.role.findMany({ where, skip, take, orderBy: { name: "asc" } }),
          () => prisma.role.count({ where }),
          searchParams,
        );
      },
    },
    {
      method: "POST",
      pattern: "/roles",
      handler: async ({ request, context }) => {
        await requireGlobalPermission(context.auth.authUserId, "roles.create");
        const body = await parseJsonBody(request, roleCreateSchema);
        const role = await prisma.role.create({ data: body });
        await createAuditLog({
          actorId: context.auth.authUserId,
          action: AuditAction.CREATE,
          entityType: "Role",
          entityId: role.id,
        });
        return created(role);
      },
    },
    {
      method: "GET",
      pattern: "/roles/:roleId",
      handler: async ({ context, params, searchParams }) => {
        await requireGlobalPermission(context.auth.authUserId, "roles.read");
        const roleId = parseUuidOrThrow(params.roleId, "roleId");
        const includePermissions = searchParams.get("include") === "permissions";
        const role = await prisma.role.findUnique({
          where: { id: roleId },
          include: includePermissions
            ? {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              }
            : undefined,
        });

        if (!role) {
          throw new ApiError(404, "NOT_FOUND", "Role not found");
        }

        return ok(role);
      },
    },
    {
      method: "PATCH",
      pattern: "/roles/:roleId",
      handler: async ({ request, context, params }) => {
        await requireGlobalPermission(context.auth.authUserId, "roles.update");
        const roleId = parseUuidOrThrow(params.roleId, "roleId");
        const body = await parseJsonBody(request, roleUpdateSchema);
        const role = await prisma.role.update({ where: { id: roleId }, data: body });
        await createAuditLog({
          actorId: context.auth.authUserId,
          action: AuditAction.UPDATE,
          entityType: "Role",
          entityId: roleId,
        });
        return ok(role);
      },
    },
    {
      method: "DELETE",
      pattern: "/roles/:roleId",
      handler: async ({ context, params }) => {
        await requireGlobalPermission(context.auth.authUserId, "roles.delete");
        const roleId = parseUuidOrThrow(params.roleId, "roleId");
        await prisma.role.delete({ where: { id: roleId } });
        await createAuditLog({
          actorId: context.auth.authUserId,
          action: AuditAction.DELETE,
          entityType: "Role",
          entityId: roleId,
        });
        return noContent();
      },
    },
    {
      method: "PUT",
      pattern: "/roles/:roleId/permissions",
      handler: async ({ request, context, params }) => {
        await requireGlobalPermission(context.auth.authUserId, "roles.permissions.update");
        const roleId = parseUuidOrThrow(params.roleId, "roleId");
        const body = await parseJsonBody(request, rolePermissionsPutSchema);

        const role = await prisma.role.findUnique({ where: { id: roleId } });
        if (!role) {
          throw new ApiError(404, "NOT_FOUND", "Role not found");
        }

        const countPermissions = await prisma.permission.count({ where: { id: { in: body.permissionIds } } });
        if (countPermissions !== body.permissionIds.length) {
          throw new ApiError(422, "VALIDATION_ERROR", "One or more permissionIds do not exist");
        }

        await prisma.$transaction(async (tx) => {
          await tx.rolePermission.deleteMany({ where: { roleId } });
          if (body.permissionIds.length > 0) {
            await tx.rolePermission.createMany({
              data: body.permissionIds.map((permissionId) => ({ roleId, permissionId })),
            });
          }

          await tx.auditLog.create({
            data: {
              actorId: context.auth.authUserId,
              actorType: AuditActorType.USER,
              action: AuditAction.PERMISSION_CHANGE,
              entityType: "Role",
              entityId: roleId,
            },
          });
        });

        const roleWithPermissions = await prisma.role.findUnique({
          where: { id: roleId },
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        });

        return ok(roleWithPermissions);
      },
    },
    {
      method: "GET",
      pattern: "/permissions",
      handler: async ({ context, searchParams }) => {
        await requireGlobalPermission(context.auth.authUserId, "permissions.read");
        const search = searchParams.get("search");
        const where: Prisma.PermissionWhereInput = search
          ? {
              OR: [
                { key: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
              ],
            }
          : {};

        return listWithPagination(
          ({ skip, take }) => prisma.permission.findMany({ where, skip, take, orderBy: { key: "asc" } }),
          () => prisma.permission.count({ where }),
          searchParams,
        );
      },
    },
    {
      method: "POST",
      pattern: "/permissions",
      handler: async ({ request, context }) => {
        await requireGlobalPermission(context.auth.authUserId, "permissions.create");
        const body = await parseJsonBody(request, permissionCreateSchema);
        const permission = await prisma.permission.create({ data: body });
        await createAuditLog({
          actorId: context.auth.authUserId,
          action: AuditAction.CREATE,
          entityType: "Permission",
          entityId: permission.id,
        });
        return created(permission);
      },
    },
    {
      method: "GET",
      pattern: "/permissions/:permissionId",
      handler: async ({ context, params }) => {
        await requireGlobalPermission(context.auth.authUserId, "permissions.read");
        const permissionId = parseUuidOrThrow(params.permissionId, "permissionId");
        const permission = await prisma.permission.findUnique({ where: { id: permissionId } });
        if (!permission) {
          throw new ApiError(404, "NOT_FOUND", "Permission not found");
        }
        return ok(permission);
      },
    },
    {
      method: "DELETE",
      pattern: "/permissions/:permissionId",
      handler: async ({ context, params }) => {
        await requireGlobalPermission(context.auth.authUserId, "permissions.delete");
        const permissionId = parseUuidOrThrow(params.permissionId, "permissionId");
        await prisma.permission.delete({ where: { id: permissionId } });
        await createAuditLog({
          actorId: context.auth.authUserId,
          action: AuditAction.DELETE,
          entityType: "Permission",
          entityId: permissionId,
        });
        return noContent();
      },
    },
  ];

  return dispatchRoute(method, path, specialRoutes, routeContext);
}

export async function handleV1Request(request: Request, segments: string[], method: string) {
  try {
    const auth = await requireAuth(request);
    const path = parseSegments(segments);
    const url = new URL(request.url);

    try {
      return await dispatchRoute(method, path, routes, {
        request,
        context: { auth },
        searchParams: url.searchParams,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        const businessMatch = path.match(/^\/businesses\/[^/]+\/(services|service-categories|staff|customers|bookings|quote-requests|quotes|reviews|media|audit-logs)(?:\/[^/]+)?$/);
        if (businessMatch) {
          const resource = businessMatch[1] as
            | "services"
            | "service-categories"
            | "staff"
            | "customers"
            | "bookings"
            | "quote-requests"
            | "quotes"
            | "reviews"
            | "media"
            | "audit-logs";

          const pathParts = path.split("/").filter(Boolean);
          const businessId = pathParts[1];
          const params: Record<string, string> = { businessId };
          const idParamByResource: Record<string, string> = {
            services: "serviceId",
            "service-categories": "categoryId",
            staff: "staffId",
            customers: "customerId",
            bookings: "bookingId",
            "quote-requests": "quoteRequestId",
            quotes: "quoteId",
            reviews: "reviewId",
            media: "mediaId",
            "audit-logs": "auditLogId",
          };

          const isCollection = pathParts.length === 3;
          const action = method === "GET" ? (isCollection ? "list" : "get") : method === "POST" ? "create" : method === "PATCH" ? "update" : method === "DELETE" ? "delete" : null;

          if (action) {
            if (!isCollection) {
              params[idParamByResource[resource]] = pathParts[3];
            }

            return crudBusinessResourceHandlers({
              request,
              context: { auth },
              params,
              searchParams: url.searchParams,
              resource,
              action,
            });
          }
        }

        return handleSpecialRoute(method, path, {
          request,
          context: { auth },
          searchParams: url.searchParams,
        });
      }

      throw error;
    }
  } catch (error) {
    if (error instanceof ApiError) {
      return errorResponse(error.status, error.code, error.message, error.details);
    }

    if (isUniqueConstraint(error)) {
      return errorResponse(409, "CONFLICT", "A unique constraint was violated");
    }

    if (isRecordNotFound(error)) {
      return errorResponse(404, "NOT_FOUND", "Requested resource was not found");
    }

    return errorResponse(500, "INTERNAL_ERROR", "An unexpected error occurred");
  }
}
