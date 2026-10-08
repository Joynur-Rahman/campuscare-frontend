// ─────────────────────────────────────────────────────────────
//  API configuration
//  The whole app talks to ONE `api` object (see ./index.js). That object is
//  either the live REST client (./rest.js) that calls the FastAPI backend, or
//  an in-memory mock (./mock.js) so the UI runs with no backend yet.
//
//  Switch in .env:
//    VITE_USE_MOCK=true                       → run standalone on seed data
//    VITE_USE_MOCK=false + VITE_API_BASE_URL  → talk to the real FastAPI server
// ─────────────────────────────────────────────────────────────
export const USE_MOCK = String(import.meta.env.VITE_USE_MOCK ?? 'true') === 'true';
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');

// How often polling subscriptions refetch (ms). The FastAPI contract also
// exposes /stream endpoints (SSE); swap pollEvery for EventSource when ready.
export const POLL_INTERVAL = 4000;

// localStorage key for the auth token the backend returns on login.
export const TOKEN_KEY = 'cc_token';
