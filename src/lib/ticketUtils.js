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
  Pending: 'bg-amber-100/90 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60',
  'In Progress': 'bg-blue-100/90 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60',
  Resolved: 'bg-emerald-100/90 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
  submitted: 'bg-amber-100/90 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60',
  assigned: 'bg-purple-100/90 text-purple-900 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/60',
  in_progress: 'bg-blue-100/90 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60',
  resolved: 'bg-emerald-100/90 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
  reopened: 'bg-rose-100/90 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60',
  escalated: 'bg-red-100/90 text-red-900 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/60',
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

export function fmtPhone(p) {
  if (!p) return '';
  const clean = String(p).replace(/[^0-9]/g, '');
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  if (clean.length === 12 && clean.startsWith('91')) {
    return `+91 ${clean.slice(2, 7)} ${clean.slice(7)}`;
  }
  return String(p);
}
