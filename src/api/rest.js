// REST client - maps every backend endpoint in router.py 1-to-1.
// Auth: Clerk JWT is injected automatically by client.js via setClerkGetToken.
import { http, setToken } from './client.js';
import { POLL_INTERVAL } from './config.js';

function poll(fetchFn, cb, onError, onSync) {
  let stopped = false;
  let first = true;
  const tick = async () => {
    try {
      const data = await fetchFn();
      if (stopped) return;
      cb(data);
      if (first && onSync) { first = false; onSync({ fromCache: false }); }
    } catch (e) {
      if (!stopped && onError) onError(e);
    }
  };
  tick();
  const id = setInterval(tick, POLL_INTERVAL);
  return () => { stopped = true; clearInterval(id); };
}

function flatten(obj) {
  const out = {};
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') out[k] = String(v);
  });
  return out;
}

function normalizeTicket(t) {
  if (!t || typeof t !== 'object') return t;
  return {
    ...t,
    assignedTo: t.assignedTo || t.assigned_to || null,
    assigned_to: t.assigned_to || t.assignedTo || null,
    userId: t.userId || t.owner_id || null,
    owner_id: t.owner_id || t.userId || null,
    createdAt: t.createdAt || t.created_at || null,
    created_at: t.created_at || t.createdAt || null,
    categoryDisplay: t.categoryDisplay || t.title || 'Issue',
    title: t.title || t.categoryDisplay || 'Issue',
  };
}

function normalizeTech(t) {
  if (!t || typeof t !== 'object') return t;
  const id = t.clerk_id || t.firebaseId || t.id;
  return {
    ...t,
    id,
    firebaseId: id,
    clerk_id: id,
    name: t.full_name || t.name || t.email?.split('@')[0] || 'Staff',
    full_name: t.full_name || t.name || 'Staff',
    dept: t.dept || t.department || 'Maintenance',
    status: t.status || 'On Duty',
  };
}

export function createRestApi() {
  let currentUser = null;
  const authListeners = new Set();
  const notifyAuth = (u) => { currentUser = u; authListeners.forEach(fn => { try { fn(u); } catch {} }); };

  return {
    getCurrentUser: () => currentUser,
    onAuthChange(cb) { authListeners.add(cb); cb(currentUser); return () => authListeners.delete(cb); },
    async login() { throw new Error('Use Clerk for authentication.'); },
    async logout() { setToken(null); notifyAuth(null); },
    async restoreSession() { return null; },

    getMe: () => http.get('/api/auth/me'),
    getSession: () => http.get('/api/auth/session'),
    getAdminEmails: () => http.get('/api/auth/admin-emails'),
    getRoles: (userId) => http.get(`/api/auth/roles/${encodeURIComponent(userId)}`),
    verifyRole: (role) => http.post('/api/auth/verify-role', { role }),

    getMyProfile: () => http.get('/api/users/me'),
    saveMyProfile: (p) => http.put('/api/users/me', p),

    getDepartments: () => http.get('/api/departments'),
    getCategoriesByDepartment: (deptId) => http.get(`/api/departments/${encodeURIComponent(deptId)}/categories`),

    uploadFile: (file, ticketId) => http.upload('/api/files/upload', file, ticketId ? { ticket_id: ticketId } : {}),
    deleteFile: (mediaId) => http.del(`/api/files/${encodeURIComponent(mediaId)}`),

    subscribeToTickets: (scope, cb, onError, onSync) =>
      poll(async () => {
        const list = await http.get('/api/tickets', scope ? flatten(scope) : undefined);
        return Array.isArray(list) ? list.map(normalizeTicket) : list;
      }, cb, onError, onSync),
    subscribeToConfidentialTickets: (uid, isAdmin, cb, onError, onSync) =>
      poll(async () => {
        const list = await http.get('/api/tickets/confidential');
        return Array.isArray(list) ? list.map(normalizeTicket) : list;
      }, cb, onError, onSync),
    findSimilarTickets: async (q) => {
      const list = await http.get('/api/tickets/similar', flatten({ q }));
      return Array.isArray(list) ? list.map(normalizeTicket) : list;
    },
    getTicket: async (id) => {
      const t = await http.get(`/api/tickets/${encodeURIComponent(id)}`);
      return normalizeTicket(t);
    },
    createTicket: async (p) => {
      let catId = p.category_id ?? p.category;
      let deptId = p.department_id ?? p.department;
      
      // Resolve mock string IDs to UUIDs by fetching from the backend
      if (catId && !catId.includes('-')) {
        try {
          const depts = await http.get('/api/departments');
          // We need the mock catalog to know which team (department) this category belongs to
          const { CATEGORIES } = await import('../data/catalog.js');
          const catObj = CATEGORIES.find(c => c.key === catId);
          if (catObj) {
            const team = catObj.team;
            const dept = depts.find(d => d.name === team);
            if (dept) {
              deptId = dept.id;
              const cats = await http.get(`/api/departments/${encodeURIComponent(dept.id)}/categories`);
              const catRow = cats.find(c => c.name === catId);
              if (catRow) catId = catRow.id;
            }
          }
        } catch (e) {
          console.error('Failed to resolve category/department UUIDs', e);
        }
      }

      const res = await http.post('/api/tickets', {
        title: p.title || p.categoryDisplay || `${p.category} - ${p.subCategory}`,
        description: p.description,
        category_id: catId,
        department_id: deptId,
        confidential: p.confidential ?? false,
      });
      return normalizeTicket(res);
    },
    followTicket: (id) => http.post(`/api/tickets/${encodeURIComponent(id)}/follow`),
    unfollowTicket: (id) => http.del(`/api/tickets/${encodeURIComponent(id)}/follow`),
    joinTicket: (id) => http.post(`/api/tickets/${encodeURIComponent(id)}/join`),
    proposeAppointment: (id, w) => http.post(`/api/tickets/${encodeURIComponent(id)}/appointment`, { starts_at: w.starts_at, ends_at: w.ends_at }),
    respondToAppointment: (id, decision) => http.put(`/api/tickets/${encodeURIComponent(id)}/appointment`, { decision }),
    acknowledgeTicket: (id, techId, name) => http.post(`/api/tickets/${encodeURIComponent(id)}/acknowledge`, { technician_id: techId, name }),
    updateTicketStatus: (id, status, remarks, attachments) => http.put(`/api/tickets/${encodeURIComponent(id)}/status`, { status, remarks, attachments: attachments ?? [] }),
    resolveTicket: (id, remarks, photo, materials) => http.post(`/api/tickets/${encodeURIComponent(id)}/resolve`, { remarks, attachments: [photo, ...(materials ?? [])].filter(Boolean) }),
    reopenTicket: (id, reason) => http.post(`/api/tickets/${encodeURIComponent(id)}/reopen`, { remarks: reason }),
    escalateTicket: (id) => http.post(`/api/tickets/${encodeURIComponent(id)}/escalate`, {}),
    submitFeedback: (id, rating, comment) => http.post(`/api/tickets/${encodeURIComponent(id)}/feedback`, { rating, comment }),

    assignTicket: (id, techId) => http.post(`/api/assignments/tickets/${encodeURIComponent(id)}/assign`, { technician_id: techId }),

    subscribeToTechnicians: (scope, cb, onError, onSync) =>
      poll(async () => {
        const list = await http.get('/api/staff/technicians', scope ? flatten(scope) : undefined);
        return Array.isArray(list) ? list.map(normalizeTech) : list;
      }, cb, onError, onSync),

    subscribeToCampusMembers: (cb, onError, onSync) =>
      poll(() => http.get('/api/admin/users'), cb, onError, onSync),
    updateUserRole: (userId, role) => http.put(`/api/admin/users/${encodeURIComponent(userId)}/role`, { role }),

    createTechnician: async (p) => {
      const res = await http.post('/api/admin/users', { name: p.name, email: p.email, phone: p.phone, role: 'staff', department: p.dept });
      return normalizeTech(res);
    },
    createCampusMember: async (p) => {
      const res = await http.post('/api/admin/users', { name: p.name, email: p.email, phone: p.phone, role: 'staff', department: p.section });
      return res;
    },
    deleteTechnician: (id) => http.del(`/api/admin/users/${encodeURIComponent(id)}`),
    deleteCampusMember: (id) => http.del(`/api/admin/users/${encodeURIComponent(id)}`),
    updateTechnicianStatus: (id, status) => Promise.resolve({ id, status }),
    resetTechnicianPassword: (id) => Promise.resolve({ tempPassword: 'Reset email sent' }),

    adminStartConversation: (recipientId, text) => http.post('/api/messages', { recipient_id: recipientId, text }),
    replyToAdminMessage: (threadId, text) => http.post('/api/messages', { thread_id: threadId, text }),
    addTicketMessage: (ticketId, m) => http.post('/api/messages', { thread_id: ticketId, text: typeof m === 'string' ? m : m.text }),
    sendAdminMessage: (text, recipientId) => http.post('/api/messages', { text, recipient_id: recipientId }),
    subscribeToAdminMessages: (cb, onError, onSync) =>
      poll(() => http.get('/api/messages/admin'), cb, onError, onSync),
    subscribeToMyMessages: (uid, cb, onError, onSync) =>
      poll(() => http.get(`/api/messages/me/${encodeURIComponent(uid)}`), cb, onError, onSync),
    getThread: (threadId) => http.get(`/api/messages/thread/${encodeURIComponent(threadId)}`),
    markAdminMessageRead: (id) => http.put(`/api/messages/${encodeURIComponent(id)}/read`),
    markThreadReadByUser: (id) => http.put(`/api/messages/${encodeURIComponent(id)}/read`),

    subscribeToNotices: (cb, onError, onSync) =>
      poll(() => http.get('/api/notices'), cb, onError, onSync),
    postNotice: (n) => http.post('/api/notices', { title: n.title, body: n.body }),
    endNotice: (id) => http.put(`/api/notices/${encodeURIComponent(id)}/end`),

    subscribeToSettings: (cb, onError, onSync) =>
      poll(() => http.get('/api/settings'), cb, onError, onSync),
    saveSettings: (config) => http.put('/api/settings', { config }),

    subscribeToAuditLog: (cb, onError, onSync) =>
      poll(() => http.get('/api/audit-log'), cb, onError, onSync),
    exportAuditLog: () => http.get('/api/audit-log/export'),
    applyAuditRetention: (days = 90) => http.del(`/api/audit-log?older_than_days=${days}`),
  };
}