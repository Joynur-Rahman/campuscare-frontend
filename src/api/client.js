// Low-level HTTP client for the FastAPI backend.
// Handles base URL, JSON, the bearer token, and error normalization.
import { API_BASE_URL, TOKEN_KEY } from './config.js';

let _clerkGetToken = null;
let _cachedToken = null;
let _cachedTokenExpiresAt = 0;

export function setClerkGetToken(fn) {
  _clerkGetToken = fn;
  _cachedToken = null;
}

export async function getToken() {
  const now = Date.now();
  if (_cachedToken && now < _cachedTokenExpiresAt) {
    return _cachedToken;
  }
  if (_clerkGetToken) {
    try {
      const token = await _clerkGetToken();
      if (token) {
        _cachedToken = token;
        _cachedTokenExpiresAt = now + 45000;
        return token;
      }
    } catch {}
  }
  try { return localStorage.getItem(TOKEN_KEY) || null; } catch { return null; }
}

export function setToken(t) {
  _cachedToken = t;
  _cachedTokenExpiresAt = t ? Date.now() + 45000 : 0;
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {}
}

async function parse(res) {
  const text = await res.text();
  let body = null;
  if (text) { try { body = JSON.parse(text); } catch { body = text; } }
  if (!res.ok) {
    const msg = (body && (body.detail || body.message || body.error)) || res.statusText || `HTTP ${res.status}`;
    const err = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

async function headers(extra) {
  const h = { 'Accept': 'application/json', ...extra };
  const token = await getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export const http = {
  async get(path, params) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetch(`${API_BASE_URL}${path}${qs}`, { headers: await headers() }).then(parse);
  },
  async post(path, data) {
    return fetch(`${API_BASE_URL}${path}`, {
      method: 'POST', headers: await headers({ 'Content-Type': 'application/json' }),
      body: data == null ? undefined : JSON.stringify(data),
    }).then(parse);
  },
  async put(path, data) {
    return fetch(`${API_BASE_URL}${path}`, {
      method: 'PUT', headers: await headers({ 'Content-Type': 'application/json' }),
      body: data == null ? undefined : JSON.stringify(data),
    }).then(parse);
  },
  async del(path, data) {
    return fetch(`${API_BASE_URL}${path}`, {
      method: 'DELETE', headers: await headers(data ? { 'Content-Type': 'application/json' } : undefined),
      body: data == null ? undefined : JSON.stringify(data),
    }).then(parse);
  },
  async upload(path, file, fields) {
    const fd = new FormData();
    fd.append('file', file);
    Object.entries(fields || {}).forEach(([k, v]) => fd.append(k, v));
    return fetch(`${API_BASE_URL}${path}`, { method: 'POST', headers: await headers(), body: fd }).then(parse);
  },
};
