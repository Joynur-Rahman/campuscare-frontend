export const STATUS_LABEL = {
  Pending: 'Waiting',
  'In Progress': 'Being fixed',
  Resolved: 'Fixed',
  submitted: 'Waiting',
  assigned: 'Assigned',
  in_progress: 'Being fixed',
  resolved: 'Fixed',
  reopened: 'Reopened',
  escalated: 'Escalated',
};

export const STATUS_STYLE = {
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  'In Progress': 'bg-blue-50 text-blue-700 border-blue-200',
  Resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  submitted: 'bg-amber-50 text-amber-700 border-amber-200',
  assigned: 'bg-purple-50 text-purple-700 border-purple-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  reopened: 'bg-rose-50 text-rose-700 border-rose-200',
  escalated: 'bg-red-50 text-red-700 border-red-200',
};

export function statusLabel(t) { return STATUS_LABEL[t?.status] || t?.status || 'Waiting'; }
export function statusStyle(t) { return STATUS_STYLE[t?.status] || STATUS_STYLE.Pending; }
export function ticketLabel(t) { return t?.categoryDisplay || [t?.category, t?.subCategory].filter(Boolean).join(' — ') || t?.title || 'Issue'; }
export function createdMs(t) {
  if (t?.createdAt?.seconds) return t.createdAt.seconds * 1000;
  if (typeof t?.createdAt === 'number') return t.createdAt;
  if (typeof t?.createdAt === 'string') return new Date(t.createdAt).getTime();
  if (t?.created_at) return new Date(t.created_at).getTime();
  return 0;
}
export function fmtDate(ms) { return ms ? new Date(ms).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''; }
export const isLostFound = (t) => /lost\s*&?\s*found/i.test(t?.subCategory || t?.category || t?.title || '');

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

  const text = `${ticket.location || ''} ${ticket.description || ''} ${ticket.title || ''}`.toLowerCase();

  // 1. Check Landmark / Address matches FIRST (so existing tickets with "Boys Hostel", "Canteen", etc. get fixed)
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

  // 2. Check existing numeric latitude/longitude
  if (ticket.latitude && ticket.longitude && !isNaN(Number(ticket.latitude)) && !isNaN(Number(ticket.longitude))) {
    const rawLat = Number(ticket.latitude);
    const rawLng = Number(ticket.longitude);

    // Check if these coordinates match an old preset and migrate them
    for (const mig of OLD_PRESET_MIGRATIONS) {
      if (Math.abs(rawLat - mig.lat) < 0.0006 && Math.abs(rawLng - mig.lng) < 0.0006) {
        return mig.target;
      }
    }
    return { lat: rawLat, lng: rawLng };
  }

  // 3. Try parsing from description or location string (e.g. "(26.08094, 91.56180)")
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
  return desc.replace(/\s*📍\s*Location:[\s\S]*$/, '').trim();
}

