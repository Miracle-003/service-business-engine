# V2 API Gaps

## Public discovery

- Desired capability: anonymous business, category, and service discovery from `/`.
- Existing relevant routes: authenticated business-scoped CRUD under `/api/v1/businesses/:businessId/...`.
- Why it cannot safely be used: every V1 request requires a Supabase bearer token and business membership/RBAC; it cannot serve anonymous marketplace discovery.
- Exact backend capability required: a product-approved public discovery contract with tenant-safe read-only business, service category, and service queries. No path is invented here.
- Frontend status: customer discovery shell implemented; no fake catalog data rendered.

## Customer self-service

- Desired capability: customer-owned bookings, booking history, quotes, and reviews.
- Existing relevant routes: operator-scoped business routes for bookings, quotes, reviews, and customers.
- Why it cannot safely be used: those routes require business membership permissions and do not scope records to the authenticated customer.
- Exact backend capability required: product-approved customer-self authorization and routes. No path is invented here.
- Frontend status: customer home and account surfaces implemented; unsupported workflows are documented rather than fabricated.

## Availability calculation

- Desired capability: bookable appointment slots.
- Existing relevant routes: staff availability and time-off CRUD for business operators.
- Why it cannot safely be used: the existing contract does not calculate slots or enforce booking conflict rules for a customer journey.
- Exact backend capability required: a scheduling/availability calculation contract using BusinessHours, StaffAvailability, StaffTimeOff, Bookings, and service duration.
- Frontend status: no fake availability UI implemented.

## Business onboarding membership

- Status: implemented for the existing schema/data model.
- Existing route: `POST /api/v1/businesses` now resolves the existing global `Role` named `OWNER` and transactionally creates the Business, active creator membership, default BusinessSettings, and audit records.
- Security behavior: this self-membership path exists only inside business creation. Existing membership-management permissions remain unchanged, and clients cannot choose a role ID for this path.
- Operational prerequisite: the database must contain the canonical `OWNER` role. If it is absent, the transaction rolls back with `OWNER_ROLE_NOT_CONFIGURED`; no role or UUID is invented.
- Frontend status: onboarding refreshes `/auth/me`, selects the new active business, confirms the active OWNER membership, and then writes location, hours, and service records.

## Platform activity

- Desired capability: platform-wide admin activity.
- Existing relevant route: business-scoped `GET /api/v1/businesses/:businessId/audit-logs`.
- Why it cannot safely be used globally: the existing API has no global audit-log list route; activity can only be displayed for a selected business.
- Exact backend capability required: an approved platform-admin audit/activity contract or a documented global-audit authorization rule.
- Frontend status: `/admin` shows real AuditLog activity for the selected business and clearly labels its scope.
