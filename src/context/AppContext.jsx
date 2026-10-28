import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useUser, useAuth, useClerk } from '@clerk/react';
import { api } from '../api';
import { setClerkGetToken, getToken, http } from '../api/client';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export function AppProvider({ children }) {
  const { user: clerkUser, isLoaded: userLoaded } = useUser();
  const { getToken, isLoaded: authLoaded } = useAuth();
  const { signOut } = useClerk();
  
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('cc_theme') || 'auto'; } catch { return 'auto'; }
  });
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  // ── toasts ──
  const showToast = useCallback((message, type = 'info') => {
    const id = ++toastId.current;
    setToasts(ts => [...ts, { id, message, type }]);
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 4000);
  }, []);
  const dismissToast = useCallback((id) => setToasts(ts => ts.filter(t => t.id !== id)), []);

  // ── auth session ──
  useEffect(() => {
    setClerkGetToken(getToken);
  }, [getToken]);

  // Real Clerk session restore
  useEffect(() => {
    if (!authLoaded || !userLoaded) return;

    if (!clerkUser) {
      setUser(null);
      setBooting(false);
      return;
    }

    const baseUser = {
      id: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress || '',
      full_name: clerkUser.fullName || clerkUser.firstName || '',
      avatar_url: clerkUser.imageUrl || null,
      role: 'student',
    };

    // 1. Instant load from locally cached profile (eliminates loading delays)
    let hasCached = false;
    try {
      const cached = localStorage.getItem('cc_profile_' + clerkUser.id);
      if (cached) {
        const parsed = JSON.parse(cached);
        setUser({ ...baseUser, ...parsed });
        setBooting(false);
        hasCached = true;
      }
    } catch {}

    // 2. Safety timeout: Never keep the user on the booting screen for more than 2.5s
    const bootTimer = setTimeout(() => {
      setBooting(false);
    }, 2500);

    // 3. Fetch fresh profile from backend to verify role & status
    getToken()
      .then(token => {
        if (token) {
          return http.get('/api/auth/me', {
            email: clerkUser.primaryEmailAddress?.emailAddress || '',
            name: clerkUser.fullName || clerkUser.firstName || ''
          })
            .then(profile => {
              const full = { ...baseUser, ...(profile || {}) };
              setUser(full);
              try {
                localStorage.setItem('cc_profile_' + clerkUser.id, JSON.stringify(profile || {}));
              } catch {}
            })
            .catch(async err => {
              console.error('[Auth] /api/auth/me failed:', err.message, err.status);
              if (err.status === 403 || (err.message && err.message.toLowerCase().includes('restricted'))) {
                showToast(
                  err.message || 'Registration is restricted to @iiitg.ac.in emails. Staff and technicians must be added by the Administrator.',
                  'error'
                );
                setUser(null);
                try { localStorage.removeItem('cc_profile_' + clerkUser.id); } catch {}
                try { await signOut(); } catch {}
              } else {
                const email = (clerkUser.primaryEmailAddress?.emailAddress || '').toLowerCase();
                if (email.endsWith('@iiitg.ac.in')) {
                  if (!hasCached) setUser(baseUser);
                } else {
                  showToast(err.message || 'Authentication error. Please contact administrator.', 'error');
                  setUser(null);
                  try { await signOut(); } catch {}
                }
              }
            });
        } else {
          const email = (clerkUser.primaryEmailAddress?.emailAddress || '').toLowerCase();
          if (email.endsWith('@iiitg.ac.in')) {
            if (!hasCached) setUser(baseUser);
          } else {
            setUser(null);
          }
        }
      })
      .catch(async err => {
        console.error('[Auth] getToken failed:', err);
        setUser(null);
        try { await signOut(); } catch {}
      })
      .finally(() => {
        clearTimeout(bootTimer);
        setBooting(false);
      });

    return () => clearTimeout(bootTimer);
  }, [authLoaded, userLoaded, clerkUser, signOut, showToast]);

  const login = useCallback(async () => {
    throw new Error('Please use the Clerk login interface.');
  }, []);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
  }, [signOut]);

  // ── theme ──
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
      root.setAttribute('data-theme', dark ? 'dark' : 'light');
      root.classList.toggle('dark', dark);
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) {
        metaTheme.setAttribute('content', dark ? '#101214' : '#dfe7e5');
      }
    };
    apply();
    try { localStorage.setItem('cc_theme', theme); } catch {}
    if (theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener?.('change', apply);
      return () => mq.removeEventListener?.('change', apply);
    }
  }, [theme]);
  const cycleTheme = useCallback(() => setTheme(t => (t === 'auto' ? 'light' : t === 'light' ? 'dark' : 'auto')), []);
  const [ticketModal, setTicketModal] = useState(null);

  const markTicketMessagesRead = useCallback((ticketId) => {
    if (!ticketId) return;
    const sId = String(ticketId);
    const uid = user?.clerk_id || user?.id || 'guest';
    const now = Date.now();
    try {
      const threadKey = `cc_read_threads_${uid}`;
      const existingThreads = JSON.parse(localStorage.getItem(threadKey) || '{}');
      existingThreads[sId] = now;
      localStorage.setItem(threadKey, JSON.stringify(existingThreads));

      // Also ensure legacy/backup notifs key includes sId so old readers remain consistent
      const notifKey = `cc_read_notifs_${uid}`;
      const notifs = JSON.parse(localStorage.getItem(notifKey) || '[]');
      if (!notifs.includes(sId)) {
        notifs.push(sId);
        localStorage.setItem(notifKey, JSON.stringify(notifs));
      }
      const legacyNotifs = JSON.parse(localStorage.getItem('cc_read_notifs') || '[]');
      if (!legacyNotifs.includes(sId)) {
        legacyNotifs.push(sId);
        localStorage.setItem('cc_read_notifs', JSON.stringify(legacyNotifs));
      }
    } catch {}

    // Dispatch global event so TopNav updates instantly without delay
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cc-messages-read', { detail: { ticketId: sId, at: now } }));
    }

    // Inform backend to mark messages read in the database
    if (api?.markThreadMessagesRead) {
      api.markThreadMessagesRead(sId);
    }
  }, [user?.clerk_id, user?.id, api]);

  const openTicket = useCallback(async (ticketOrId) => {
    if (!ticketOrId) return;
    const tid = typeof ticketOrId === 'object' ? ticketOrId.id : String(ticketOrId);
    if (tid) markTicketMessagesRead(tid);
    if (typeof ticketOrId === 'object' && ticketOrId.id) {
      setTicketModal(ticketOrId);
      return;
    }
    const ticketId = String(ticketOrId);
    try {
      const full = await api.getTicket(ticketId);
      if (full) {
        setTicketModal(full);
      } else {
        setTicketModal({ id: ticketId, title: 'Ticket ' + ticketId });
      }
    } catch (e) {
      console.error('[AppContext] Failed to fetch ticket for modal:', e);
      setTicketModal({ id: ticketId, title: 'Ticket ' + ticketId });
    }
  }, [api, markTicketMessagesRead]);

  const closeTicket = useCallback(() => {
    setTicketModal(null);
  }, []);

  // ── shared tickets subscription (single unified stream for TopNav & Portals) ──
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  useEffect(() => {
    if (!user) {
      setTickets([]);
      setLoadingTickets(false);
      return;
    }
    const roleStr = (user.role || 'student').toLowerCase();
    const isAdmin = roleStr === 'admin' || roleStr === 'administrator';
    const scope = isAdmin
      ? { role: 'admin' }
      : {
          role: roleStr,
          uid: user.clerk_id || user.id || user.uid,
          email: user.email,
        };

    const unsub = api.subscribeToTickets(
      scope,
      (list) => {
        if (Array.isArray(list)) {
          setTickets(list);
        }
        setLoadingTickets(false);
      },
      (err) => {
        console.debug('[AppContext] tickets subscribe error:', err);
        setLoadingTickets(false);
      },
      () => setLoadingTickets(false)
    );
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [user?.role, user?.clerk_id, user?.id, user?.uid, user?.email, api]);

  const value = {
    user,
    setUser,
    booting,
    login,
    logout,
    theme,
    cycleTheme,
    toasts,
    showToast,
    dismissToast,
    api,
    ticketModal,
    openTicket,
    closeTicket,
    markTicketMessagesRead,
    tickets,
    setTickets,
    loadingTickets,
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
