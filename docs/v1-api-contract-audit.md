# V1 Frontend + API Contract Audit

**Audit scope:** `src/server/api/v1/routes.ts`, `src/server/api/*`, `app/api/v1/[...segments]/route.ts`, `prisma/schema.prisma`, and the Phase 1 frontend.

## Executive summary

- **Backend endpoints discovered:** 126 concrete method/path combinations.
- **Endpoints consumed by the frontend:** 1 (`GET /api/v1/auth/me`, through `useAuth`).
- **Endpoints not consumed by the frontend:** 125.
- **Frontend pages currently implemented:** the Phase 1 foundation overview only (`/`).
- **Backend endpoints missing for the audited V1 page plan:** public discovery/detail/availability endpoints and customer-facing booking/profile/quote/review flows are not present as public or customer-scoped routes. Existing business-scoped endpoints should not be treated as substitutes.
- **Authentication:** every `/api/v1` request currently passes through `requireAuth`, which requires a Supabase bearer token and a provisioned application user. Login, registration, password recovery, and password reset are not implemented in `/api/v1`; they must be handled directly by the existing Supabase architecture when those pages are built.
- **No mock data, mock users, fake responses, duplicated Prisma models, or invented endpoints were added.**

## Contract-wide rules

### Authentication and authorization

`handleV1Request` calls `requireAuth(request)` before dispatching any route. The backend:

1. Reads a bearer token from the `Authorization` header.
2. Validates it against Supabase using the existing server environment variables.
3. Resolves the user in the application database.
4. Returns `401 UNAUTHENTICATED` for missing/invalid tokens.
5. Returns `403 USER_NOT_PROVISIONED` when the Supabase user has no application row.

Business-scoped routes additionally require an active membership and an exact permission key through `requireBusinessPermission`. Global routes use `requireGlobalPermission`.

### Request and response shapes

- Success object: `{ "data": <value> }`, normally HTTP `200`.
- Created object: `{ "data": <value> }`, HTTP `201`.
- Paginated list: `{ "data": [...], "meta": { "page", "pageSize", "total", "totalPages" } }`, HTTP `200`.
- Delete success: empty body, HTTP `204`.
- Error: `{ "error": { "code": string, "message": string, "details": object } }`.
- Invalid JSON and Zod validation failures are HTTP `422` with code `VALIDATION_ERROR`.
- Unknown routes are HTTP `404` with code `NOT_FOUND`.
- `page` defaults to `1`; `pageSize` defaults to `20` and must be `1..100`.
- All request schemas are strict; unknown body fields are rejected.

### Frontend coverage labels

- **IMPLEMENTED:** the Phase 1 frontend has a real client call and a consuming component.
- **PARTIALLY IMPLEMENTED:** shared client infrastructure exists, but no endpoint-specific function/page consumes the contract.
- **FRONTEND MISSING:** backend contract exists, but no frontend function/page consumes it.
- **BACKEND MISSING:** the V1 page plan requires a capability not found in the inspected backend.
- **BLOCKED:** the contract exists but cannot be used without required auth/data/configuration.
- **NOT REQUIRED FOR V1:** not required by the audited V1 page plan, though it exists in the backend.

The generic `apiClient` supports HTTP verbs but is not counted as an endpoint-specific function. Only `useAuth` calling `/auth/me` is counted as consumed.

## Exhaustive endpoint inventory

The `/:businessId/:resource` CRUD rows below expand to the exact method/path combinations listed in the **Methods** column. Each method is one endpoint.

### Authentication, user, profile, and business administration

| Methods and exact path | Auth/RBAC | Request | Response | Frontend / DB / status |
|---|---|---|---|---|
| `GET /api/v1/auth/me` | Auth; no additional permission | None | `{ data: { user, profile, memberships } }` | Auth state; real DB user/profile/memberships; **IMPLEMENTED** |
| `POST /api/v1/auth/invitations/accept` | Auth; accepts current user’s invitation | `{ token }` | `{ data: { invitation, membership } }` | Invitation acceptance; real DB mutation; **FRONTEND MISSING** |
| `GET /api/v1/users/me` | Auth | None | `{ data: user }` | Customer profile / account; real DB; **FRONTEND MISSING** |
| `PATCH /api/v1/users/me` | Auth | Optional strict fields: `firstName`, `lastName`, `phone`, `avatarUrl`, `status` | `{ data: user }` | Customer profile / account; real DB mutation; **FRONTEND MISSING** |
| `GET /api/v1/users/:userId` | Auth + global `users.read` + shared-business access | Path `userId` UUID | `{ data: user }` | Admin/user management; real DB; **FRONTEND MISSING** |
| `GET /api/v1/profiles/me` | Auth | None | `{ data: profile }` | Customer profile; real DB; **FRONTEND MISSING** |
| `PATCH /api/v1/profiles/me` | Auth | Optional strict fields: `bio`, `timezone`, `locale`, `dateOfBirth` | `{ data: profile }` | Customer profile; real DB mutation; **FRONTEND MISSING** |
| `GET /api/v1/profiles/:userId` | Auth + global `profiles.read` + shared-business access | Path `userId` UUID | `{ data: profile }` | Admin/user management; real DB; **FRONTEND MISSING** |
| `GET /api/v1/businesses` | Auth + global `businesses.read` | Query: `page`, `pageSize`, `status`, `businessTypeId`, `search` | Paginated businesses | Owner dashboard / business listing; real DB; **FRONTEND MISSING** |
| `POST /api/v1/businesses` | Auth + global `businesses.create` | `businessTypeId`, `name`, `slug`; optional `description`, `email`, `phone`, `websiteUrl`, `logoUrl`, `status` | Created business | Business onboarding; real DB mutation; **FRONTEND MISSING** |
| `GET /api/v1/businesses/:businessId` | Auth + business `businesses.read` | Path `businessId` UUID | `{ data: business }` | Business profile; real DB; **FRONTEND MISSING** |
| `PATCH /api/v1/businesses/:businessId` | Auth + business `businesses.update` | Any subset of business create fields | `{ data: business }` | Business profile; real DB mutation; **FRONTEND MISSING** |
| `GET /api/v1/businesses/:businessId/settings` | Auth + `business_settings.read` | Path `businessId` UUID | `{ data: settings }` | Business settings; real DB; **FRONTEND MISSING** |
| `PATCH /api/v1/businesses/:businessId/settings` | Auth + `business_settings.update` | Optional: `currency`, `timezone`, `bookingEnabled`, `quoteEnabled` | `{ data: settings }` | Business settings; real DB mutation; **FRONTEND MISSING** |
| `GET /api/v1/businesses/:businessId/locations` | Auth + `locations.read` | Path + pagination | Paginated locations | Locations; real DB; **FRONTEND MISSING** |
| `POST /api/v1/businesses/:businessId/locations` | Auth + `locations.create` | `name`, `addressLine1`, `city`, `country`; optional address/contact/coordinates/flags | Created location | Locations; real DB mutation; **FRONTEND MISSING** |
| `GET /api/v1/businesses/:businessId/locations/:locationId` | Auth + `locations.read` | Path UUIDs | `{ data: location }` | Location detail; real DB; **FRONTEND MISSING** |
| `PATCH /api/v1/businesses/:businessId/locations/:locationId` | Auth + `locations.update` | Any subset of location fields | `{ data: location }` | Locations; real DB mutation; **FRONTEND MISSING** |
| `DELETE /api/v1/businesses/:businessId/locations/:locationId` | Auth + `locations.delete` | Path UUIDs | Empty `204` | Locations; real DB mutation; **FRONTEND MISSING** |
| `GET /api/v1/businesses/:businessId/hours` | Auth + `hours.read` | Path + pagination | Paginated hours | Opening hours; real DB; **FRONTEND MISSING** |
| `POST /api/v1/businesses/:businessId/hours` | Auth + `hours.create` | `dayOfWeek`; optional `locationId`, `opensAt`, `closesAt`, `isClosed` | Created hours row | Opening hours; real DB mutation; **FRONTEND MISSING** |
| `PATCH /api/v1/businesses/:businessId/hours/:hoursId` | Auth + `hours.update` | Any subset of hours fields | `{ data: hours }` | Opening hours; real DB mutation; **FRONTEND MISSING** |
| `DELETE /api/v1/businesses/:businessId/hours/:hoursId` | Auth + `hours.delete` | Path UUIDs | Empty `204` | Opening hours; real DB mutation; **FRONTEND MISSING** |
| `GET /api/v1/businesses/:businessId/holidays` | Auth + `holidays.read` | Path + pagination | Paginated holidays | Holidays; real DB; **FRONTEND MISSING** |
| `POST /api/v1/businesses/:businessId/holidays` | Auth + `holidays.create` | `date`, `name`; optional `isClosed` | Created holiday | Holidays; real DB mutation; **FRONTEND MISSING** |
| `PATCH /api/v1/businesses/:businessId/holidays/:holidayId` | Auth + `holidays.update` | Any subset of holiday fields | `{ data: holiday }` | Holidays; real DB mutation; **FRONTEND MISSING** |
| `DELETE /api/v1/businesses/:businessId/holidays/:holidayId` | Auth + `holidays.delete` | Path UUIDs | Empty `204` | Holidays; real DB mutation; **FRONTEND MISSING** |

### Memberships, invitations, and access control

| Methods and exact path | Auth/RBAC | Request | Response | Frontend / DB / status |
|---|---|---|---|---|
| `GET /api/v1/businesses/:businessId/memberships` | Auth + `memberships.read` | Path + pagination; filters supported by implementation | Paginated memberships | Memberships; real DB; **FRONTEND MISSING** |
| `POST /api/v1/businesses/:businessId/memberships` | Auth + `memberships.create` | `userId`, `roleId`; optional `status` | Created membership | Memberships; real DB mutation; **FRONTEND MISSING** |
| `PATCH /api/v1/businesses/:businessId/memberships/:membershipId` | Auth + `memberships.update` | Optional `roleId`, `status` | `{ data: membership }` | Memberships; real DB mutation; **FRONTEND MISSING** |
| `DELETE /api/v1/businesses/:businessId/memberships/:membershipId` | Auth + `memberships.delete` | Path UUIDs | Empty `204` | Memberships; real DB mutation; **FRONTEND MISSING** |
| `GET /api/v1/businesses/:businessId/invitations` | Auth + `invitations.read` | Path + pagination | Paginated invitations | Invitations; real DB; **FRONTEND MISSING** |
| `POST /api/v1/businesses/:businessId/invitations` | Auth + `invitations.create` | `email`, `roleId`, `expiresAt` | Created invitation | Invitations; real DB mutation; **FRONTEND MISSING** |
| `GET /api/v1/businesses/:businessId/invitations/:invitationId` | Auth + `invitations.read` | Path UUIDs | `{ data: invitation }` | Invitations; real DB; **FRONTEND MISSING** |
| `PATCH /api/v1/businesses/:businessId/invitations/:invitationId/revoke` | Auth + `invitations.update` | Path UUIDs | `{ data: invitation }` | Invitations; real DB mutation; **FRONTEND MISSING** |
| `GET /api/v1/roles` | Auth + global `roles.read` | Query pagination | Paginated roles | Roles; real DB; **FRONTEND MISSING** |
| `POST /api/v1/roles` | Auth + global `roles.create` | `name`; optional `description` | Created role | Roles; real DB mutation; **FRONTEND MISSING** |
| `GET /api/v1/roles/:roleId` | Auth + global `roles.read` | Path `roleId` UUID | `{ data: role }` | Roles; real DB; **FRONTEND MISSING** |
| `PATCH /api/v1/roles/:roleId` | Auth + global `roles.update` | Optional `name`, `description` | `{ data: role }` | Roles; real DB mutation; **FRONTEND MISSING** |
| `DELETE /api/v1/roles/:roleId` | Auth + global `roles.delete` | Path `roleId` UUID | Empty `204` | Roles; real DB mutation; **FRONTEND MISSING** |
| `PUT /api/v1/roles/:roleId/permissions` | Auth + global `roles.permissions.update` | `{ permissionIds: UUID[] }` | `{ data: roleWithPermissions }` | Roles/permissions; real DB mutation; **FRONTEND MISSING** |
| `GET /api/v1/permissions` | Auth + global `permissions.read` | Query pagination | Paginated permissions | Permissions; real DB; **FRONTEND MISSING** |
| `POST /api/v1/permissions` | Auth + global `permissions.create` | `key`; optional `description` | Created permission | Permissions; real DB mutation; **FRONTEND MISSING** |
| `GET /api/v1/permissions/:permissionId` | Auth + global `permissions.read` | Path `permissionId` UUID | `{ data: permission }` | Permissions; real DB; **FRONTEND MISSING** |
| `DELETE /api/v1/permissions/:permissionId` | Auth + global `permissions.delete` | Path `permissionId` UUID | Empty `204` | Permissions; real DB mutation; **FRONTEND MISSING** |

### Generated business resource CRUD endpoints

Each row is expanded by the backend dispatcher into the exact listed paths. List endpoints accept `page` and `pageSize` plus the resource-specific filters shown. `GET` list returns paginated data; `POST` returns `201`; item `GET`/`PATCH` return `{ data: record }`; `DELETE` returns `204`. All use real Prisma records and require the permission shown.

| Resource and exact paths | Methods | Request fields / query filters | RBAC | Frontend / status |
|---|---|---|---|---|
| Services: `/api/v1/businesses/:businessId/services` and `/api/v1/businesses/:businessId/services/:serviceId` | `GET, POST, PATCH, DELETE` | Create: `name`, `slug`, `durationMinutes`, `price`; optional `categoryId`, `description`, `currency`, `status`, `sortOrder`. List filters: `status`, `categoryId`, `search`. Update is partial. | `services.read/create/update/delete` | Services; **FRONTEND MISSING** |
| Service categories: `/api/v1/businesses/:businessId/service-categories` and `/api/v1/businesses/:businessId/service-categories/:categoryId` | `GET, POST, PATCH, DELETE` | Create: `name`, `slug`; optional `description`, `sortOrder`, `isActive`. List filters: `isActive`, `search`. | `service_categories.read/create/update/delete` | Service/category discovery; **FRONTEND MISSING** |
| Staff: `/api/v1/businesses/:businessId/staff` and `/api/v1/businesses/:businessId/staff/:staffId` | `GET, POST, PATCH, DELETE` | Create: `firstName`; optional `userId`, `lastName`, `email`, `phone`, `title`, `bio`, `avatarUrl`, `status`. List filters: `status`, `search`. | `staff.read/create/update/delete` | Staff; **FRONTEND MISSING** |
| Customers: `/api/v1/businesses/:businessId/customers` and `/api/v1/businesses/:businessId/customers/:customerId` | `GET, POST, PATCH, DELETE` | Create: `firstName`; optional `lastName`, `email`, `phone`, `status`. List filters: `status`, `email`, `phone`, `search`. | `customers.read/create/update/delete` | Customers; **FRONTEND MISSING** |
| Bookings: `/api/v1/businesses/:businessId/bookings` and `/api/v1/businesses/:businessId/bookings/:bookingId` | `GET, POST, PATCH, DELETE` | Create: `customerId`, ISO `startsAt`, ISO `endsAt`, `items[]`; optional `locationId`, `staffId`, `status`, `source`, `customerNote`. List filters: `status`, `customerId`, `staffId`, `locationId`, `source`, `from`, `to`. | `bookings.read/create/update/delete` | Booking operations; **FRONTEND MISSING** |
| Quote requests: `/api/v1/businesses/:businessId/quote-requests` and `/api/v1/businesses/:businessId/quote-requests/:quoteRequestId` | `GET, POST, PATCH, DELETE` | Create: `customerId`, `title`, `description`; optional `status`. List filters: `status`, `customerId`, `from`, `to`. | `quote_requests.read/create/update/delete` | Quote request flow; **FRONTEND MISSING** |
| Quotes: `/api/v1/businesses/:businessId/quotes` and `/api/v1/businesses/:businessId/quotes/:quoteId` | `GET, POST, PATCH, DELETE` | Create: `quoteRequestId`, `quoteNumber`, `subtotal`, `total`, `items[]`; optional `status`, `currency`, `validUntil`, `notes`. List filters: `status`, `quoteRequestId`, `from`, `to`. Update is partial. | `quotes.read/create/update/delete` | Quotes; **FRONTEND MISSING** |
| Reviews: `/api/v1/businesses/:businessId/reviews` and `/api/v1/businesses/:businessId/reviews/:reviewId` | `GET, POST, PATCH, DELETE` | Create: `customerId`, `rating`; optional `bookingId`, `title`, `content`, `status`. List filters: `status`, `customerId`, `bookingId`. | `reviews.read/create/update/delete` | Reviews; **FRONTEND MISSING** |
| Media: `/api/v1/businesses/:businessId/media` and `/api/v1/businesses/:businessId/media/:mediaId` | `GET, POST, PATCH, DELETE` | Create: `bucket`, `path`, `fileName`; optional `mimeType`, `sizeBytes`, `altText`. List filters: `bucket`, `mimeType`, `search`. | `media.read/create/update/delete` | Business media; **NOT REQUIRED FOR V1** |
| Audit logs: `/api/v1/businesses/:businessId/audit-logs` and `/api/v1/businesses/:businessId/audit-logs/:auditLogId` | `GET` only | List filters: `actorId`, `actorType`, `action`, `entityType`, `entityId`, `from`, `to`. `POST`, `PATCH`, and `DELETE` are not supported and return `404`. | `audit_logs.read` | Administration/audit; **NOT REQUIRED FOR V1** |

The generated resource rows account for **47 endpoints**: 5 methods each for seven resources (services, service-categories, staff, customers, bookings, quote-requests, quotes, reviews, media = 45) plus 2 audit-log read methods.  

### Relationship, scheduling, and workflow endpoints

| Methods and exact path | Auth/RBAC | Request | Response | Frontend / status |
|---|---|---|---|---|
| `PUT /api/v1/businesses/:businessId/services/:serviceId/locations` | Auth + `services.update` | `{ locationIds: UUID[] }` | `{ data: links }` | Service locations; **FRONTEND MISSING** |
| `PUT /api/v1/businesses/:businessId/services/:serviceId/staff` | Auth + `services.update` | `{ staffIds: UUID[] }` | `{ data: links }` | Service staff; **FRONTEND MISSING** |
| `PUT /api/v1/businesses/:businessId/staff/:staffId/locations` | Auth + `staff.update` | `{ locationIds: UUID[] }` | `{ data: links }` | Staff locations; **FRONTEND MISSING** |
| `PUT /api/v1/businesses/:businessId/staff/:staffId/services` | Auth + `staff.update` | `{ serviceIds: UUID[] }` | `{ data: links }` | Staff services; **FRONTEND MISSING** |
| `GET /api/v1/businesses/:businessId/staff/:staffId/availability` | Auth + `staff.read` | Path + pagination | Paginated availability | Staff availability; **FRONTEND MISSING** |
| `POST /api/v1/businesses/:businessId/staff/:staffId/availability` | Auth + `staff.update` | `dayOfWeek`, `startsAt`, `endsAt`; optional `isActive` | Created availability | Staff availability; **FRONTEND MISSING** |
| `PATCH /api/v1/businesses/:businessId/staff/:staffId/availability/:availabilityId` | Auth + `staff.update` | Partial availability fields | `{ data: availability }` | Staff availability; **FRONTEND MISSING** |
| `DELETE /api/v1/businesses/:businessId/staff/:staffId/availability/:availabilityId` | Auth + `staff.update` | Path UUIDs | Empty `204` | Staff availability; **FRONTEND MISSING** |
| `GET /api/v1/businesses/:businessId/staff/:staffId/time-off` | Auth + `staff.read` | Path + pagination | Paginated time-off rows | Staff time-off; **FRONTEND MISSING** |
| `POST /api/v1/businesses/:businessId/staff/:staffId/time-off` | Auth + `staff.update` | ISO `startsAt`, ISO `endsAt`; optional `reason` | Created time-off | Staff time-off; **FRONTEND MISSING** |
| `PATCH /api/v1/businesses/:businessId/staff/:staffId/time-off/:timeOffId` | Auth + `staff.update` | Partial time-off fields | `{ data: timeOff }` | Staff time-off; **FRONTEND MISSING** |
| `DELETE /api/v1/businesses/:businessId/staff/:staffId/time-off/:timeOffId` | Auth + `staff.update` | Path UUIDs | Empty `204` | Staff time-off; **FRONTEND MISSING** |
| `GET /api/v1/businesses/:businessId/customers/:customerId/addresses` | Auth + `customers.read` | Path + pagination | Paginated addresses | Customer addresses; **FRONTEND MISSING** |
| `POST /api/v1/businesses/:businessId/customers/:customerId/addresses` | Auth + `customers.update` | `addressLine1`, `city`, `country`; optional label/address/state/postal/isPrimary | Created address | Customer addresses; **FRONTEND MISSING** |
| `PATCH /api/v1/businesses/:businessId/customers/:customerId/addresses/:addressId` | Auth + `customers.update` | Partial address fields | `{ data: address }` | Customer addresses; **FRONTEND MISSING** |
| `DELETE /api/v1/businesses/:businessId/customers/:customerId/addresses/:addressId` | Auth + `customers.update` | Path UUIDs | Empty `204` | Customer addresses; **FRONTEND MISSING** |
| `GET /api/v1/businesses/:businessId/customers/:customerId/notes` | Auth + `customers.read` | Path + pagination | Paginated notes | Customer notes; **FRONTEND MISSING** |
| `POST /api/v1/businesses/:businessId/customers/:customerId/notes` | Auth + `customers.update` | `{ content }` | Created note | Customer notes; **FRONTEND MISSING** |
| `DELETE /api/v1/businesses/:businessId/customers/:customerId/notes/:noteId` | Auth + `customers.update` | Path UUIDs | Empty `204` | Customer notes; **FRONTEND MISSING** |
| `GET /api/v1/businesses/:businessId/customers/:customerId/preferences` | Auth + `customers.read` | Path UUIDs | `{ data: preferences }` | Customer preferences; **FRONTEND MISSING** |
| `PUT /api/v1/businesses/:businessId/customers/:customerId/preferences` | Auth + `customers.update` | Optional `notes`, `preferredStaffId`, `preferredContactMethod` | `{ data: preferences }` | Customer preferences; **FRONTEND MISSING** |
| `GET /api/v1/businesses/:businessId/bookings/:bookingId/items` | Auth + `bookings.read` | Path UUIDs | Paginated/listed items | Booking items; **FRONTEND MISSING** |
| `POST /api/v1/businesses/:businessId/bookings/:bookingId/items` | Auth + `bookings.update` | `serviceId`, `serviceName`, `durationMinutes`, `unitPrice`, `quantity` | Created item | Booking items; **FRONTEND MISSING** |
| `PATCH /api/v1/businesses/:businessId/bookings/:bookingId/items/:itemId` | Auth + `bookings.update` | Partial booking item fields | `{ data: item }` | Booking items; **FRONTEND MISSING** |
| `DELETE /api/v1/businesses/:businessId/bookings/:bookingId/items/:itemId` | Auth + `bookings.update` | Path UUIDs | Empty `204` | Booking items; **FRONTEND MISSING** |
| `GET /api/v1/businesses/:businessId/bookings/:bookingId/status-history` | Auth + `bookings.read` | Path + pagination | Paginated status history | Booking history; **FRONTEND MISSING** |
| `PATCH /api/v1/businesses/:businessId/bookings/:bookingId/status` | Auth + `bookings.status.update` | `{ toStatus, reason? }` | `{ data: result }` | Booking status; **FRONTEND MISSING** |
| `GET /api/v1/businesses/:businessId/quotes/:quoteId/items` | Auth + `quotes.read` | Path + pagination | Paginated items | Quote items; **FRONTEND MISSING** |
| `POST /api/v1/businesses/:businessId/quotes/:quoteId/items` | Auth + `quotes.update` | `description`, `quantity`, `unitPrice`, `total`; optional `serviceId` | Created item | Quote items; **FRONTEND MISSING** |
| `PATCH /api/v1/businesses/:businessId/quotes/:quoteId/items/:itemId` | Auth + `quotes.update` | Partial quote item fields | `{ data: item }` | Quote items; **FRONTEND MISSING** |
| `DELETE /api/v1/businesses/:businessId/quotes/:quoteId/items/:itemId` | Auth + `quotes.update` | Path UUIDs | Empty `204` | Quote items; **FRONTEND MISSING** |
| `GET /api/v1/businesses/:businessId/reviews/:reviewId/response` | Auth + `review_responses.read` | Path UUIDs | `{ data: response }` | Review response; **FRONTEND MISSING** |
| `PUT /api/v1/businesses/:businessId/reviews/:reviewId/response` | Auth + `review_responses.update` | `{ content }` | `{ data: response }` | Review response; **FRONTEND MISSING** |
| `DELETE /api/v1/businesses/:businessId/reviews/:reviewId/response` | Auth + `review_responses.delete` | Path UUIDs | Empty `204` | Review response; **FRONTEND MISSING** |

These relationship/workflow rows account for **34 explicit endpoints**. The remaining **10 explicit endpoints** are the roles and permissions routes listed in the access-control table. Together with the other 35 explicit routes and 47 generated CRUD routes, this produces the 126-endpoint total.

## Frontend page mapping

### Authentication pages

| Planned page | Existing supported flow | Audit result |
|---|---|---|
| `/auth/login` | No `/api/v1` login endpoint. Existing server auth validates Supabase bearer tokens; sign-in must use the existing Supabase client flow when a client provider is introduced. | **BACKEND MISSING as an API route; direct Supabase flow required** |
| `/auth/register` | No `/api/v1` registration endpoint. Registration must be a direct Supabase operation if enabled by the existing project configuration. | **BACKEND MISSING as an API route; direct Supabase flow required** |
| `/auth/forgot-password` | No `/api/v1` endpoint. Password reset request is a direct Supabase auth operation if enabled. | **BACKEND MISSING as an API route; direct Supabase flow required** |
| `/auth/reset-password` | No `/api/v1` endpoint. Password update is a direct Supabase auth operation if enabled. | **BACKEND MISSING as an API route; direct Supabase flow required** |
| `/auth/invitations/accept` | `POST /api/v1/auth/invitations/accept` exists and requires an authenticated bearer token plus a token body. | **FRONTEND MISSING** |

### Public/customer pages

| Planned area | Available existing contracts | Result |
|---|---|---|
| Landing/home | No public data contract required; Phase 1 overview exists. | **IMPLEMENTED foundation only** |
| Service/category discovery | Business-scoped authenticated CRUD exists for services/categories. No public/customer discovery route exists. | **BACKEND MISSING for public flow** |
| Business listing/detail | Authenticated business list/detail exists; neither is public. | **PARTIALLY IMPLEMENTED backend only; public flow BACKEND MISSING** |
| Service detail/selection | Business-scoped service CRUD exists; no public selection contract. | **BACKEND MISSING for public flow** |
| Availability | Staff availability/time-off exists for business operators; no booking availability calculation endpoint exists. | **BACKEND MISSING** |
| Booking/request flow | Business-scoped booking creation exists and requires an existing customer, services, and business permission. | **PARTIALLY IMPLEMENTED backend only; customer flow BACKEND MISSING** |
| Customer bookings/profile/addresses/notes/preferences | Operator-scoped customer and booking contracts exist; no customer-self-scoped contracts exist. | **BACKEND MISSING for customer-self flow** |
| Quotes | Operator-scoped quote request/quote contracts exist; no customer-self quote flow exists. | **BACKEND MISSING for customer-self flow** |
| Reviews | Operator CRUD and operator response contracts exist; no public/customer submission or publication contract exists. | **BACKEND MISSING for customer/public flow** |

### Business owner pages

Dashboard, business profile, settings, locations, opening hours, holidays, services, staff, staff availability/time-off, customers, bookings, booking items/history/status, quotes/items, reviews/responses, memberships, invitations, roles, and permissions all have backend contracts as listed above. None currently has a frontend page or endpoint-specific client function, so each is **FRONTEND MISSING**.

## Contract inconsistencies and compatibility findings

1. **Next 16 route params compatibility:** `app/api/v1/[...segments]/route.ts` originally read `context.params` synchronously. It was updated to await the Promise-shaped params required by Next 16. This is a compatibility-only fix; backend routing behavior is unchanged.
2. **Authentication client/server boundary:** `apiClient` sends same-origin credentials, but the existing server authentication helper only reads a bearer token. A future real Supabase client integration must attach the session access token; cookies alone will not authenticate these API calls.
3. **Invitation acceptance is authenticated:** the invitation acceptance endpoint cannot bootstrap an unauthenticated user because all V1 routes require auth. The frontend flow must establish a Supabase session before calling it.
4. **Business routes are not public:** `GET /businesses`, business detail, service, category, and review routes all pass through auth/RBAC. They cannot power anonymous marketplace pages as currently implemented.
5. **No availability calculation endpoint:** staff schedules and time-off can be read, but there is no endpoint that returns bookable slots or detects booking conflicts for a customer flow.
6. **No frontend endpoint-specific wrappers:** only the generic HTTP client and `/auth/me` hook exist. This is intentional for the audit; no speculative endpoint wrappers were added.

## Requested final answers

1. **Total backend endpoints discovered:** 126.
2. **Total endpoints already consumed by frontend:** 1.
3. **Total endpoints not yet consumed:** 125.
4. **Missing backend endpoints:** public business/service/category discovery and detail, availability/slot calculation, customer-self profile/bookings/addresses/notes/preferences, customer booking/request, customer quotes, and public/customer reviews. Exact paths are intentionally not invented.
5. **Authentication endpoints/flows:** `/auth/me` and authenticated invitation acceptance exist in `/api/v1`; login, registration, forgot-password, and reset-password are direct Supabase flows rather than existing API routes.
6. **Pages required for V1:** auth pages above; public landing/discovery/business/service/availability/booking/customer/quote/review areas; business owner dashboard and management areas listed above.
7. **Pages already implemented:** Phase 1 responsive foundation overview at `/`; no business/customer feature pages.
8. **Pages still missing:** all feature pages and all auth pages, except the foundation overview.
9. **API contract inconsistencies:** bearer-token-only server auth versus credential-only generic client; operator-only scoping for routes that the public/customer plan would need; invitation acceptance requiring auth.
10. **Compatibility problems:** the Next 16 catch-all `params` Promise issue was fixed. No remaining build/type compatibility issue was found.
11. **Work requiring backend changes:** public/customer access, availability calculation, and customer-self flows require new backend contracts or an explicitly approved change to authorization/scoping. This audit does not implement them.

## Intentionally not changed

- No Phase 2 pages or feature UI were built.
- No Prisma model or database schema was changed.
- No API endpoint was invented.
- No mock database records, fake authentication, or placeholder API response was added.
- No backend authorization behavior was changed.