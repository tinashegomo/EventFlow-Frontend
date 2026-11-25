# EventFlow — Frontend

React single-page application for **EventFlow**, a multi-organization event management
platform. This SPA talks to the Spring Boot REST API in `../backend/EventManagementSystem`;
all business data lives in MySQL behind that API. Firebase is used **only** for Cloud
Messaging (push notifications).

> For the full system picture (backend, data flow, security, scheduling), see
> [docs/architecture.md](docs/architecture.md).

---

## Technology Stack

| Area | Technology |
|---|---|
| UI | React 19, React Router v7, Framer Motion, Tailwind CSS v3, Lucide icons |
| Forms | React Hook Form + Yup |
| Data | Plain `fetch` wrapper (`src/api/client.js`) against the REST API — no Axios, no React Query |
| PDF export | jsPDF + jspdf-autotable (client-side, dynamically imported) |
| PWA | vite-plugin-pwa (Workbox), installable with offline asset caching |
| Push | Firebase Cloud Messaging (token stored on the backend per user) |
| Build | Vite 8, ESLint 9 |

---

## Getting Started

### Prerequisites

- Node.js 20+
- The Spring Boot backend running locally (see the backend README / Memory Bank)
- A Firebase project **only if you want push notifications**

### Setup

```bash
npm install
copy .env.example .env    # then fill in the values
npm run dev               # http://localhost:5173
```

### Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL of the Spring Boot API | `http://localhost:8080/api/eventflow` |
| `VITE_FIREBASE_*` (6 vars) | Firebase app config — required at startup | none (app throws if missing) |
| `VITE_FIREBASE_VAPID_KEY` | Web push certificate key; push is disabled if unset | none |

The backend must allow the frontend origin via `CORS_ALLOWED_ORIGINS`
(see `docs/architecture.md`).

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint over all sources |

---

## Project Structure

```
frontend/
├── public/                     # PWA icons, favicons, firebase-messaging-sw.js
├── src/
│   ├── api/                    # REST layer — one module per backend domain
│   │   ├── client.js           # fetch wrapper: JWT header, 401/403 handling, base URL
│   │   ├── auth.js  users.js  organizations.js
│   │   ├── events.js  eventTypes.js  inventory.js
│   │   └── quotations.js  invoices.js  auditLogs.js
│   ├── components/
│   │   ├── ui/                 # Design-system primitives (Button, Card, Badge, …)
│   │   └── layout/             # Sidebar (collapsible), Topbar, PageTransition
│   ├── context/                # AuthContext (JWT session), ThemeContext (dark/light)
│   ├── firebase/
│   │   ├── config.js           # Firebase app init (Cloud Messaging only)
│   │   ├── messaging.js        # FCM token retrieval + foreground messages
│   │   ├── collections.js      # Logical collection names used by hooks
│   │   └── db.js               # Compatibility layer mapping names → REST calls
│   ├── hooks/                  # useOrgCollection, useDoc, useAuditLogs
│   ├── pages/                  # dashboard, events, event-types, inventory,
│   │                           # quotations, invoices, users, audit, auth, org settings
│   └── utils/
│       ├── business.js         # Status lists, quotation/invoice total math
│       ├── dateHelpers.js      # Formatting + currency helpers
│       ├── pdfExport.js        # jsPDF quotation/invoice PDF generation
│       ├── invoiceHelpers.js   # markInvoiceAsPaid wrapper
│       ├── paymentHelpers.js   # Event payment summary helpers
│       └── audit.js            # writeAuditLog — intentional no-op (backend logs)
├── docs/architecture.md        # Full-stack architecture documentation
├── vite.config.js              # Build config + PWA (Workbox) setup
└── .env.example                # Environment template
```

---

## How the Frontend Talks to the Backend

- `src/api/client.js` prefixes every path with `VITE_API_BASE_URL` and attaches
  `Authorization: Bearer <JWT>` from `localStorage` (`ef_jwt_token`, `ef_org_id`).
- **401** responses clear the session and redirect to `/login`. **403** responses keep the
  session (they mean "authenticated but not allowed") and surface an error message.
- The backend is the source of truth for: document numbers (invoice/quotation numbering is
  allocated server-side), all totals (recomputed from line items), quotation→invoice
  conversion, and date-driven statuses (`OVERDUE`/`EXPIRED` are maintained by a backend
  scheduler — the frontend never computes them).
- `src/firebase/db.js` is a thin compatibility layer that maps legacy "collection" names
  (`events`, `invoices`, …) onto the REST modules. New code should import from `src/api/`
  directly.
- `writeAuditLog` in `src/utils/audit.js` is a no-op: the backend writes audit entries for
  every mutation automatically.

---

## PDF Export

Quotation and invoice detail pages have a **Download PDF** button. `src/utils/pdfExport.js`
dynamically imports jsPDF + autotable (separate ~7 kB chunk) and renders an A4 portrait
document with:

- Organization logo (when uploaded) plus organization name in the header — name-only
  fallback when no logo exists.
- Auto-table line items with per-column alignment and `rowPageBreak: 'avoid'`.

Everything runs client-side; no backend endpoint is involved.

---

## PWA & Push Notifications

- `vite-plugin-pwa` generates the manifest and a Workbox service worker
  (`registerType: 'autoUpdate'`); API paths are excluded from navigation fallback.
- `public/firebase-messaging-sw.js` handles background push messages.
- When the user accepts the notification prompt (`NotificationPermission.jsx`), the FCM
  token is saved to the backend via `PUT /api/eventflow/users/me/fcm-token`.
- Push is silently disabled when `VITE_FIREBASE_VAPID_KEY` is not configured.

---

## Deployment

1. Build with `npm run build` and deploy `dist/` to any static host (Vercel, Netlify,
   Firebase Hosting…).
2. Set `VITE_API_BASE_URL` to the production API URL **at build time** (Vite inlines env
   vars into the bundle).
3. Set the `VITE_FIREBASE_*` variables in the hosting platform's dashboard.
4. On the backend, activate the `prod` profile and set `CORS_ALLOWED_ORIGINS` to the
   frontend origin(s), plus `JWT_SECRET` and `DB_PASSWORD` (all mandatory, no defaults).
