# V2 Progress

## Completed

- Replaced the root operator dashboard with a customer/general Mirr service-hub homepage.
- Added customer navigation, authenticated welcome state, account/profile route, and Start Your Business CTA.
- Added `/dashboard` business-owner portal with active-business context, real business data, real counts, empty states, and owner navigation.
- Added `/dashboard/onboarding` using real `GET /business-types` and `POST /businesses` API calls.
- Added a structured platform admin surface using real roles, permissions, and selected-business AuditLog activity.
- Added dark/light responsive styling for customer, onboarding, owner, account, and admin experiences.
- Added API limitation documentation in `docs/v2-api-gaps.md`.
- Updated `/auth/me` application user payload to include existing name/contact fields for real display.

## Business-owner lifecycle completed

- `POST /api/v1/businesses` now runs in a transaction.
- It resolves the existing global `OWNER` role by name, creates the Business, active creator membership, default BusinessSettings, and Business/Audit membership records.
- If the canonical OWNER role is missing, the transaction rolls back with a clear `OWNER_ROLE_NOT_CONFIGURED` conflict.
- Onboarding refreshes `/auth/me`, selects the new business in the existing tenant provider, confirms active OWNER membership, and then creates missing location, hours, and service records.
- Onboarding persists the created business ID locally and resumes from real API state without deleting partial work.

## Remaining

- Public discovery routes for anonymous business/service/category browsing.
- Customer-self booking, quote, review, and booking-history routes.
- Availability/slot calculation contract.
- Global platform audit/activity route if activity must span all businesses.

## Files changed

- `app/page.tsx`
- `app/dashboard/page.tsx`
- `app/dashboard/onboarding/page.tsx`
- `app/account/page.tsx`
- `app/globals.css`
- `src/components/app-shell.tsx`
- `src/components/feature/admin-page.tsx`
- `src/components/v2/customer-home.tsx`
- `src/components/v2/owner-dashboard.tsx`
- `src/components/v2/business-onboarding.tsx`
- `src/components/v2/account-page.tsx`
- `src/hooks/use-auth.tsx`
- `src/server/api/auth.ts`
- `src/server/api/v1/routes.ts`
- `docs/v2-api-gaps.md`

## API routes consumed

- `GET /api/v1/auth/me`
- `GET /api/v1/business-types`
- `GET /api/v1/business-types` is authenticated-read-only so a new provisioned user without memberships can start onboarding.
- `POST /api/v1/businesses`
- `POST /api/v1/businesses` response: `{ data: { business, membership, settings } }`
- `GET /api/v1/businesses/:businessId`
- `GET /api/v1/businesses/:businessId/bookings`
- `GET /api/v1/businesses/:businessId/customers`
- `GET /api/v1/businesses/:businessId/services`
- `GET /api/v1/businesses/:businessId/reviews`
- `GET /api/v1/businesses/:businessId/audit-logs`
- `GET/PATCH /api/v1/users/me`
- `GET/PATCH /api/v1/profiles/me`
- Direct Supabase Auth flows remain in the existing auth panel.

## Verification

- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm run build`: blocked before compilation because the available runtime is Node 18.19.1 and Next 16 requires Node >=20.9.0. No compatible Node 20/22 binary or nvm installation is available in the environment.
- Automated tests: none found.
- No Prisma schema/database changes.
