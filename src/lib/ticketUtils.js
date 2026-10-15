import { landmarkForText } from './campus.js';

export const STATUS_LABEL = {
  Pending: 'Waiting',
  'In Progress': 'Being fixed',
  Resolved: 'Fixed',
  submitted: 'Waiting',
  open: 'Waiting',
  assigned: 'Assigned',
  in_progress: 'Being fixed',
  resolved: 'Fixed',
  closed: 'Closed',
  reopened: 'Reopened',
  escalated: 'Escalated',
};

export const STATUS_STYLE = {
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  'In Progress': 'bg-blue-50 text-blue-700 border-blue-200',
  Resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  submitted: 'bg-amber-50 text-amber-700 border-amber-200',
  open: 'bg-amber-50 text-amber-700 border-amber-200',
  assigned: 'bg-purple-50 text-purple-700 border-purple-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed: 'bg-slate-100 text-slate-600 border-slate-200',
  reopened: 'bg-rose-50 text-rose-700 border-rose-200',
  escalated: 'bg-red-50 text-red-700 border-red-200',
};

export function statusLabel(t) {
  const s = typeof t === 'string' ? t : t?.status;
  return STATUS_LABEL[s] || s || 'Waiting';
}

export function statusStyle(t) {
  const s = typeof t === 'string' ? t : t?.status;
  return STATUS_STYLE[s] || STATUS_STYLE.Pending;
}

export function getStatusMeta(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'resolved' || s === 'fixed' || s === 'done') {
    return { label: 'Fixed', pin: '#10b981', badge: STATUS_STYLE.resolved };
  }
  if (s === 'in_progress' || s === 'in progress') {
    return { label: 'Being fixed', pin: '#3b82f6', badge: STATUS_STYLE.in_progress };
  }
  if (s === 'assigned') {
    return { label: 'Assigned', pin: '#6366f1', badge: STATUS_STYLE.assigned };
  }
  if (s === 'escalated' || s === 'reopened') {
    return { label: 'Escalated', pin: '#ef4444', badge: STATUS_STYLE.escalated };
  }
  return { label: 'Waiting', pin: '#f59e0b', badge: STATUS_STYLE.Pending };
}

export function getUrgencyMeta(urgency) {
  const u = String(urgency || '').toLowerCase();
  if (u === 'critical' || u === 'urgent') {
    return { label: 'Critical', pin: '#ef4444', badge: 'bg-rose-50 text-rose-700 border-rose-200' };
  }
  if (u === 'high') {
    return { label: 'High', pin: '#f97316', badge: 'bg-orange-50 text-orange-700 border-orange-200' };
  }
  if (u === 'low') {
    return { label: 'Low', pin: '#22c55e', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
  return { label: 'Medium', pin: '#eab308', badge: 'bg-amber-50 text-amber-700 border-amber-200' };
}

export function timeAgo(ts) {
  if (!ts) return 'Recently';
  const ms = typeof ts === 'number' ? ts : new Date(ts).getTime();
  if (!ms || isNaN(ms)) return 'Recently';
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export function ticketLabel(t) {
  return (
    t?.categoryDisplay ||
    [t?.category, t?.subCategory].filter(Boolean).join(' — ') ||
    t?.title ||
    'Issue'
  );
}

export function createdMs(t) {
  if (t?.createdAt?.seconds) return t.createdAt.seconds * 1000;
  if (typeof t?.createdAt === 'number') return t.createdAt;
  if (typeof t?.createdAt === 'string') return new Date(t.createdAt).getTime();
  if (t?.created_at) return new Date(t.created_at).getTime();
  return 0;
}

export function fmtDate(ms) {
  return ms
    ? new Date(ms).toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
}

export const isLostFound = (t) =>
  /lost\s*&?\s*found/i.test(t?.subCategory || t?.category || t?.title || '');

export function getTicketCoords(ticket) {
  if (!ticket) return null;
  // 1. If the ticket names a known campus building, snap to the exact building roof coordinate
  const hit = landmarkForText(ticket.location);
  if (hit) {
    return { lat: hit.lat, lng: hit.lng, buildingName: hit.name };
  }
  // 2. Otherwise use explicit GPS coordinates (latitude/longitude, or lat/lng)
  const latVal = ticket.latitude ?? ticket.lat;
  const lngVal = ticket.longitude ?? ticket.lng;
  if (latVal && lngVal && !isNaN(Number(latVal)) && !isNaN(Number(lngVal))) {
    return { lat: Number(latVal), lng: Number(lngVal) };
  }
  // 3. Try parsing coordinates embedded in description
  const text = `${ticket.description || ''} ${ticket.location || ''}`;
  const coordMatch = text.match(/\(?([0-9]{1,2}\.[0-9]{3,8}),\s*([0-9]{1,3}\.[0-9]{3,8})\)?/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }
  return null;
}

export function cleanDescription(desc) {
  if (!desc || typeof desc !== 'string') return '';
  return desc.replace(/\s*📍\s*Location:[\s\S]*$/, '').trim();
}
