// ─────────────────────────────────────────────────────────────
//  MOCK API & ALL DEMO DATA
//  All mock / demo data for the entire application is defined ONLY in this file.
//
//  Switch in .env:
//    VITE_USE_MOCK=true  -> Standalone in-memory mode using demo data below
//    VITE_USE_MOCK=false -> Real FastAPI + Supabase backend
// ─────────────────────────────────────────────────────────────
import { setToken } from './client.js';

const now = () => Date.now();
const secs = (ms) => ({ seconds: Math.floor(ms / 1000) });
const uid = () => 'm_' + Math.random().toString(36).slice(2, 10);
const ticketId = () => 'IIITG-2026-' + Math.floor(1000 + Math.random() * 9000);

// ═════════════════════════════ DEMO USERS & ACCOUNTS ═════════════════════════════

export const MOCK_USERS = {
  student: {
    id: 'stu-1',
    uid: 'stu-1',
    clerk_id: 'stu-1',
    email: 'ujjwal@iiitg.ac.in',
    name: 'Ujjwal Prakash',
    full_name: 'Ujjwal Prakash',
    role: 'student',
    phone: '',
    placeType: 'Hostel',
    zone: 'Boys Hostel',
    spot: 'Room 214',
  },
  staff: {
    id: 'tech-1',
    uid: 'tech-1',
    clerk_id: 'tech-1',
    email: 'tech@iiitg.ac.in',
    name: 'Ujjwal (IT Tech)',
    full_name: 'Ujjwal (IT Tech)',
    role: 'staff',
    dept: 'IT & Network Cell',
    status: 'On Duty',
    phone: '',
  },
  administrator: {
    id: 'admin-1',
    uid: 'admin-1',
    clerk_id: 'admin-1',
    email: 'admin@iiitg.ac.in',
    name: 'Administrator',
    full_name: 'Administrator',
    role: 'administrator',
    phone: '',
  },
  member: {
    id: 'mem-1',
    uid: 'mem-1',
    clerk_id: 'mem-1',
    email: 'member@iiitg.ac.in',
    name: 'Non-teaching Staff',
    full_name: 'Non-teaching Staff',
    role: 'student',
    provisioned: true,
    phone: '',
  },
};

export const MOCK_ACCOUNTS = [
  { email: 'admin@iiitg.ac.in', password: 'admin123', role: 'administrator', name: 'Administrator', uid: 'admin-1' },
  { email: 'ujjwal@iiitg.ac.in', password: 'student', role: 'student', name: 'Ujjwal Prakash', uid: 'stu-1' },
  { email: 'tech@iiitg.ac.in', password: 'tech', role: 'staff', name: 'Ujjwal (IT Tech)', uid: 'tech-1', techId: 'tech-1' },
  { email: 'member@iiitg.ac.in', password: 'member', role: 'student', provisioned: true, name: 'Non-teaching Staff', uid: 'mem-1' },
];

// ═════════════════════════════ DEMO TECHNICIANS ═════════════════════════════

export const MOCK_TECHNICIANS = [
  { firebaseId: 'tech-1', id: 'tech-1', uid: 'tech-1', name: 'Ujjwal (IT Tech)', email: 'tech@iiitg.ac.in', dept: 'IT & Network Cell', status: 'On Duty', activeTasks: 1, phone: '' },
  { firebaseId: 'tech-2', id: 'tech-2', uid: 'tech-2', name: 'Ramesh Kumar', email: 'ramesh@iiitg.ac.in', dept: 'Electrical Cell', status: 'On Duty', activeTasks: 0, phone: '' },
  { firebaseId: 'tech-3', id: 'tech-3', uid: 'tech-3', name: 'Suresh Das', email: 'suresh@iiitg.ac.in', dept: 'Plumbing & Estate', status: 'Off Duty', activeTasks: 0, phone: '' },
];

// ═════════════════════════════ DEMO SETTINGS ═════════════════════════════

export const MOCK_SETTINGS = {
  meTooThreshold: 5,
  lateHours: 48,
  autoAssign: true,
};

// ═════════════════════════════ DEMO NOTICES ═════════════════════════════

export function getMockNotices() {
  const t = now();
  return [
    {
      firebaseId: 'n1',
      id: 'n1',
      title: 'Water supply maintenance notice',
      body: 'Water supply will be restored by 2 PM in the Library and Academic blocks.',
      createdAt: secs(t - 3600e3),
      created_at: new Date(t - 3600e3).toISOString(),
      active: true,
    },
  ];
}

// ═════════════════════════════ DEMO TICKETS ═════════════════════════════

export function getMockTickets() {
  const t = now();
  const mk = (o) => ({
    priority: 'Normal',
    isPublic: false,
    upvotes: 0,
    upvotedBy: [],
    messages: [],
    assignedTo: null,
    assignedToName: null,
    assignedToEmail: null,
    userName: 'Ujjwal Prakash',
    userEmail: 'ujjwal@iiitg.ac.in',
    userId: 'stu-1',
    userPhone: '+91 98640 12345', // demo number
    ...o,
  });

  return [
    // ── 1. Ujjwal's ticket (In Progress) ──
    mk({
      firebaseId: 'f1',
      id: 'IIITG-2026-8486',
      title: 'Hostel Wi-Fi keeps dropping every few minutes',
      category: 'IT',
      subCategory: 'Wi-Fi not working',
      categoryDisplay: 'IT & Network — Wi-Fi not working',
      description: 'Hostel Wi-Fi keeps dropping every few minutes in room 214.',
      location: 'Boys Hostel — Room 214',
      lat: 26.08035,
      lng: 91.55860,
      status: 'In Progress',
      assignedTo: 'tech-1',
      assignedToName: 'Ujjwal (IT Tech)',
      assignedToEmail: 'tech@iiitg.ac.in',
      createdAt: secs(t - 3600e3),
      created_at: new Date(t - 3600e3).toISOString(),
      updated_at: new Date(t - 1700e3).toISOString(),
      date: '03/10/2026',
      acknowledgedAt: t - 1800e3,
      messages: [
        {
          sender: 'Technician',
          senderName: 'Ujjwal (IT Tech)',
          text: 'On my way to check the access point switch on 2nd floor.',
          at: t - 1700e3,
          created_at: new Date(t - 1700e3).toISOString(),
          isSystem: false,
        },
      ],
    }),

    // ── 2. Ujjwal's ticket (Resolved) ──
    mk({
      firebaseId: 'f2',
      id: 'IIITG-2026-5625',
      title: 'Ceiling fan not spinning in classroom A-110',
      category: 'Electrical',
      subCategory: 'Fan not working',
      categoryDisplay: 'Electrical — Fan not working',
      description: 'Ceiling fan regulator is turned to full but fan is not spinning at all.',
      location: 'Academic Block — A-110',
      lat: 26.08124,
      lng: 91.56199,
      status: 'Resolved',
      assignedTo: 'tech-2',
      assignedToName: 'Ramesh Kumar',
      assignedToEmail: 'ramesh@iiitg.ac.in',
      rating: 4,
      createdAt: secs(t - 86400e3),
      created_at: new Date(t - 86400e3).toISOString(),
      resolvedAtMs: t - 80000e3,
      updated_at: new Date(t - 80000e3).toISOString(),
      date: '02/10/2026',
    }),

    // ── 3. Ujjwal's ticket (Pending) ──
    mk({
      firebaseId: 'f5',
      id: 'IIITG-2026-3108',
      title: 'Water dispenser cooling issue on 1st floor',
      category: 'Water',
      subCategory: 'Tap leaking',
      categoryDisplay: 'Water & Plumbing — Tap leaking',
      description: 'The cold water tap is dripping continuously and water tray is overflowing.',
      location: 'Academic Block — 1st Floor Corridor',
      lat: 26.08110,
      lng: 91.56180,
      status: 'Pending',
      createdAt: secs(t - 1800e3),
      created_at: new Date(t - 1800e3).toISOString(),
      updated_at: new Date(t - 1800e3).toISOString(),
      date: '03/10/2026',
    }),

    // ── 4. Shared Community Issue (Reported by Priya, not Ujjwal) ──
    mk({
      firebaseId: 'f3',
      id: 'IIITG-2026-3722',
      title: 'No water supply in the library washrooms',
      category: 'Water',
      subCategory: 'No water supply',
      categoryDisplay: 'Water & Plumbing — No water supply',
      description: 'No water in the washrooms since morning. Taps are completely dry.',
      location: 'Library block',
      lat: 26.08092,
      lng: 91.56012,
      status: 'Pending',
      isPublic: true,
      upvotes: 4,
      upvotedBy: ['stu-2', 'stu-3', 'stu-4', 'stu-5'],
      priority: 'High',
      createdAt: secs(t - 7200e3),
      created_at: new Date(t - 7200e3).toISOString(),
      updated_at: new Date(t - 7200e3).toISOString(),
      date: '03/10/2026',
      userId: 'stu-88',
      userName: 'Priya Sharma (Student)',
      userEmail: 'priya@iiitg.ac.in',
    }),

    // ── 5. Lost & Found Notice (Posted by Security Desk) ──
    mk({
      firebaseId: 'f4',
      id: 'IIITG-2026-6104',
      title: '[FOUND] Black leather wallet near the canteen',
      category: 'Security',
      subCategory: 'Lost & found',
      categoryDisplay: 'Lost & found — Found item',
      description: '[FOUND] Black leather wallet found near table 4 at the canteen counter.',
      location: 'Canteen',
      lat: 26.08150,
      lng: 91.55920,
      status: 'Pending',
      isPublic: true,
      upvotes: 1,
      createdAt: secs(t - 1200e3),
      created_at: new Date(t - 1200e3).toISOString(),
      updated_at: new Date(t - 1200e3).toISOString(),
      date: '03/10/2026',
      userId: 'sec-1',
      userName: 'Campus Security Office',
      userEmail: 'security@iiitg.ac.in',
    }),
  ];
}
// ═════════════════════════════ DEMO ADMIN MESSAGES ═════════════════════════════

export function getMockAdminMessages() {
  const t = now();
  return [
    {
      id: 'adm-msg-1',
      sender: 'Administrator Office',
      senderName: 'Chief Warden & Estate Office',
      senderRole: 'administrator',
      title: 'Water Filtration Preventive Maintenance',
      text: 'Scheduled preventive maintenance of water filtration systems across Hostel and Academic Blocks will take place this Saturday (10:00 AM – 1:00 PM). Dispensers will be serviced sequentially.',
      snippet: 'Scheduled preventive maintenance of water filtration systems in Hostels & Academic Block this Saturday...',
      at: t - 1800e3,
      created_at: new Date(t - 1800e3).toISOString(),
      tag: 'Official Notice',
      isOfficial: true,
      unread: true,
    },
    {
      id: 'adm-msg-2',
      sender: 'IT Infrastructure Cell',
      senderName: 'Admin IT Operations',
      senderRole: 'administrator',
      title: 'Core Wi-Fi AP Firmware Upgrade Notice',
      text: 'Hostel Block core access point firmware has been upgraded to enhance 5GHz stability. If you experience dropouts, kindly forget the network and reconnect.',
      snippet: 'Hostel Block core access point firmware upgraded. Kindly reconnect if dropouts persist.',
      at: t - 7200e3,
      created_at: new Date(t - 7200e3).toISOString(),
      tag: 'IT Alert',
      isOfficial: true,
      unread: false,
    },
  ];
}

// ═════════════════════════════ SEED IN-MEMORY STORE ═════════════════════════════

export function createSeedDatabase() {
  return {
    technicians: [...MOCK_TECHNICIANS.map(t => ({ ...t }))],
    tickets: getMockTickets(),
    settings: { ...MOCK_SETTINGS },
    notices: getMockNotices(),
    members: [],
    adminMessages: getMockAdminMessages(),
    auditLog: [],
    profileRequests: [],
  };
}

// ═════════════════════════════ MOCK API IMPLEMENTATION ═════════════════════════════

export function createMockApi() {
  const db = createSeedDatabase();
  let currentUser = null;
  const authListeners = new Set();
  const feeds = {
    tickets: new Set(),
    technicians: new Set(),
    members: new Set(),
    notices: new Set(),
    settings: new Set(),
    adminMessages: new Set(),
    auditLog: new Set(),
    profileRequests: new Set(),
  };

  const notifyAuth = () => authListeners.forEach(fn => { try { fn(currentUser); } catch {} });
  const emit = (key) => feeds[key].forEach(fn => { try { fn(dataFor(key)); } catch {} });
  const dataFor = (key) => key === 'settings' ? { ...db.settings } : [...db[key]];

  function sub(key) {
    return (a, b, c, d) => {
      const cb = typeof a === 'function' ? a : (typeof b === 'function' ? b : c);
      const onSync = typeof a === 'function' ? c : (typeof b === 'function' ? d : d);
      feeds[key].add(cb);
      cb(dataFor(key));
      if (onSync) onSync({ fromCache: false });
      return () => feeds[key].delete(cb);
    };
  }

  const findTicket = (id) => db.tickets.find(t => t.id === id || t.firebaseId === id);

  return {
    _mock: true,

    // ── Demo Data Accessors ──
    getMockUsers: () => MOCK_USERS,
    getMockAccounts: () => MOCK_ACCOUNTS,

    // ── Auth ──
    getCurrentUser: () => currentUser,
    onAuthChange(cb) { authListeners.add(cb); cb(currentUser); return () => authListeners.delete(cb); },
    async login({ email, password, role }) {
      await delay(200);
      // Google / 1-click flow (no password): accept any iiitg.ac.in or role match
      if (!password) {
        const e = (email || 'ujjwal@iiitg.ac.in').toLowerCase();
        const roleKey = role || 'student';
        const template = MOCK_USERS[roleKey] || MOCK_USERS.student;
        currentUser = {
          ...template,
          role: template.role === 'admin' ? 'administrator' : template.role,
        };
        setToken('mock-' + currentUser.uid);
        notifyAuth();
        return { success: true, user: currentUser };
      }
      const acc = MOCK_ACCOUNTS.find(a => a.email === (email || '').toLowerCase() && a.password === password);
      if (!acc) throw new Error('Incorrect email or password. (mock: try admin@iiitg.ac.in / admin123)');
      const { password: _p, ...user } = acc;
      currentUser = {
        ...user,
        role: user.role === 'admin' ? 'administrator' : user.role,
        full_name: user.name || user.full_name,
      };
      setToken('mock-' + user.uid);
      notifyAuth();
      return { success: true, user: currentUser };
    },
    async logout() {
      currentUser = null;
      setToken(null);
      notifyAuth();
    },
    async restoreSession() { return currentUser; },
    getAdminEmails: async () => ['admin@iiitg.ac.in'],
    getRoles: async () => ({}),
    verifyRole: async () => ({ ok: true }),
    resetPassword: async () => ({ ok: true }),
    updateMyPassword: async () => ({ ok: true }),

    // ── Users ──
    getMyProfile: async () => ({ ...(currentUser || {}), phone: currentUser?.phone || '', placeType: '', zone: '', spot: '' }),
    saveMyProfile: async (p) => {
      currentUser = { ...currentUser, ...p };
      notifyAuth();
      return { ok: true };
    },

    // ── Files ──
    uploadFile: async (file) => {
      await delay(200);
      return 'data:mock/photo;name=' + (file && file.name || 'file');
    },

    // ── Tickets ──
    subscribeToTickets: sub('tickets'),
    subscribeToConfidentialTickets: (uid2, isAdmin, cb) => { cb([]); return () => {}; },
    async createTicket(p) {
      await delay(250);
      const nowMs = now();
      const generatedId = ticketId();
      const title = p.title || p.categoryDisplay || p.subCategory || 'Campus Grievance';
      const t = {
        firebaseId: uid(),
        id: generatedId,
        title,
        status: 'Pending',
        priority: p.urgent ? 'High' : 'Normal',
        upvotes: p.isPublic ? 1 : 0,
        upvotedBy: p.isPublic ? [currentUser?.uid || 'stu-1'] : [],
        messages: [],
        assignedTo: null,
        assignedToName: null,
        assignedToEmail: null,
        createdAt: secs(nowMs),
        created_at: new Date(nowMs).toISOString(),
        updated_at: new Date(nowMs).toISOString(),
        date: new Date().toLocaleDateString('en-GB'),
        userName: (currentUser && (currentUser.name || currentUser.full_name)) || 'Ujjwal Prakash',
        userEmail: (currentUser && currentUser.email) || 'ujjwal@iiitg.ac.in',
        userId: (currentUser && (currentUser.uid || currentUser.id)) || 'stu-1',
        userPhone: (currentUser && currentUser.phone) || '',
        ...p,
      };
      db.tickets.unshift(t);
      emit('tickets');
      return t;
    },
    findSimilarTickets: async () => [],
    joinTicket: async (id) => {
      const t = findTicket(id);
      if (t) {
        t.upvotes = (t.upvotes || 0) + 1;
        const voter = (currentUser && (currentUser.uid || currentUser.id)) || 'stu-1';
        t.upvotedBy = Array.isArray(t.upvotedBy) ? [...t.upvotedBy, voter] : [voter];
        emit('tickets');
      }
      return { count: t ? t.upvotes : 0, escalated: false };
    },
    followTicket: async () => ({ ok: true }),
    unfollowTicket: async () => ({ ok: true }),
    proposeAppointment: async () => ({ ok: true }),
    respondToAppointment: async () => ({ ok: true }),
    async addTicketMessage(id, m) {
      const t = findTicket(id);
      if (!t) throw new Error('Ticket not found');
      const msgObj = {
        at: now(),
        created_at: new Date().toISOString(),
        ...m,
      };
      t.messages = [...(t.messages || []), msgObj];
      t.updated_at = new Date().toISOString();
      emit('tickets');
      return true;
    },
    async acknowledgeTicket(id, techId, name) {
      const t = findTicket(id);
      if (t) {
        t.status = 'In Progress';
        t.acknowledgedAt = now();
        t.acknowledged_name = name || 'Technician';
        t.updated_at = new Date().toISOString();
        t.messages = [...(t.messages || []), sys(`${name || 'Technician'} started work.`)];
        emit('tickets');
      }
    },
    async resolveTicket(id, remarks) {
      const t = findTicket(id);
      if (t) {
        t.status = 'Resolved';
        t.resolvedAtMs = now();
        t.resolutionRemarks = remarks;
        t.updated_at = new Date().toISOString();
        t.messages = [...(t.messages || []), sys('Ticket marked as fixed.')];
        emit('tickets');
      }
    },
    async reopenTicket(id, reason) {
      const t = findTicket(id);
      if (t) {
        t.status = 'Pending';
        t.reopenCount = (t.reopenCount || 0) + 1;
        t.updated_at = new Date().toISOString();
        t.messages = [...(t.messages || []), sys('Ticket reopened: ' + reason)];
        emit('tickets');
      }
    },
    async escalateTicket(id) {
      const t = findTicket(id);
      if (t) {
        t.priority = 'High';
        t.updated_at = new Date().toISOString();
        emit('tickets');
      }
    },
    async submitFeedback(id, rating) {
      const t = findTicket(id);
      if (t) {
        t.rating = rating;
        emit('tickets');
      }
    },

    // ── Assignment ──
    async assignTicket(id, techId, name) {
      const t = findTicket(id);
      if (t) {
        t.assignedTo = techId;
        t.assignedToName = name;
        const tech = db.technicians.find(x => x.firebaseId === techId || x.id === techId);
        t.assignedToEmail = tech ? tech.email : null;
        t.status = 'Pending';
        t.updated_at = new Date().toISOString();
        t.messages = [...(t.messages || []), sys(`Admin assigned ticket to ${name}.`)];
        emit('tickets');
      }
    },
    autoAssignTicket: async () => null,
    autoAssignWaiting: async () => ({ assigned: 0, waiting: 0 }),
    autoAssignWaitingAsTechnician: async () => ({ assigned: 0, waiting: 0 }),

    // ── Staff ──
    subscribeToTechnicians: sub('technicians'),
    createTechnician: async (p) => {
      const tech = { firebaseId: uid(), id: uid(), status: 'On Duty', activeTasks: 0, phone: '', ...p };
      db.technicians.push(tech);
      emit('technicians');
      return tech;
    },
    updateTechnicianStatus: async (id, status) => {
      const x = db.technicians.find(t => t.firebaseId === id || t.id === id);
      if (x) {
        x.status = status;
        emit('technicians');
      }
    },
    deleteTechnician: async (id) => {
      db.technicians = db.technicians.filter(t => t.firebaseId !== id && t.id !== id);
      emit('technicians');
    },
    resetTechnicianPassword: async () => ({ tempPassword: 'Temp@' + Math.floor(1000 + Math.random() * 9000) }),
    isUsingTempPassword: async () => false,
    subscribeToCampusMembers: sub('members'),
    createCampusMember: async (p) => {
      const m = { firebaseId: uid(), uid: uid(), phone: '', ...p };
      db.members.push(m);
      emit('members');
      return { ...m, tempPassword: 'Temp@' + Math.floor(1000 + Math.random() * 9000) };
    },
    deleteCampusMember: async (u) => {
      db.members = db.members.filter(m => m.uid !== u);
      emit('members');
    },
    resolveStaffEmailByPhone: async () => null,
    rebuildStaffPhoneIndex: async () => ({ count: 0 }),
    submitProfilePhotoRequest: async () => ({ ok: true }),
    subscribeToProfileRequests: sub('profileRequests'),
    resolveProfileRequest: async () => ({ ok: true }),

    // ── Messages ──
    sendAdminMessage: async (payload) => {
      const msg = { id: uid(), at: now(), created_at: new Date().toISOString(), ...payload };
      db.adminMessages.unshift(msg);
      emit('adminMessages');
      return { ok: true };
    },
    adminStartConversation: async () => ({ ok: true }),
    replyToAdminMessage: async () => ({ ok: true }),
    subscribeToAdminMessages: sub('adminMessages'),
    subscribeToMyMessages: (u, cb) => {
      cb(db.adminMessages);
      return () => {};
    },
    markAdminMessageRead: async () => ({ ok: true }),
    markThreadReadByUser: async () => ({ ok: true }),

    // ── Notices ──
    subscribeToNotices: sub('notices'),
    postNotice: async (n) => {
      const notice = { firebaseId: uid(), id: uid(), active: true, createdAt: secs(now()), created_at: new Date().toISOString(), ...n };
      db.notices.unshift(notice);
      emit('notices');
      return notice;
    },
    endNotice: async (id) => {
      db.notices = db.notices.filter(n => n.id !== id && n.firebaseId !== id);
      emit('notices');
    },

    // ── Settings ──
    subscribeToSettings: sub('settings'),
    saveSettings: async (s) => {
      db.settings = { ...db.settings, ...s };
      emit('settings');
    },

    // ── Audit ──
    subscribeToAuditLog: sub('auditLog'),
  };
}

function delay(ms = 300) { return new Promise(r => setTimeout(r, ms)); }
function sys(text) { return { sender: 'System', text, at: now(), created_at: new Date().toISOString(), isSystem: true }; }

// Demo admin-office number used by the staff "Call" menu in mock mode
export const DEMO_ADMIN_PHONE = '+91 90000 00000';
