import { useState, useRef, useEffect, useMemo } from 'react';
import { useClerk } from '@clerk/react';
import {
  Siren, Monitor, Moon, Sun, LogOut, User, KeyRound,
  Bell, MessageSquare, Check, Clock, AlertCircle, Wrench, ShieldCheck, Ticket, CheckCheck,
  Globe, ExternalLink
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api';
import EmergencyModal from './EmergencyModal.jsx';

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Recently';
  const diffMs = Date.now() - new Date(timestamp).getTime();
  if (isNaN(diffMs) || diffMs < 0) return 'Just now';
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}

export default function TopNav({ portal, tabs, activeTab, onTab }) {
  const { user, logout, theme, cycleTheme } = useApp();
  const { openUserProfile } = useClerk();
  const [emergency, setEmergency] = useState(false);
  const [menu, setMenu] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);

  const notifRef = useRef(null);
  const msgRef = useRef(null);
  const menuRef = useRef(null);

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  const initials = (user?.name || user?.full_name || user?.email || 'U').slice(0, 1).toUpperCase();
  const role = user?.role || 'student';

  // Live ticket-driven notifications
  const [tickets, setTickets] = useState([]);
  const [readNotifIds, setReadNotifIds] = useState(() => {
    try {
      const stored = localStorage.getItem('cc_read_notifs');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!user) {
      setTickets([]);
      return;
    }
    const unsub = api.subscribeToTickets(
      { role: user.role, uid: user.clerk_id || user.id, email: user.email },
      (list) => {
        if (Array.isArray(list)) {
          setTickets(list);
        }
      },
      (err) => console.debug('[TopNav] tickets fetch error:', err)
    );
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [user?.role, user?.clerk_id, user?.id, user?.email]);

  // Derive notifications from real tickets
  const notifs = useMemo(() => {
    return tickets
      .slice()
      .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))
      .slice(0, 10)
      .map(t => {
        const id = String(t.id);
        const isUnread = !readNotifIds.includes(id);
        const time = formatTimeAgo(t.updated_at || t.created_at);

        if (t.status === 'resolved') {
          return {
            id,
            title: 'Ticket Resolved',
            desc: `"${t.title || 'Complaint'}" was marked resolved${t.acknowledged_name ? ` by ${t.acknowledged_name}` : ''}.`,
            time,
            unread: isUnread,
            type: 'success',
            Icon: Check,
            color: 'text-emerald-500'
          };
        }
        if (t.status === 'in_progress') {
          return {
            id,
            title: 'Work In Progress',
            desc: `${t.acknowledged_name ? `${t.acknowledged_name} is working on ` : 'Assigned to work on '}"${t.title || 'Complaint'}".`,
            time,
            unread: isUnread,
            type: 'info',
            Icon: Wrench,
            color: 'text-blue-500'
          };
        }
        if (t.status === 'escalated') {
          return {
            id,
            title: 'Ticket Escalated',
            desc: `"${t.title || 'Complaint'}" escalated for priority review.`,
            time,
            unread: isUnread,
            type: 'urgent',
            Icon: AlertCircle,
            color: 'text-rose-500'
          };
        }
        if (t.status === 'reopened') {
          return {
            id,
            title: 'Ticket Reopened',
            desc: `"${t.title || 'Complaint'}" was reopened for follow-up.`,
            time,
            unread: isUnread,
            type: 'warning',
            Icon: AlertCircle,
            color: 'text-amber-500'
          };
        }
        return {
          id,
          title: role === 'staff' ? 'Assigned Ticket' : 'Complaint Submitted',
          desc: `"${t.title || 'Complaint'}" registered in system.`,
          time,
          unread: isUnread,
          type: 'info',
          Icon: Ticket,
          color: 'text-amber-500'
        };
      });
  }, [tickets, readNotifIds, role]);

  // Messages (no synthetic/demo records)
  const [messages, setMessages] = useState([]);

  // Close popups on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (msgRef.current && !msgRef.current.contains(e.target)) setMsgOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadNotifsCount = notifs.filter(n => n.unread).length;
  const unreadMsgsCount = messages.filter(m => m.unread).length;

  const markAllNotifsRead = () => {
    const allIds = notifs.map(n => n.id);
    setReadNotifIds(prev => {
      const next = Array.from(new Set([...prev, ...allIds]));
      try { localStorage.setItem('cc_read_notifs', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const handleNotifClick = (id) => {
    setReadNotifIds(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try { localStorage.setItem('cc_read_notifs', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const markAllMsgsRead = () => setMessages(ms => ms.map(m => ({ ...m, unread: false })));

  return (
    <header className="sticky top-0 z-40 bg-[#262262] text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 relative">
        {/* Brand (Left) */}
        <div className="flex items-center gap-2.5 shrink-0 z-10">
          <img src="/assets/img/campuscare-mark.svg" alt="" className="w-9 h-9" />
          <div className="leading-none">
            <span className="block text-[15px] font-extrabold tracking-tight">Campus<span className="text-iiitg-gold">Care</span></span>
            <span className="block text-[9px] text-slate-300 uppercase font-bold mt-1 tracking-widest">{portal}</span>
          </div>
        </div>

        {/* Desktop Tabs (Left-aligned next to Brand) */}
        {tabs && tabs.length > 0 && (
          <nav className="hidden lg:flex items-center gap-1 ml-4 overflow-x-auto no-scrollbar z-10">
            {tabs.map(t => (
              <button key={t.key} onClick={() => onTab(t.key)}
                className={`nav-link ${activeTab === t.key ? 'active' : ''}`}>
                {t.Icon && <t.Icon className="w-4 h-4" />}{t.label}
              </button>
            ))}
          </nav>
        )}

        {/* ── Wide Official IIITG Logo Banner in Middle of Top Bar ── */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-auto">
          <div
            className="flex items-center gap-2 sm:gap-2.5 px-2.5 py-1 rounded-xl max-w-[260px] sm:max-w-md md:max-w-lg lg:max-w-xl"
          >
            {/* Static non-clickable emblem */}
            <span className="logo-plate rounded-xl p-1 sm:p-1.5 shrink-0 shadow-sm flex items-center justify-center pointer-events-none select-none">
              <img
                src="/assets/img/iiitg_emblem.png"
                alt="IIIT Guwahati"
                className="h-7 sm:h-8 w-auto object-contain"
              />
            </span>
            {/* Static non-clickable title */}
            <div className="flex flex-col text-left leading-tight min-w-0 pointer-events-none select-none">
              <span className="text-[11px] sm:text-[13px] md:text-sm font-extrabold text-white tracking-tight truncate">
                Indian Institute of Information Technology Guwahati
              </span>
              <span className="text-[9px] sm:text-[10px] md:text-[11px] font-semibold text-slate-300 tracking-tight truncate font-hindi mt-0.5">
                भारतीय सूचना प्रौद्योगिकी संस्थान गुवाहाटी · Bongora, Assam
              </span>
            </div>
            {/* Small dedicated container button to visit official IIITG website */}
            <a
              href="https://www.iiitg.ac.in"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 sm:ml-2 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold border border-white/15 transition-all flex items-center gap-1 group shrink-0"
              title="Visit official IIIT Guwahati website (iiitg.ac.in)"
            >
              <Globe className="w-3 h-3 text-iiitg-gold group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Website</span>
              <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-white transition-colors" />
            </a>
          </div>
        </div>

        {/* Right action controls */}
        <div className="flex items-center gap-2.5 shrink-0 z-10">
          {/* Theme switcher */}
          <button onClick={cycleTheme} className="nav-icon-btn p-2 rounded-xl hover:bg-white/10 transition" title={`Theme: ${theme}`}>
            <ThemeIcon className="w-5 h-5" />
          </button>

          {/* ── Messages Box ── */}
          <div className="relative" ref={msgRef}>
            <button
              onClick={() => { setMsgOpen(o => !o); setNotifOpen(false); setMenu(false); }}
              className="relative p-2 rounded-xl hover:bg-white/10 transition text-slate-200 hover:text-white"
              title="Messages & Chats"
            >
              <MessageSquare className="w-5 h-5" />
              {unreadMsgsCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-500 text-white font-black text-[9px] flex items-center justify-center ring-2 ring-[#262262]">
                  {unreadMsgsCount}
                </span>
              )}
            </button>

            {msgOpen && (
              <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 z-50 overflow-hidden animate-in fade-in duration-150">
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">Messages</span>
                    {unreadMsgsCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400">
                        {unreadMsgsCount} new
                      </span>
                    )}
                  </div>
                  {unreadMsgsCount > 0 && (
                    <button
                      onClick={markAllMsgsRead}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-80 overflow-y-auto">
                  {messages.map(m => (
                    <div
                      key={m.id}
                      onClick={() => setMessages(ms => ms.map(x => x.id === m.id ? { ...x, unread: false } : x))}
                      className={`px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition flex items-start gap-3 ${m.unread ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                        {m.sender[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{m.sender}</span>
                          <span className="text-[10px] text-slate-400 shrink-0 font-medium">{m.time}</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">{m.snippet}</p>
                        <span className="inline-block mt-1 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-1.5 py-0.5 rounded">
                          {m.tag}
                        </span>
                      </div>
                      {m.unread && <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-1.5" />}
                    </div>
                  ))}
                  {messages.length === 0 && (
                    <div className="py-8 px-4 text-center">
                      <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2 opacity-50" />
                      <p className="font-semibold text-xs text-slate-600 dark:text-slate-300">No messages yet</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Ticket discussions and direct messages will appear here.</p>
                    </div>
                  )}
                </div>

                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200/80 dark:border-slate-800 text-center">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">All ticket conversation updates are live</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Notifications Box ── */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setNotifOpen(o => !o); setMsgOpen(false); setMenu(false); }}
              className="relative p-2 rounded-xl hover:bg-white/10 transition text-slate-200 hover:text-white"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotifsCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white font-black text-[9px] flex items-center justify-center ring-2 ring-[#262262]">
                  {unreadNotifsCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 z-50 overflow-hidden animate-in fade-in duration-150">
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">Notifications</span>
                    {unreadNotifsCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400">
                        {unreadNotifsCount} new
                      </span>
                    )}
                  </div>
                  {unreadNotifsCount > 0 && (
                    <button
                      onClick={markAllNotifsRead}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-80 overflow-y-auto">
                  {notifs.map(n => {
                    const Icon = n.Icon;
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleNotifClick(n.id)}
                        className={`px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition flex items-start gap-3 ${n.unread ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}`}
                      >
                        <div className={`w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5 ${n.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{n.title}</span>
                            <span className="text-[10px] text-slate-400 shrink-0 font-medium">{n.time}</span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">{n.desc}</p>
                        </div>
                        {n.unread && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-1.5" />}
                      </div>
                    );
                  })}
                  {notifs.length === 0 && (
                    <div className="py-8 px-4 text-center">
                      <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2 opacity-50" />
                      <p className="font-semibold text-xs text-slate-600 dark:text-slate-300">No notifications yet</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Real-time alerts will appear when tickets are updated.</p>
                    </div>
                  )}
                </div>

                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200/80 dark:border-slate-800 text-center">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Campus alerts & status notifications</span>
                </div>
              </div>
            )}
          </div>

          {/* Emergency SOS button */}
          <button onClick={() => setEmergency(true)} className="emergency-btn" title="Emergency — campus help numbers">
            <Siren className="w-5 h-5" /><span className="emergency-btn-label">SOS</span>
          </button>

          {/* User Profile Avatar */}
          <div className="relative ml-1" ref={menuRef}>
            <button onClick={() => setMenu(m => !m)} className="w-9 h-9 rounded-full bg-gradient-to-tr from-iiitg-gold to-amber-300 text-iiitg-900 font-extrabold text-xs flex items-center justify-center ring-2 ring-white/20">
              {initials}
            </button>
            {menu && (
              <div className="absolute right-0 mt-3 w-60 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-2 text-sm text-slate-700 dark:text-slate-200 z-50 animate-in fade-in duration-150">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-slate-900 dark:text-white block truncate flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />{user?.name || user?.full_name || 'User'}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-xs block truncate font-mono mt-1">{user?.email}</span>
                </div>
                <button
                  onClick={() => { setMenu(false); openUserProfile?.(); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-100 dark:border-slate-800 transition-colors"
                >
                  <KeyRound className="w-4 h-4 text-slate-500 dark:text-slate-400" /> Account &amp; Password
                </button>
                <button onClick={logout} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-rose-600 dark:text-rose-400 font-semibold transition-colors">
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile tabs */}
      <nav className="md:hidden flex items-center gap-1 px-3 pb-2 overflow-x-auto no-scrollbar">
        {tabs.map(t => (
          <button key={t.key} onClick={() => onTab(t.key)} className={`nav-link text-xs ${activeTab === t.key ? 'active' : ''}`}>
            {t.Icon && <t.Icon className="w-4 h-4" />}{t.label}
          </button>
        ))}
      </nav>

      {emergency && <EmergencyModal onClose={() => setEmergency(false)} />}
    </header>
  );
}
