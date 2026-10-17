// REST client - maps every backend endpoint in router.py 1-to-1.
// Auth: Clerk JWT is injected automatically by client.js via setClerkGetToken.
import { http, setToken, getToken } from './client.js';
import { POLL_INTERVAL } from './config.js';
import { getTicketCoords } from '../lib/ticketUtils.js';

function poll(fetchFn, cb, onError, onSync) {
  let stopped = false;
  let first = true;
  const tick = async () => {
    try {
      const token = await getToken();
      if (!token) return; // Wait until token is available before calling protected backend routes
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
  let location = t.location;
  let latitude = t.latitude;
  let longitude = t.longitude;

  if ((!latitude || !longitude) && typeof t.description === 'string') {
    const coordMatch = t.description.match(/\(?([0-9]{1,2}\.[0-9]{3,8}),\s*([0-9]{1,3}\.[0-9]{3,8})\)?/);
    if (coordMatch) {
      latitude = parseFloat(coordMatch[1]);
      longitude = parseFloat(coordMatch[2]);
    }
  }

  if (!location && typeof t.description === 'string' && t.description.includes('📍 Location:')) {
    const locMatch = t.description.match(/📍 Location:\s*([^\n(]+)(?:\s*\(([\d.-]+),\s*([\d.-]+)\))?/);
    if (locMatch) {
      location = locMatch[1].trim();
      if (!latitude && !longitude && locMatch[2] && locMatch[3]) {
        latitude = parseFloat(locMatch[2]);
        longitude = parseFloat(locMatch[3]);
      }
    }
  }

  // Automatically resolve / fix coordinates for existing tickets
  const resolved = getTicketCoords({ ...t, location, latitude, longitude });
  if (resolved) {
    latitude = resolved.lat;
    longitude = resolved.lng;
  }

  let isPublic = Boolean(t.isPublic ?? t.is_public ?? false);
  if (!isPublic && typeof t.description === 'string') {
    if (
      t.description.includes('🌐 Public: true') ||
      t.description.includes('[SHARED]') ||
      t.description.includes('[PUBLIC]') ||
      /lost\s*&?\s*found/i.test(t.title || '') ||
      /lost\s*&?\s*found/i.test(t.categoryDisplay || '')
    ) {
      isPublic = true;
    }
  }

  let cleanDesc = t.description;
  if (typeof cleanDesc === 'string') {
    cleanDesc = cleanDesc
      .replace(/\s*🌐\s*Public:\s*(true|false)/gi, '')
      .replace(/\s*📍\s*Location:[\s\S]*$/, '')
      .trim();
  }

  const upvotes = t.upvotes ?? (isPublic ? 1 : 0);

  return {
    ...t,
    description: cleanDesc,
    isPublic,
    is_public: isPublic,
    upvotes,
    upvotedBy: t.upvoted_by || t.upvotedBy || [],
    location: location || null,
    latitude: latitude || null,
    longitude: longitude || null,
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

    uploadFile: async (file, ticketId) => {
      const isUuid = typeof ticketId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticketId);
      const res = await http.upload('/api/files/upload', file, isUuid ? { ticket_id: ticketId } : {});
      return typeof res === 'string' ? res : (res?.secure_url || res?.url || res);
    },
    getUploadSignature: (filename, contentType) =>
      http.post(`/api/files/upload/signature?filename=${encodeURIComponent(filename)}&content_type=${encodeURIComponent(contentType)}`),
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
      
      // Resolve string IDs to UUIDs by fetching from the backend
      if (!catId || !catId.includes('-') || !deptId || !deptId.includes('-')) {
        try {
          const depts = await http.get('/api/departments');
          const { CATEGORIES } = await import('../data/catalog.js');
          const catObj = CATEGORIES.find(c => c.key === catId);
          const targetKey = catObj?.submitAs || catId || 'Other';
          const resolvedObj = CATEGORIES.find(c => c.key === targetKey) || catObj;
          const team = resolvedObj?.team || 'Other';

          const dept = (Array.isArray(depts) ? depts : []).find(d => d.name === team)
            || (Array.isArray(depts) ? depts : []).find(d => d.name === 'Other')
            || (Array.isArray(depts) && depts.length ? depts[0] : null);

          if (dept) {
            deptId = dept.id;
            const cats = await http.get(`/api/departments/${encodeURIComponent(dept.id)}/categories`);
            const catList = Array.isArray(cats) ? cats : [];
            const catRow = catList.find(c => c.name === catId || c.name === targetKey || c.name === 'Other')
              || catList[0];
            if (catRow) catId = catRow.id;
          }
        } catch (e) {
          console.error('Failed to resolve category/department UUIDs', e);
        }
      }

      let desc = p.description || '';
      if (p.isPublic) {
        desc = `${desc}\n\n🌐 Public: true`;
      }
      if (p.location && !desc.includes('📍 Location:')) {
        const coordsStr = (p.latitude && p.longitude) ? ` (${Number(p.latitude).toFixed(5)}, ${Number(p.longitude).toFixed(5)})` : '';
        desc = `${desc}\n\n📍 Location: ${p.location}${coordsStr}`;
      }

      const isConfidential = p.confidential !== undefined ? Boolean(p.confidential) : (p.isPublic !== undefined ? !p.isPublic : false);
      const res = await http.post('/api/tickets', {
        title: p.title || p.categoryDisplay || `${p.category} - ${p.subCategory}`,
        description: desc,
        category_id: catId,
        department_id: deptId,
        confidential: isConfidential,
      });
      return normalizeTicket({ ...res, isPublic: !isConfidential, photoUrl: p.photoUrl || res?.photoUrl || null, location: p.location, latitude: p.latitude, longitude: p.longitude });
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
    updateTechnicianStatus: (id, status) => http.put(`/api/staff/technicians/${encodeURIComponent(id)}/status`, { status }),
    updateMyDutyStatus: (status) => http.put('/api/staff/me/status', { status }),
    resetTechnicianPassword: (id) => http.post(`/api/admin/users/${encodeURIComponent(id)}/reset-password`),

    adminStartConversation: (recipientId, text) => http.post('/api/messages', { recipient_id: recipientId, text }),
    replyToAdminMessage: (threadId, text) => http.post('/api/messages', { thread_id: threadId, text }),
    addTicketMessage: (ticketId, m) => http.post('/api/messages', { thread_id: ticketId, text: typeof m === 'string' ? m : m.text }),
    sendAdminMessage: (text, recipientId) => http.post('/api/messages', { text, recipient_id: recipientId }),
    subscribeToAdminMessages: (cb, onError, onSync) =>
      poll(() => http.get('/api/messages/admin'), cb, onError, onSync),
    subscribeToMyMessages: (uid, cb, onError, onSync) =>
      poll(() => http.get(`/api/messages/me/${encodeURIComponent(uid)}`), cb, onError, onSync),
    getThread: (threadId) => http.get(`/api/messages/thread/${encodeURIComponent(threadId)}`),
    getTicketMessages: (threadId) => http.get(`/api/messages/thread/${encodeURIComponent(threadId)}`),
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
