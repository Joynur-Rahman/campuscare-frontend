// ─────────────────────────────────────────────────────────────
//  API configuration
//  The whole app talks to ONE `api` object (see ./index.js): the REST client
//  (./rest.js) that calls the FastAPI backend at VITE_API_BASE_URL.
// ─────────────────────────────────────────────────────────────
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');

// How often polling subscriptions refetch (ms). The FastAPI contract also
// exposes /stream endpoints (SSE); swap pollEvery for EventSource when ready.
export const POLL_INTERVAL = 12000;

// localStorage key for the auth token the backend returns on login.
export const TOKEN_KEY = 'cc_token';
