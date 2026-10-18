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

export async function getToken(forceFresh = false) {
  const now = Date.now();
  if (!forceFresh && _cachedToken && now < _cachedTokenExpiresAt) {
    return _cachedToken;
  }
  _cachedToken = null;
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
  if (typeof window !== 'undefined' && window.Clerk?.session) {
    try {
      const token = await window.Clerk.session.getToken();
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

async function request(method, path, data, extraHeaders, isUpload = false) {
  let url = `${API_BASE_URL}${path}`;
  if (method === 'GET' && data) {
    url += '?' + new URLSearchParams(data).toString();
  }

  const buildHeaders = async (forceFresh = false) => {
    const h = { 'Accept': 'application/json', ...extraHeaders };
    const token = await getToken(forceFresh);
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  };

  let init = {
    method,
    headers: await buildHeaders(false),
  };

  if (isUpload) {
    init.body = data;
  } else if (method !== 'GET' && data != null) {
    init.body = JSON.stringify(data);
    init.headers['Content-Type'] = 'application/json';
  }

  let res = await fetch(url, init);

  // Auto-refresh token and retry ONCE on 401 Unauthorized
  if (res.status === 401) {
    _cachedToken = null;
    const freshHeaders = await buildHeaders(true);
    init.headers = freshHeaders;
    if (!isUpload && method !== 'GET' && data != null) {
      init.headers['Content-Type'] = 'application/json';
    }
    res = await fetch(url, init);
  }

  return parse(res);
}

export const http = {
  get: (path, params) => request('GET', path, params),
  post: (path, data) => request('POST', path, data),
  put: (path, data) => request('PUT', path, data),
  del: (path, data) => request('DELETE', path, data),
  upload: async (path, file, fields) => {
    const fd = new FormData();
    fd.append('file', file);
    Object.entries(fields || {}).forEach(([k, v]) => fd.append(k, v));
    return request('POST', path, fd, undefined, true);
  },
};
