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

export function getTicketCoords(ticket) {
  if (!ticket) return null;
  if (ticket.latitude && ticket.longitude && !isNaN(Number(ticket.latitude)) && !isNaN(Number(ticket.longitude))) {
    return { lat: Number(ticket.latitude), lng: Number(ticket.longitude) };
  }
  // Try parsing from description or location string (e.g. "📍 Location: Canteen... (26.08094, 91.56180)")
  const text = `${ticket.description || ''} ${ticket.location || ''}`;
  const coordMatch = text.match(/\(?([0-9]{1,2}\.[0-9]{3,8}),\s*([0-9]{1,3}\.[0-9]{3,8})\)?/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }
  // Keyword fallbacks for campus places
  const loc = (ticket.location || '').toLowerCase();
  if (loc.includes('hostel') || loc.includes('room') || loc.includes('b-block') || loc.includes('a-block')) {
    return { lat: 26.0815, lng: 91.5595 };
  }
  if (loc.includes('library')) {
    return { lat: 26.0828, lng: 91.5602 };
  }
  if (loc.includes('academic') || loc.includes('class') || loc.includes('lab') || loc.includes('a-110')) {
    return { lat: 26.0833, lng: 91.5612 };
  }
  if (loc.includes('canteen') || loc.includes('mess') || loc.includes('cafe')) {
    return { lat: 26.0822, lng: 91.5600 };
  }
  if (loc.includes('admin') || loc.includes('office')) {
    return { lat: 26.0837, lng: 91.5620 };
  }
  return null;
}

export function cleanDescription(desc) {
  if (!desc || typeof desc !== 'string') return '';
  return desc.replace(/\s*📍\s*Location:[\s\S]*$/, '').trim();
}

