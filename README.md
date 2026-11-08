# 🎨 CampusCare — React Frontend

A high-performance React 18 single-page application for **CampusCare**, built with **Vite**, **Tailwind CSS**, and **Lucide React** icons. Communicates seamlessly with the **FastAPI backend** via an authenticated REST client.

---

## 🚀 Key Features & Portals

### 1. 🎓 Student Portal (`portals/StudentPortal.jsx`)
- **Interactive Report Modal (`components/ReportModal.jsx`)**:
  - Issue categorization with automatic department routing.
  - Dedicated **Floor** dropdown and **Room / Lab No.** input slots for exact facility identification.
  - Media uploader with live preview supporting up to 3 photos/videos (max 25MB).
  - Built-in geofence validation confirming user is inside the IIIT Guwahati campus perimeter before filing on-site issues.
  - Immediate duplicate alert preventing duplicate active complaint submissions for the same room, floor, and category.
- **Ticket Tracking & Interaction**:
  - Live ticket card list with search, status filters, and timeline stepper.
  - Integrated chat thread with assigned technician.
  - Technician appointment confirmation (Accept/Decline).
  - Star rating and satisfaction feedback submission upon issue resolution.
- **Community Services**:
  - Lost & Found bulletin board with security desk handover notes.
  - One-tap Emergency SOS broadcast with live coordinates.

---

### 2. 👷 Technician & Staff Portal (`portals/TechnicianPortal.jsx`)
- **Triage Queue**: Categorized tabs for `All`, `Assigned`, `In Progress`, and `Resolved`.
- **Location-Aware Context**: Clean view of building, floor, room number, problem description, and attached images.
- **Workflow Tools**:
  - Quick claim & acknowledgment.
  - Status updates (`in_progress`, `resolved`) with completion remarks, bill-of-materials, and proof-of-work photos.
  - In-app appointment proposal system directly coordinating inspection times with students.
  - Direct reporter phone calling menu.

---

### 3. 🛡️ Administrator Portal (`portals/AdminPortal.jsx`)
- **Operational Dashboard (`portals/admin/AdminDashboard.jsx`)**:
  - KPI triage cards tracking Reported, Open Queue, Unassigned, Urgent Risks, Resolved, and Average Staff Ratings.
  - Category filter pills with dynamic count badges.
- **Interactive Satellite Campus Map (`components/CampusMapView.jsx`)**:
  - MapmyIndia (Mappls) and Leaflet hybrid satellite view showing official IIIT Guwahati campus boundary polygon.
  - Calibrated roof-aligned building markers (Academic Complex, Boys' Hostel, Girls' Hostel, Library, Canteen, Lake, Sports Ground).
  - Admin drag-to-calibrate mode to adjust and save landmark coordinates.
  - Contained, compact viewport layout (420px height) with independent vertical scrolling for tickets.
  - Quick "Recenter Campus" and "My GPS" floating actions.
- **Ticket Management & Merge Engine (`portals/admin/AdminTickets.jsx`)**:
  - Status filter chips with quick counts.
  - Full-text search across ticket ID, title, student, technician, building, and room.
  - **Intelligent Duplicate Merging (`components/admin/MergeModal.jsx`)**:
    - Automatically clusters duplicate tickets based strictly on: **Same Room Number + Same Floor + Same Category + Same Subcategory**.
    - Side-by-side comparison modal with duplicate criteria badge and instant local state updating.
- **Staff & Technician Management (`portals/admin/AdminTechnicians.jsx` & `AdminManage.jsx`)**:
  - Real-time technician on-duty status, active job counts, and assignment management.
  - User role administration across Student, Faculty, Staff, and Administrator.
- **Analytics & SLA Reports (`portals/admin/AdminReports.jsx`)**:
  - SLA compliance rates, average resolution times, and category breakdown charts.
  - Campus hotspot map identifying buildings with the highest issue volume.
  - CSV export for institutional compliance.

---

## 🛠️ Project Structure

```text
src/
├── api/
│   ├── config.js               # API URL & poll interval configuration
│   ├── client.js               # Fetch wrapper with Bearer token, JSON parsing & error handling
│   ├── rest.js                 # Complete REST client methods mapped to FastAPI endpoints
│   └── index.js                # Exports unified `api` instance
├── components/
│   ├── admin/
│   │   ├── AssignMenu.jsx      # Technician dispatch & assignment dropdown
│   │   ├── Bits.jsx            # KPI metric cards & triage pills
│   │   └── MergeModal.jsx      # Duplicate ticket review & merge modal
│   ├── CampusMapView.jsx       # Satellite map view with pins, buildings & triage queue
│   ├── EmergencyModal.jsx      # High-priority SOS broadcast modal
│   ├── LocationPicker.jsx      # Map location picker with search suggestions & geofencing
│   ├── LoginView.jsx           # Sign-in & landing page
│   ├── LostFoundModal.jsx      # Lost and found item posting & claiming
│   ├── RatingModal.jsx         # Star rating & feedback dialog
│   ├── ReportModal.jsx         # Guided report wizard with floor & room slots
│   ├── TicketCard.jsx          # Reusable ticket card component
│   ├── TicketDetailModal.jsx   # Ticket detail view with threaded chat & timeline
│   └── Toast.jsx               # Floating feedback notifications
├── context/
│   └── AppContext.jsx          # Global application state (auth, theme, tickets, toasts)
├── data/
│   └── catalog.js              # Issue categories, problem taxonomy, teams, SLAs & locations
├── hooks/
│   └── useSubscription.js      # Polling & live data subscription hook
├── lib/
│   ├── adminMetrics.js         # KPI summaries & report calculations
│   ├── campus.js               # IIIT Guwahati coordinates, landmarks & geofence polygon
│   ├── departments.js          # Department styling, roles & labels
│   ├── duplicateUtils.js       # Strict duplicate detection (room, floor, category matching)
│   ├── leafletFallback.js      # Leaflet satellite layer fallback
│   ├── mappls.js               # MapmyIndia (Mappls) SDK integration & satellite styling
│   └── ticketUtils.js          # Ticket normalization, formatting & status styling
├── portals/
│   ├── StudentPortal.jsx       # Student interface
│   ├── TechnicianPortal.jsx    # Technician & staff interface
│   └── AdminPortal.jsx         # Administrator interface
├── App.jsx                     # Route guard & role dispatcher
├── AuthedApp.jsx               # Authenticated shell with TopNav & portal routing
└── main.jsx                    # React 18 entry point with ClerkProvider
```

---

## ⚙️ Environment Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Set your configuration values:

```env
# FastAPI backend API URL
VITE_API_BASE_URL=http://localhost:8000

# Clerk Authentication Publishable Key (from https://dashboard.clerk.com)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# MapmyIndia (Mappls) API Key (optional, defaults to Leaflet fallback)
VITE_MAPPLS_API_KEY=your_mappls_key
```

---

## 🏃 Running the Application

### 1. Local Development

```bash
# Install dependencies
npm install

# Start Vite development server
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

### 2. Docker

To run the frontend container individually:

```bash
docker build -t campuscare-frontend .
docker run -d -p 5173:5173 --env-file .env campuscare-frontend
```

Or from the project root using Docker Compose:

```bash
docker compose up -d frontend
```

---

## 🔗 REST Endpoint Integration

All API calls flow through `src/api/rest.js`:

| Module | Method | Backend Route | Description |
|---|---|---|---|
| **Auth** | `restoreSession` | `GET /api/auth/me` | Validates session & syncs Clerk user profile |
| **Tickets** | `subscribeToTickets` | `GET /api/tickets` | Lists tickets filtered by role and permissions |
| **Tickets** | `createTicket` | `POST /api/tickets` | Files new issue with location, floor & room |
| **Tickets** | `mergeTickets` | `POST /api/tickets/{target_id}/merge` | Merges duplicate tickets into primary issue |
| **Tickets** | `updateTicketStatus`| `PUT /api/tickets/{id}/status` | Updates ticket lifecycle state |
| **Tickets** | `joinTicket` | `POST /api/tickets/{id}/join` | Adds upvote/supporter to an existing issue |
| **Appointments**| `proposeAppointment` | `POST /api/tickets/{id}/appointment` | Proposes visit window |
| **Appointments**| `respondToAppointment`| `PUT /api/tickets/{id}/appointment` | Student accepts or declines appointment |
| **Messages**| `addTicketMessage` | `POST /api/messages` | Sends message to ticket discussion thread |
| **Staff** | `subscribeToTechnicians`| `GET /api/staff/technicians` | Lists on-duty technicians and workloads |
| **Admin** | `subscribeToCampusMembers`| `GET /api/admin/users` | Lists users across all roles |
| **Admin** | `updateMemberRole` | `PUT /api/admin/users/{id}/role` | Promotes/updates user role |
| **Files** | `uploadFile` | `POST /api/files/upload` | Direct multipart file upload |
| **Files** | `getUploadSignature` | `POST /api/files/upload/signature` | Generates signed Cloudinary upload params |
| **Notices** | `subscribeToNotices` | `GET /api/notices` | Fetches campus notices and lost & found |
| **Audit** | `subscribeToAuditLog`| `GET /api/audit-log` | Fetches immutable system audit events |

---

## 🚀 Performance Optimizations

1. **Deterministic Component Renders**: Pure functional React components with `useMemo` and `useCallback` prevent unnecessary re-renders.
2. **Dynamic Polling & Subscriptions**: `useSubscription` maintains live data synchronization with automatic polling back-off when windows are hidden or tabs are inactive.
3. **Local State Optimistic Updates**: Merging duplicate tickets immediately updates local React state without waiting for polling cycles.
4. **Vite Code Splitting & Fast HMR**: Instant Hot Module Replacement and production chunk minification.
