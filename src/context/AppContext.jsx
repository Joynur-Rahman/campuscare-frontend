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
  const [booting, setBooting] = useState(false);
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

  useEffect(() => {
    if (authLoaded && userLoaded) {
      if (clerkUser) {
        // Stay in booting state until we know the real role from the backend
        const baseUser = {
          id: clerkUser.id,
          email: clerkUser.primaryEmailAddress?.emailAddress || '',
          full_name: clerkUser.fullName || clerkUser.firstName || '',
          avatar_url: clerkUser.imageUrl || null,
          role: 'student', // default until /api/auth/me responds
        };
        getToken()
          .then(token => {
            console.log('[Auth] Clerk token obtained:', token ? 'YES (length=' + token.length + ')' : 'NULL');
            if (token) {
              return http.get('/api/auth/me', {
                email: clerkUser.primaryEmailAddress?.emailAddress || '',
                name: clerkUser.fullName || clerkUser.firstName || ''
              })
                .then(profile => {
                  console.log('[Auth] /api/auth/me response:', profile);
                  setUser({ ...baseUser, ...(profile || {}) });
                })
                .catch(async err => {
                  console.error('[Auth] /api/auth/me failed:', err.message, err.status);
                  if (err.status === 403 || (err.message && err.message.toLowerCase().includes('restricted'))) {
                    showToast(
                      err.message || 'Registration is restricted to @iiitg.ac.in emails. Staff and technicians must be added by the Administrator.',
                      'error'
                    );
                    setUser(null);
                    try { await signOut(); } catch {}
                  } else {
                    const email = (clerkUser.primaryEmailAddress?.emailAddress || '').toLowerCase();
                    if (email.endsWith('@iiitg.ac.in')) {
                      setUser(baseUser);
                    } else {
                      showToast(err.message || 'Authentication error. Please contact administrator.', 'error');
                      setUser(null);
                      try { await signOut(); } catch {}
                    }
                  }
                });
            }
            console.warn('[Auth] No Clerk token');
            const email = (clerkUser.primaryEmailAddress?.emailAddress || '').toLowerCase();
            if (email.endsWith('@iiitg.ac.in')) {
              setUser(baseUser);
            } else {
              setUser(null);
            }
          })
          .catch(async err => {
            console.error('[Auth] getToken failed:', err);
            setUser(null);
            try { await signOut(); } catch {}
          })
          .finally(() => setBooting(false));
      } else {
        // If Clerk is not logged in, keep existing mock user if available
        try {
          const saved = localStorage.getItem('cc_mock_user');
          if (saved) {
            setUser(JSON.parse(saved));
          } else {
            // Default demo student in mock mode
            setUser({ id: 'stu-1', uid: 'stu-1', email: 'ujjwal@iiitg.ac.in', name: 'Ujjwal Prakash', full_name: 'Ujjwal Prakash', role: 'student' });
          }
        } catch {
          setUser({ id: 'stu-1', uid: 'stu-1', email: 'ujjwal@iiitg.ac.in', name: 'Ujjwal Prakash', full_name: 'Ujjwal Prakash', role: 'student' });
        }
        setBooting(false);
      }
    }
  }, [authLoaded, userLoaded, clerkUser, signOut, showToast]);

  const login = useCallback(async (payload) => {
    // Legacy mock login support or throw error
    throw new Error('Please use the Clerk login interface.');
  }, []);

  const mockLogin = useCallback((role = 'student') => {
    let mockUser;
    if (role === 'administrator' || role === 'admin') {
      mockUser = { id: 'admin-1', uid: 'admin-1', email: 'admin@iiitg.ac.in', name: 'Administrator', full_name: 'Administrator', role: 'administrator' };
    } else if (role === 'staff' || role === 'tech') {
      mockUser = { id: 'tech-1', uid: 'tech-1', email: 'tech@iiitg.ac.in', name: 'Ujjwal (IT Tech)', full_name: 'Ujjwal (IT Tech)', role: 'staff', status: 'On Duty' };
    } else {
      mockUser = { id: 'stu-1', uid: 'stu-1', email: 'ujjwal@iiitg.ac.in', name: 'Ujjwal Prakash', full_name: 'Ujjwal Prakash', role: 'student' };
    }
    setUser(mockUser);
    showToast(`Logged in as ${mockUser.name} (${role})`, 'success');
  }, [showToast]);
  
  const logout = useCallback(async () => {
    try { await signOut(); } catch {}
    try { localStorage.removeItem('cc_mock_user'); } catch {}
    setUser(null);
  }, [signOut]);

  // ── theme ──
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
      root.setAttribute('data-theme', dark ? 'dark' : 'light');
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

  const value = { user, setUser, booting, login, logout, mockLogin, theme, setTheme, cycleTheme, toasts, showToast, dismissToast, api };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
