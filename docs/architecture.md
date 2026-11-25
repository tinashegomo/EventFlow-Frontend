# EventFlow — System Architecture

This document describes the **current** full-stack architecture of EventFlow. It replaces
earlier documents that described superseded designs (a localStorage-only prototype and a
Firestore-based v1). The system today is a React SPA plus a Spring Boot REST API backed by
MySQL.

---

## 1. System Overview

```
┌────────────────────────┐        HTTPS / JSON         ┌─────────────────────────────┐
│  Frontend (React SPA)  │ ──────────────────────────▶ │  Backend (Spring Boot 3)    │
│  Vite · Tailwind · PWA │ ◀────────────────────────── │  REST /api/eventflow/**     │
│  JWT in localStorage   │        JWT Bearer auth      │  Spring Security + JWT      │
└────────────────────────┘                             └──────────────┬──────────────┘
         │                                                            │ JPA / Hibernate
         │ Firebase Cloud Messaging (push only)                       ▼
         ▼                                                   ┌─────────────────┐
   Firebase project                                          │      MySQL      │
   (FCM tokens, web push)                                    │   (eventflow)   │
                                                             └─────────────────┘
```

- **Frontend** (`frontend/`): React 19 SPA. Presentation, forms, routing, client-side PDF
  export, PWA shell. Holds no business logic of record.
- **Backend** (`backend/EventManagementSystem/`): Spring Boot 3 / Java 21, package root
  `com.tinasheGomo.EventManagementSystem`, layered as
  `controller / service / repository / mapper / dto / entity / enums / security /
  exception / config`, plus `service/scheduler` for background jobs.
- **Database**: MySQL. Schema managed by Hibernate (`ddl-auto=update` in dev,
  `validate` in prod).

## 2. Multi-Tenancy Model

Organizations are the top-level data boundary. Every domain entity
(events, event types, inventory, quotations, invoices, users, audit logs) belongs to
exactly one organization.

- API paths are org-scoped: `/api/eventflow/organizations/{orgId}/…`.
- Tenant isolation is enforced **server-side** by `SecurityUtils.requireOrgAccess(orgId)`
  and `SecurityUtils.requireResourceAccess(entity.getOrganization(), …)`. A request that
  references a foreign organization raises `AccessDeniedException` → HTTP 403.
- Frontend route guards and hidden buttons are UX only, never security controls.

## 3. Authentication & Authorization

- Backend-local accounts: email + BCrypt password (`/api/eventflow/auth/register`,
  `/login`, `/me`). There is no Firebase Auth.
- On login the backend returns a JWT (subject = email) plus the user and organization
  payload. The SPA stores `ef_jwt_token` and `ef_org_id` in `localStorage` and attaches
  `Authorization: Bearer <token>` to every request (`frontend/src/api/client.js`).
- `AuthFilter` validates the token per request. Expired/tampered tokens are caught
  (`JwtException | IllegalArgumentException | UsernameNotFoundException`) and the security
  context is cleared, so the request proceeds unauthenticated.
- `RestAuthenticationEntryPoint` answers unauthenticated requests with a JSON **401**
  (`errorCode: UNAUTHORIZED`) in the same `ErrorResponse` shape as the
  `GlobalExceptionHandler`. `RestAccessDeniedHandler` answers forbidden requests with a
  JSON **403** (`errorCode: FORBIDDEN`).
- Frontend behaviour: **401** → clear session, redirect to `/login`; **403** → keep the
  session, show an access-denied error.
- Roles: `ADMIN` and `STAFF` (`UserRole` enum). Admin-only endpoints (e.g. user
  management) use `@PreAuthorize("hasRole('ADMIN')")`.
- Role changes (`PUT /organizations/{orgId}/users/{userId}/role`) are transactional,
  verify that the target user belongs to the path organization, and refuse to demote the
  last remaining ADMIN.

## 4. Document Lifecycle (Quotations & Invoices)

- **Numbering is server-side.** `CounterService.getNextNumber(orgId, prefix)` allocates
  `QUO-…`/`INV-…` numbers inside the create transaction. The former client-visible
  `/next-number` endpoints were removed so numbers can never be pre-allocated or reused by
  a browser.
- **Totals are server-side.** Clients send line items, `discountPercent` and `taxPercent`;
  the service recomputes subtotal/discount/tax/total. Client-sent totals are ignored.
- **Quotation → invoice conversion is transactional.** `InvoiceService.create` with a
  `quotationId` marks the source quotation `CONVERTED`, sets `convertedToInvoiceId`, and
  creates the invoice in one transaction. The frontend performs no follow-up writes.
- **Date-driven statuses are maintained by a scheduler.**
  `DocumentStatusScheduler` (`service/scheduler`) runs daily at 00:05
  (cron override: `app.scheduler.document-status-cron`) and:
  - marks `SENT`/`DRAFT` invoices with a past `dueDate` as `OVERDUE`;
  - marks `DRAFT`/`SENT` quotations with a past `validUntil` as `EXPIRED`.
  These service methods are `@Transactional` and deliberately cross-organization — the
  scheduler runs without an authenticated user.
- Line item shapes: quotation lines carry inventory snapshots
  (`inventoryItemId`, `snapshotName`, `snapshotSize`, `snapshotPrice`, `quantity`);
  invoice lines carry free text (`description`, `quantity`, `unitPrice`).

## 5. Events

- Events reference an event type and price either by tier (`priceMode=TIER` +
  `selectedPricingTierId`, price resolved from the tier) or custom
  (`priceMode=CUSTOM` + `customPrice`). `EventService.resolveTotalPrice` enforces this on
  both create and update.
- Attached inventory items are snapshot-copied onto the event
  (`applyAttachedItems`, orphanRemoval-managed collection) so later inventory edits do not
  rewrite history.
- Payments are a child collection; the initial deposit creates the first payment. The
  payments list is a mutable `ArrayList` so `recordPayment`/`removePayment` can mutate it.

## 6. Audit Trail

- The backend writes an `AuditLogEntity` for every mutation from the controllers via
  `AuditService.log(...)`: actor (`userId`, `userName`), `action` (`AuditAction`:
  CREATED, UPDATED, DELETED, PROMOTED, DEMOTED, CONVERTED, STATUS_CHANGED,
  PAYMENT_RECORDED, PAYMENT_REMOVED), `entityType` (`AuditEntityType`), `entityId`,
  `entityName`, `details`, optional `diff`, and `createdAt`.
- The frontend reads logs through `useAuditLogs` / `GET …/audit-logs` and filters by
  entity type / action / user. The legacy `writeAuditLog` util in the SPA is an
  intentional no-op kept so older call sites remain harmless.

## 7. Frontend Data Layer

- `src/api/client.js`: single `fetch` wrapper — base URL from `VITE_API_BASE_URL`,
  JWT header, JSON error parsing (`errorMessage`), 401/403 semantics (see §3).
- `src/api/*`: one thin module per backend domain.
- `src/firebase/db.js`: compatibility layer mapping legacy collection names
  (`events`, `quotations`, …) onto the REST modules, plus `COLLECTIONS` constants.
  New code should use `src/api/` directly.
- Hooks: `useOrgCollection` (list + refresh), `useDoc` (single record),
  `useAuditLogs` (paged log query). Data is fetched on mount/refresh — there are no
  real-time subscriptions.
- `AuthContext` holds the JWT session, current user and organization; `ThemeContext`
  handles dark/light mode.
- PDF export (`src/utils/pdfExport.js`): client-side jsPDF + autotable, dynamically
  imported; A4 portrait, org logo + name header (name-only fallback), per-column
  alignment, `rowPageBreak: 'avoid'`.

## 8. PWA & Push Notifications

- `vite-plugin-pwa` (Workbox) provides the manifest, icons and an auto-updating service
  worker; `/api/` paths are excluded from navigation fallback.
- Firebase is used **only** for Cloud Messaging. `firebase/config.js` initializes the app
  (no Firestore, no Firebase Auth); `messaging.js` retrieves the FCM token when the user
  accepts the prompt.
- The token is persisted server-side: `NotificationPermission.jsx` →
  `PUT /api/eventflow/users/me/fcm-token` → `users.fcm_token` column.
- Push is disabled silently when `VITE_FIREBASE_VAPID_KEY` is unset.

## 9. Configuration Matrix

### Backend (`application.properties`, dev defaults)

| Key | Default | Notes |
|---|---|---|
| `DB_URL` | `jdbc:mysql://localhost:3306/eventflow` | env or `local.properties` (git-ignored) |
| `DB_USER` / `DB_PASSWORD` | `root` / empty | never hardcode; `local.properties` for dev |
| `JWT_SECRET` (`SecretJwtString`) | dev fallback value | **required** in prod |
| `CORS_ALLOWED_ORIGINS` (`app.cors.allowed-origins`) | localhost:5173/3000 | comma-separated |
| `app.scheduler.document-status-cron` | `0 5 0 * * *` | daily 00:05 |

### Backend prod profile (`application-prod.properties`)

- `ddl-auto=validate`, `show-sql=false`, Hikari pool sizing via `DB_POOL_SIZE`.
- `JWT_SECRET` and `CORS_ALLOWED_ORIGINS` have **no defaults** — the app fails fast if
  they are missing.
- Error responses never include stack traces or messages.

### Frontend (`.env`, see `.env.example`)

- `VITE_API_BASE_URL` (defaults to `http://localhost:8080/api/eventflow`).
- `VITE_FIREBASE_*` (6 required at startup) and optional `VITE_FIREBASE_VAPID_KEY`.

## 10. Error Handling Contract

All backend errors return the `ErrorResponse` JSON shape:

```json
{
  "timestamp": "2026-11-17T10:00:00",
  "errorMessage": "Invoice not found: 123",
  "errorDetails": "/api/eventflow/organizations/o1/invoices/123",
  "errorCode": "NOT_FOUND"
}
```

Mapped by `GlobalExceptionHandler` (404 `NotFoundException`, 409 `DuplicateException`,
400 `BusinessRuleException`/validation, 403 `AccessDeniedException`) and by the security
entry point / denied handler (401/403). The SPA surfaces `errorMessage` in toasts.
