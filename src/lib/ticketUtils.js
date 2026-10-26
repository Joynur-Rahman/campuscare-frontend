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

// Known old approximate coordinates to migrate to exact real-world positions
const OLD_PRESET_MIGRATIONS = [
  // Old Academic (26.0833, 91.5612) -> New Academic
  { lat: 26.0833, lng: 91.5612, target: { lat: 26.081306, lng: 91.561917 } },
  // Old Library (26.0828, 91.5602) -> New Library
  { lat: 26.0828, lng: 91.5602, target: { lat: 26.081127, lng: 91.562130 } },
  // Old Boys Hostel (26.0815, 91.5595) -> New Boys Hostel
  { lat: 26.0815, lng: 91.5595, target: { lat: 26.080111, lng: 91.558444 } },
  // Old Girls Hostel (26.0840, 91.5588) -> New Girls Hostel
  { lat: 26.0840, lng: 91.5588, target: { lat: 26.082111, lng: 91.559444 } },
  // Old Canteen (26.0822, 91.5600) -> New Canteen
  { lat: 26.0822, lng: 91.5600, target: { lat: 26.082251, lng: 91.562126 } },
  // Old Admin (26.0837, 91.5620) -> New Academic
  { lat: 26.0837, lng: 91.5620, target: { lat: 26.081306, lng: 91.561917 } },
  // Old Sports Complex (26.0808, 91.5615) -> New Playground
  { lat: 26.0808, lng: 91.5615, target: { lat: 26.080722, lng: 91.559139 } },
  // Old Main Gate (26.0850, 91.5628) -> New Main Gate
  { lat: 26.0850, lng: 91.5628, target: { lat: 26.081753, lng: 91.563255 } },
  // Old Campus Center (26.0827, 91.5606) -> New Campus Center
  { lat: 26.0827, lng: 91.5606, target: { lat: 26.0815, lng: 91.5608 } },
];

export function getTicketCoords(ticket) {
  if (!ticket) return null;

  // 1. If the ticket names a known campus building, snap to the exact building roof coordinate
  const hit = landmarkForText(ticket.location);
  if (hit) {
    return { lat: hit.lat, lng: hit.lng, buildingName: hit.name };
  }

  const text = `${ticket.location || ''} ${ticket.description || ''} ${ticket.title || ''}`.toLowerCase();

  // 2. Check Landmark / Address matches (for power house, canteen, badminton, hostels, etc.)
  if (text.includes('3hj6+wv2') || text.includes('canteen') || text.includes('mess') || text.includes('cafe')) {
    return { lat: 26.082251, lng: 91.562126 };
  }
  if (text.includes('power house') || text.includes('substation') || text.includes('transformer') || text.includes('generator')) {
    return { lat: 26.082278, lng: 91.561444 };
  }
  if (text.includes('town hall') || text.includes('auditorium') || text.includes('seminar hall')) {
    return { lat: 26.081444, lng: 91.559778 };
  }
  if (text.includes('badminton') || text.includes('indoor court')) {
    return { lat: 26.081500, lng: 91.559389 };
  }
  if (text.includes('girls hostel') || text.includes('girl hostel') || text.includes("girls' hostel") || /\bgh\b/i.test(text) || text.includes('women hostel') || /\bg-block\b/i.test(text)) {
    return { lat: 26.082111, lng: 91.559444 };
  }
  if (text.includes('faculty') || text.includes('quarters') || text.includes('residence') || text.includes('staff')) {
    return { lat: 26.082889, lng: 91.559639 };
  }
  if (text.includes('lake') || text.includes('pond')) {
    return { lat: 26.081667, lng: 91.561000 };
  }
  if (text.includes('playground') || text.includes('play ground') || text.includes('cricket') || text.includes('football')) {
    return { lat: 26.080722, lng: 91.559139 };
  }
  if (text.includes('3hj6+22') || text.includes('iron bridge') || text.includes('bridge')) {
    return { lat: 26.080003, lng: 91.560003 };
  }
  if (text.includes('3hj6+fv9') || text.includes('library') || text.includes('reading room')) {
    return { lat: 26.081127, lng: 91.562130 };
  }
  if (text.includes('3hj7+p8h') || text.includes('main gate') || text.includes('entrance') || text.includes('security gate')) {
    return { lat: 26.081753, lng: 91.563255 };
  }
  if (text.includes('academic') || text.includes('class') || text.includes('lab') || text.includes('a-110') || text.includes('admin') || text.includes('office')) {
    return { lat: 26.081306, lng: 91.561917 };
  }
  if (text.includes('boys hostel') || text.includes('boy hostel') || text.includes("boys' hostel") || /\bbh\b/i.test(text) || text.includes('men hostel') || /\bb-block\b/i.test(text)) {
    return { lat: 26.080111, lng: 91.558444 };
  }

  // 3. Otherwise use explicit GPS coordinates
  const latVal = ticket.latitude ?? ticket.lat;
  const lngVal = ticket.longitude ?? ticket.lng;
  if (latVal && lngVal && !isNaN(Number(latVal)) && !isNaN(Number(lngVal))) {
    const rawLat = Number(latVal);
    const rawLng = Number(lngVal);

    // Check if these coordinates match an old preset and migrate them
    for (const mig of OLD_PRESET_MIGRATIONS) {
      if (Math.abs(rawLat - mig.lat) < 0.0006 && Math.abs(rawLng - mig.lng) < 0.0006) {
        return mig.target;
      }
    }
    return { lat: rawLat, lng: rawLng };
  }

  // 4. Try parsing coordinates embedded in description or location
  const coordMatch = `${ticket.description || ''} ${ticket.location || ''}`.match(/\(?([0-9]{1,2}\.[0-9]{3,8}),\s*([0-9]{1,3}\.[0-9]{3,8})\)?/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      for (const mig of OLD_PRESET_MIGRATIONS) {
        if (Math.abs(lat - mig.lat) < 0.0006 && Math.abs(lng - mig.lng) < 0.0006) {
          return mig.target;
        }
      }
      return { lat, lng };
    }
  }

  return null;
}

export function cleanDescription(desc) {
  if (!desc || typeof desc !== 'string') return '';
  return desc
    .replace(/\s*🌐\s*Public:\s*(true|false)/gi, '')
    .replace(/\s*📍\s*Location:[\s\S]*$/, '')
    .trim();
}

export const CATEGORY_PREFIXES = {
  it: 'IT',
  network: 'IT',
  electrical: 'ELEC',
  electrician: 'ELEC',
  appliance: 'ELEC',
  water: 'WAT',
  plumbing: 'WAT',
  mess: 'MESS',
  canteen: 'MESS',
  food: 'MESS',
  hostel: 'HSTL',
  room: 'HSTL',
  civil: 'CIV',
  furniture: 'CIV',
  carpentry: 'CIV',
  housekeeping: 'HK',
  cleaning: 'HK',
  sanitation: 'HK',
  security: 'SEC',
  guard: 'SEC',
  medical: 'MED',
  health: 'MED',
  doctor: 'MED',
  academic: 'ACAD',
  exam: 'ACAD',
  library: 'ACAD',
  lost: 'LF',
  found: 'LF',
  welfare: 'WELF',
  counselling: 'COUN',
  other: 'GEN',
};

export function getTicketPrefix(t) {
  if (!t) return 'TCK';
  if (t.isLostFound || t.is_lost_found || t.lostFound || t.category === 'Lost & Found') return 'LF';

  const text = `${t.category || ''} ${t.categoryDisplay || ''} ${t.department || ''} ${t.title || ''}`.toLowerCase();

  for (const [key, prefix] of Object.entries(CATEGORY_PREFIXES)) {
    if (text.includes(key)) {
      return prefix;
    }
  }
  return 'TCK';
}

export function shortTicketId(t) {
  if (!t) return '';
  const id = typeof t === 'string' ? t : (t.id || t.ticket_id || '');
  if (!id) return '';

  // Extract year from ticket created_at or date or fallback to current year
  let year = new Date().getFullYear();
  if (typeof t === 'object') {
    const rawDate = t.created_at || t.createdAt || t.date;
    if (rawDate) {
      const parsed = new Date(rawDate).getFullYear();
      if (!isNaN(parsed) && parsed >= 2020 && parsed <= 2100) {
        year = parsed;
      }
    }
  }

  const categoryTag = typeof t === 'object' ? getTicketPrefix(t) : 'GEN';

  // If already formatted like #IIITG-... or IIITG-..., return it
  if (typeof id === 'string' && /IIITG-\d{4}-/i.test(id)) {
    return id.startsWith('#') ? id : `#${id}`;
  }

  // Clean the id (extract alphanumeric characters)
  const clean = String(id).replace(/[^a-zA-Z0-9]/g, '');
  const numPart = clean ? clean.slice(-4).toUpperCase() : '0001';

  return `#IIITG-${year}-${numPart}-${categoryTag}`;
}
