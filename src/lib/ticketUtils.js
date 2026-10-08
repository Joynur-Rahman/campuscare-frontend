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
