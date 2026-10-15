// Who solves what. Every department / committee that can be given tickets,
// grouped for the admin screens, with the role title its people carry.
// Names match `team` / `handledBy` in data/catalog.js so tickets can be routed.
import { CATEGORIES, getCategory } from '../data/catalog.js';

export const DEPT_GROUPS = [
  { key: 'maintenance', label: 'Maintenance teams', short: 'Maintenance', role: 'Technician' },
  { key: 'services', label: 'Campus services', short: 'Services', role: 'In-charge' },
  { key: 'academic', label: 'Academic & admin offices', short: 'Academic & admin', role: 'Officer' },
  { key: 'welfare', label: 'Committees & wellbeing', short: 'Committees', role: 'Committee member' },
];

export const DEPARTMENTS = [
  // Maintenance
  { name: 'IT & Network Cell', group: 'maintenance' },
  { name: 'Electrical Cell', group: 'maintenance' },
  { name: 'Plumbing & Estate', group: 'maintenance' },
  { name: 'Civil & Building Maintenance', group: 'maintenance' },
  { name: 'Housekeeping & Sanitation', group: 'maintenance' },
  // Services
  { name: 'Hostel Office', group: 'services', role: 'Warden / Hostel staff' },
  { name: 'Mess & Food Services', group: 'services', role: 'Mess supervisor' },
  { name: 'Security Office', group: 'services', role: 'Security officer' },
  { name: 'Medical Centre', group: 'services', role: 'Medical officer' },
  { name: 'Central Library', group: 'services', role: 'Library staff' },
  { name: 'Sports Office', group: 'services', role: 'Sports officer' },
  { name: 'Transport / Admin Office', group: 'services', role: 'Transport in-charge' },
  { name: 'Student Activity Centre', group: 'services', role: 'Activity coordinator' },
  // Academic & admin
  { name: 'Head of Department / Dean (Academic)', group: 'academic', role: 'Faculty coordinator' },
  { name: 'Academic Section', group: 'academic', role: 'Academic officer' },
  { name: 'Examination Cell', group: 'academic', role: 'Exam officer' },
  { name: 'Accounts Section', group: 'academic', role: 'Accounts officer' },
  { name: 'Administration / Registrar Office', group: 'academic', role: 'Admin officer' },
  { name: 'Training & Placement Cell', group: 'academic', role: 'Placement officer' },
  // Committees & wellbeing
  { name: 'Anti-Ragging Committee', group: 'welfare', role: 'Committee member' },
  { name: 'Internal Complaints Committee (ICC)', group: 'welfare', role: 'ICC member' },
  { name: 'Student Counsellor', group: 'welfare', role: 'Counsellor' },
];

const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

export function deptInfo(name) {
  const d = DEPARTMENTS.find(x => norm(x.name) === norm(name));
  if (!d) return { name: name || 'Staff', group: 'maintenance', role: 'Staff' };
  const g = DEPT_GROUPS.find(x => x.key === d.group);
  return { ...d, role: d.role || g?.role || 'Staff' };
}

export const roleTitleFor = (deptName) => deptInfo(deptName).role;
export const groupOf = (deptName) => deptInfo(deptName).group;

/** Department that should handle a ticket (from its catalogue category). */
export function deptForTicket(t) {
  const byKey = getCategory(t?.category);
  const label = String(t?.categoryDisplay || '').split(' — ')[0].trim();
  const byLabel = CATEGORIES.find(c => norm(c.label) === norm(label));
  const c = byLabel || byKey;
  return c ? (c.handledBy || c.team || null) : null;
}

/** Does this staff member belong to the department that handles the ticket? */
export function staffMatchesTicket(staff, t) {
  const want = deptForTicket(t);
  if (!want) return false;
  const have = norm(staff?.dept || staff?.department);
  return !!have && (norm(want) === have || norm(want).includes(have) || have.includes(norm(want)));
}
