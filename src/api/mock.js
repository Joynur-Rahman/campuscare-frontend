// ─────────────────────────────────────────────────────────────
//  Mock API — in-memory implementation of the full surface so the React
//  frontend runs with NO backend. Same method names as rest.js, so the UI is
//  identical whether running on mock data or the live FastAPI server.
//  Subscriptions re-emit on any local mutation, so the UI feels real-time.
// ─────────────────────────────────────────────────────────────
import { setToken } from './client.js';

const now = () => Date.now();
const secs = (ms) => ({ seconds: Math.floor(ms / 1000) });
const uid = () => 'm_' + Math.random().toString(36).slice(2, 10);
const ticketId = () => 'IIITG-2026-' + Math.floor(1000 + Math.random() * 9000);

// ── seed accounts (mock auth) ──
const ACCOUNTS = [
  { email: 'admin@iiitg.ac.in', password: 'admin123', role: 'admin', name: 'Administrator', uid: 'admin-1' },
  { email: 'ujjwal@iiitg.ac.in', password: 'student', role: 'student', name: 'Ujjwal Prakash', uid: 'stu-1' },
  { email: 'tech@iiitg.ac.in', password: 'tech', role: 'staff', name: 'Ujjwal (IT Tech)', uid: 'tech-1', techId: 'tech-1' },
  { email: 'member@iiitg.ac.in', password: 'member', role: 'student', provisioned: true, name: 'Non-teaching Staff', uid: 'mem-1' },
];

function seed() {
  const technicians = [
    { firebaseId: 'tech-1', id: 'tech-1', uid: 'tech-1', name: 'Ujjwal (IT Tech)', email: 'tech@iiitg.ac.in', dept: 'IT & Network Cell', status: 'On Duty', activeTasks: 1, phone: '9000000001' },
    { firebaseId: 'tech-2', id: 'tech-2', uid: 'tech-2', name: 'Ramesh Kumar', email: 'ramesh@iiitg.ac.in', dept: 'Electrical Cell', status: 'On Duty', activeTasks: 0, phone: '9000000002' },
    { firebaseId: 'tech-3', id: 'tech-3', uid: 'tech-3', name: 'Suresh Das', email: 'suresh@iiitg.ac.in', dept: 'Plumbing & Estate', status: 'Off Duty', activeTasks: 0, phone: '9000000003' },
  ];
  const mk = (o) => ({
    priority: 'Normal', isPublic: false, upvotes: 0, upvotedBy: [], messages: [],
    assignedTo: null, assignedToName: null, assignedToEmail: null,
    userName: 'Ujjwal Prakash', userEmail: 'ujjwal@iiitg.ac.in', userId: 'stu-1',
    ...o,
  });
  const t = now();
  const tickets = [
    mk({ firebaseId: 'f1', id: 'IIITG-2026-8486', category: 'IT', subCategory: 'Wi-Fi not working', categoryDisplay: 'IT & Network — Wi-Fi not working', description: 'Hostel Wi-Fi keeps dropping every few minutes.', location: 'Boys Hostel — Room 214', status: 'In Progress', assignedTo: 'tech-1', assignedToName: 'Ujjwal (IT Tech)', assignedToEmail: 'tech@iiitg.ac.in', createdAt: secs(t - 3600e3), date: '03/10/2026', acknowledgedAt: t - 1800e3,
      messages: [{ sender: 'Technician', senderName: 'Ujjwal (IT Tech)', text: 'On my way to check the access point.', at: t - 1700e3, isSystem: false }] }),
    mk({ firebaseId: 'f2', id: 'IIITG-2026-5625', category: 'Electrical', subCategory: 'Fan not working', categoryDisplay: 'Electrical — Fan not working', description: 'Ceiling fan not spinning.', location: 'Academic Block — A-110', status: 'Resolved', assignedTo: 'tech-2', assignedToName: 'Ramesh Kumar', assignedToEmail: 'ramesh@iiitg.ac.in', rating: 4, createdAt: secs(t - 86400e3), resolvedAtMs: t - 80000e3, date: '02/10/2026' }),
    mk({ firebaseId: 'f3', id: 'IIITG-2026-3722', category: 'Water', subCategory: 'No water supply', categoryDisplay: 'Water & Plumbing — No water supply', description: 'No water in the washrooms since morning.', location: 'Library block', status: 'Pending', isPublic: true, upvotes: 4, upvotedBy: ['a', 'b', 'c', 'd'], priority: 'Normal', createdAt: secs(t - 7200e3), date: '03/10/2026', userName: 'Community' }),
    mk({ firebaseId: 'f4', id: 'IIITG-2026-6104', category: 'Security', subCategory: 'Lost & found', categoryDisplay: 'Lost & found — Found item', description: '[FOUND] Black wallet near the canteen.', location: 'Canteen', status: 'Pending', isPublic: true, upvotes: 1, createdAt: secs(t - 1200e3), date: '03/10/2026', userName: 'Ujjwal Prakash' }),
  ];
  const settings = { meTooThreshold: 5, lateHours: 48, autoAssign: true };
  const notices = [{ firebaseId: 'n1', id: 'n1', title: 'Water supply maintenance', body: 'Water will be restored by 2 PM in the Library block.', createdAt: secs(t - 3600e3), active: true }];
  return { technicians, tickets, settings, notices, members: [], adminMessages: [], auditLog: [], profileRequests: [] };
}

export function createMockApi() {
  const db = seed();
  let currentUser = null;
  const authListeners = new Set();
  const feeds = { tickets: new Set(), technicians: new Set(), members: new Set(), notices: new Set(), settings: new Set(), adminMessages: new Set(), auditLog: new Set(), profileRequests: new Set() };

  const notifyAuth = () => authListeners.forEach(fn => { try { fn(currentUser); } catch {} });
  const emit = (key) => feeds[key].forEach(fn => { try { fn(dataFor(key)); } catch {} });
  const dataFor = (key) => key === 'settings' ? { ...db.settings } : [...db[key]];
  function sub(key) {
    return (a, b, c, d) => {
      // normalize (scope, cb, onError, onSync) OR (cb, onError, onSync)
      const cb = typeof a === 'function' ? a : (typeof b === 'function' ? b : c);
      const onSync = typeof a === 'function' ? c : (typeof b === 'function' ? d : d);
      feeds[key].add(cb);
      cb(dataFor(key));
      if (onSync) onSync({ fromCache: false });
      return () => feeds[key].delete(cb);
    };
  }
  const findTicket = (id) => db.tickets.find(t => t.id === id);

  return {
    _mock: true,
    // ── Auth ──
    getCurrentUser: () => currentUser,
    onAuthChange(cb) { authListeners.add(cb); cb(currentUser); return () => authListeners.delete(cb); },
    async login({ email, password, role }) {
      await delay();
      // Google flow (no password): accept any iiitg.ac.in as a student.
      if (!password) {
        const e = (email || 'ujjwal@iiitg.ac.in').toLowerCase();
        currentUser = { name: e.split('@')[0], email: e, role: 'student', uid: 'stu-' + e };
        setToken('mock-' + currentUser.uid); notifyAuth();
        return { success: true, user: currentUser };
      }
      const acc = ACCOUNTS.find(a => a.email === (email || '').toLowerCase() && a.password === password);
      if (!acc) throw new Error('Incorrect email or password. (mock: try admin@iiitg.ac.in / admin123)');
      const { password: _p, ...user } = acc;
      currentUser = user; setToken('mock-' + user.uid); notifyAuth();
      return { success: true, user };
    },
    async logout() { currentUser = null; setToken(null); notifyAuth(); },
    async restoreSession() { return currentUser; },
    getAdminEmails: async () => ['admin@iiitg.ac.in'],
    getRoles: async () => ({}),
    verifyRole: async () => ({ ok: true }),
    resetPassword: async () => ({ ok: true }),
    updateMyPassword: async () => ({ ok: true }),

    // ── Users ──
    getMyProfile: async () => ({ ...(currentUser || {}), phone: '', placeType: '', zone: '', spot: '' }),
    saveMyProfile: async (p) => { currentUser = { ...currentUser, ...p }; notifyAuth(); return { ok: true }; },

    // ── Files ──
    uploadFile: async (file) => { await delay(300); return 'data:mock/photo;name=' + (file && file.name || 'file'); },

    // ── Tickets ──
    subscribeToTickets: sub('tickets'),
    subscribeToConfidentialTickets: (uid2, isAdmin, cb) => { cb([]); return () => {}; },
    async createTicket(p) {
      await delay();
      const t = { firebaseId: uid(), id: ticketId(), status: 'Pending', priority: p.urgent ? 'High' : 'Normal', upvotes: p.isPublic ? 1 : 0, upvotedBy: [], messages: [], assignedTo: null, assignedToName: null, assignedToEmail: null, createdAt: secs(now()), date: new Date().toLocaleDateString('en-GB'), userName: (currentUser && currentUser.name) || 'You', userEmail: (currentUser && currentUser.email) || '', userId: (currentUser && currentUser.uid) || 'me', ...p };
      db.tickets.unshift(t); emit('tickets'); return t;
    },
    findSimilarTickets: async () => [],
    joinTicket: async (id) => { const t = findTicket(id); if (t) { t.upvotes = (t.upvotes || 0) + 1; emit('tickets'); } return { count: t ? t.upvotes : 0, escalated: false }; },
    followTicket: async () => ({ ok: true }),
    unfollowTicket: async () => ({ ok: true }),
    proposeAppointment: async () => ({ ok: true }),
    respondToAppointment: async () => ({ ok: true }),
    async addTicketMessage(id, m) { const t = findTicket(id); if (!t) throw new Error('Ticket not found'); t.messages = [...(t.messages || []), m]; emit('tickets'); return true; },
    async acknowledgeTicket(id, techId, name) { const t = findTicket(id); if (t) { t.status = 'In Progress'; t.acknowledgedAt = now(); t.messages = [...(t.messages || []), sys(`${name || 'Technician'} started work.`)]; emit('tickets'); } },
    async resolveTicket(id, remarks) { const t = findTicket(id); if (t) { t.status = 'Resolved'; t.resolvedAtMs = now(); t.resolutionRemarks = remarks; t.messages = [...(t.messages || []), sys('Ticket marked as fixed.')]; emit('tickets'); } },
    async reopenTicket(id, reason) { const t = findTicket(id); if (t) { t.status = 'Pending'; t.reopenCount = (t.reopenCount || 0) + 1; t.messages = [...(t.messages || []), sys('Ticket reopened: ' + reason)]; emit('tickets'); } },
    async escalateTicket(id) { const t = findTicket(id); if (t) { t.priority = 'High'; emit('tickets'); } },
    async submitFeedback(id, rating) { const t = findTicket(id); if (t) { t.rating = rating; emit('tickets'); } },

    // ── Assignment ──
    async assignTicket(id, techId, name) { const t = findTicket(id); if (t) { t.assignedTo = techId; t.assignedToName = name; const tech = db.technicians.find(x => x.firebaseId === techId); t.assignedToEmail = tech ? tech.email : null; t.status = 'Pending'; t.messages = [...(t.messages || []), sys(`Admin assigned ticket to ${name}.`)]; emit('tickets'); } },
    autoAssignTicket: async () => null,
    autoAssignWaiting: async () => ({ assigned: 0, waiting: 0 }),
    autoAssignWaitingAsTechnician: async () => ({ assigned: 0, waiting: 0 }),

    // ── Staff ──
    subscribeToTechnicians: sub('technicians'),
    createTechnician: async (p) => { const tech = { firebaseId: uid(), id: uid(), status: 'On Duty', activeTasks: 0, ...p }; db.technicians.push(tech); emit('technicians'); return tech; },
    updateTechnicianStatus: async (id, status) => { const x = db.technicians.find(t => t.firebaseId === id); if (x) { x.status = status; emit('technicians'); } },
    deleteTechnician: async (id) => { db.technicians = db.technicians.filter(t => t.firebaseId !== id); emit('technicians'); },
    resetTechnicianPassword: async () => ({ tempPassword: 'Temp@' + Math.floor(1000 + Math.random() * 9000) }),
    isUsingTempPassword: async () => false,
    subscribeToCampusMembers: sub('members'),
    createCampusMember: async (p) => { const m = { firebaseId: uid(), uid: uid(), ...p }; db.members.push(m); emit('members'); return { ...m, tempPassword: 'Temp@' + Math.floor(1000 + Math.random() * 9000) }; },
    deleteCampusMember: async (u) => { db.members = db.members.filter(m => m.uid !== u); emit('members'); },
    resolveStaffEmailByPhone: async () => null,
    rebuildStaffPhoneIndex: async () => ({ count: 0 }),
    submitProfilePhotoRequest: async () => ({ ok: true }),
    subscribeToProfileRequests: sub('profileRequests'),
    resolveProfileRequest: async () => ({ ok: true }),

    // ── Messages ──
    sendAdminMessage: async () => ({ ok: true }),
    adminStartConversation: async () => ({ ok: true }),
    replyToAdminMessage: async () => ({ ok: true }),
    subscribeToAdminMessages: sub('adminMessages'),
    subscribeToMyMessages: (u, cb) => { cb([]); return () => {}; },
    markAdminMessageRead: async () => ({ ok: true }),
    markThreadReadByUser: async () => ({ ok: true }),

    // ── Notices ──
    subscribeToNotices: sub('notices'),
    postNotice: async (n) => { const notice = { firebaseId: uid(), id: uid(), active: true, createdAt: secs(now()), ...n }; db.notices.unshift(notice); emit('notices'); return notice; },
    endNotice: async (id) => { db.notices = db.notices.filter(n => n.id !== id && n.firebaseId !== id); emit('notices'); },

    // ── Settings ──
    subscribeToSettings: sub('settings'),
    saveSettings: async (s) => { db.settings = { ...db.settings, ...s }; emit('settings'); },

    // ── Audit ──
    subscribeToAuditLog: sub('auditLog'),
  };
}

function delay(ms = 400) { return new Promise(r => setTimeout(r, ms)); }
function sys(text) { return { sender: 'System', text, at: now(), isSystem: true }; }
