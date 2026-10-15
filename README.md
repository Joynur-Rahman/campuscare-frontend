# CampusCare — React Frontend

A React (Vite) frontend for CampusCare, built to talk to the **FastAPI backend**
described in `FASTAPI_API_LIST`. Icons use **lucide-react**, styling uses
**Tailwind CSS** (with the original CampusCare design tokens).

The whole UI talks to one `api` object: the **REST client** that calls your
FastAPI server.

## Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set your configuration values:

```env
# FastAPI backend API URL
VITE_API_BASE_URL=http://localhost:8000

# Clerk Authentication Publishable Key (from https://dashboard.clerk.com)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

## Quick Start

### Running Locally with npm

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev

# 3. Build for production
npm run build

# 4. Preview production build
npm run preview
```

### Running with Docker

From the root project directory:

```bash
docker compose up -d frontend
```

## Architecture

```
src/
  api/
    config.js     # reads VITE_API_BASE_URL
    client.js     # fetch wrapper (base URL, bearer token, JSON, upload)
    rest.js       # REST client — ONE method per gateway op, mapped to FastAPI routes
    index.js      # exports `api` (the REST client)
  context/AppContext.jsx   # auth session, theme, toasts
  hooks/useSubscription.js # live feed hook — each dashboard loads only its data
  components/     # LoginView, TopNav, TicketCard, TicketDetailModal, ReportModal, EmergencyModal, Toast
  portals/        # StudentPortal, TechnicianPortal, AdminPortal
  data/catalog.js # problem categories for the report form
  lib/            # ticket helpers
```

Why this is fast:
- **React** renders the UI and updates only what changed — no full page reloads.
- **Per-dashboard subscriptions** (`useSubscription`) load only the data a screen needs.
- Switching tabs/role views never reloads the page.

## REST endpoint map (matches FASTAPI_API_LIST)

| Area | Frontend method | FastAPI route |
|---|---|---|
| Auth | `login` | `POST /api/auth/login` |
| Auth | `logout` | `POST /api/auth/logout` |
| Auth | `restoreSession` | `GET /api/auth/me` |
| Auth | `resetPassword` | `POST /api/auth/reset-password` |
| Auth | `updateMyPassword` | `PUT /api/auth/password` |
| Users | `getMyProfile` / `saveMyProfile` | `GET/PUT /api/users/me` |
| Files | `uploadFile` | `POST /api/files/upload[/{folder}]` |
| Tickets | `subscribeToTickets` | `GET /api/tickets` (poll; `/stream` for SSE) |
| Tickets | `createTicket` | `POST /api/tickets` |
| Tickets | `joinTicket` / `followTicket` | `POST /api/tickets/{id}/join` · `/follow` |
| Tickets | `addTicketMessage` | `POST /api/tickets/{id}/messages` |
| Tickets | `acknowledgeTicket` / `resolveTicket` / `reopenTicket` / `escalateTicket` / `submitFeedback` | `POST /api/tickets/{id}/{action}` |
| Assign | `assignTicket` / `autoAssign*` | `POST /api/assignments/...` |
| Staff | `subscribeToTechnicians` / `createTechnician` / ... | `/api/staff/technicians...` |
| Staff | `subscribeToCampusMembers` / `createCampusMember` / ... | `/api/staff/members...` |
| Messages | `sendAdminMessage` / `subscribeToAdminMessages` / ... | `/api/messages/...` |
| Notices | `subscribeToNotices` / `postNotice` / `endNotice` | `/api/notices...` |
| Settings | `subscribeToSettings` / `saveSettings` | `GET/PUT /api/settings` |
| Audit | `subscribeToAuditLog` | `GET /api/audit-log` |

Live feeds poll (`POLL_INTERVAL` in `config.js`). When the backend's `/stream`
(SSE) endpoints are ready, swap the `poll()` helper in `rest.js` for `EventSource`.

## Status

Built: REST API layer, login/landing, and the Student, Technician and Admin
dashboards (list, report, chat, assign, acknowledge/resolve, maps, reports).

Still to port from the original app: the full report wizard (map pin, photo,
duplicate detection), admin Reports/analytics & Excel export, notices manager,
staff management screens, and the messages drawer. These all have API methods
ready in `rest.js` — they just need their screens built.
