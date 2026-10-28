import { useState, useRef, useEffect, useMemo } from 'react';
import { useClerk } from '@clerk/react';
import {
  Siren, Monitor, Moon, Sun, LogOut, User, KeyRound,
  Bell, MessageSquare, Check, Clock, AlertCircle, Wrench, ShieldCheck, Ticket, CheckCheck
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api';
import EmergencyModal from './EmergencyModal.jsx';
import { shortTicketId, isLostFound } from '../lib/ticketUtils.js';

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
  const { user, logout, theme, cycleTheme, openTicket, tickets = [] } = useApp();
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
  const uid = user?.clerk_id || user?.id;
  const uKey = uid || 'guest';

  // Live ticket-driven notifications
  const [readNotifIds, setReadNotifIds] = useState(() => {
    try {
      const stored = localStorage.getItem(`cc_read_notifs_${uKey}`) || localStorage.getItem('cc_read_notifs');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });



  // Derive notifications from real tickets (scoped to relevant user)
  const notifs = useMemo(() => {
    const roleStr = (user?.role || role || '').toLowerCase();
    const isAdmin = roleStr === 'admin' || roleStr === 'administrator';
    const isStaff = roleStr === 'staff' || roleStr === 'technician';
    const myEmail = (user?.email || '').toLowerCase().trim();

    return tickets
      .filter(t => {
        if (isAdmin) return true;
        if (isStaff) {
          return Boolean(uid && (t.assigned_to === uid || t.assignedTo === uid));
        }
        // Students & general users: strictly their own tickets, or public shared tickets they explicitly joined
        const isOwner = Boolean(
          (uid && (t.owner_id === uid || t.ownerId === uid || t.clerk_id === uid || t.userId === uid || t.user_id === uid)) ||
          (myEmail && (t.userEmail || t.owner_email || '').toLowerCase().trim() === myEmail)
        );
        const hasJoined = Boolean(
          uid && Array.isArray(t.upvoted_by || t.upvotedBy) && (t.upvoted_by || t.upvotedBy).includes(uid)
        );
        return isOwner || (Boolean(t.isPublic) && hasJoined);
      })
      .slice()
      .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))
      .slice(0, 10)
      .map(t => {
        const id = String(t.id);
        const isUnread = !readNotifIds.includes(id);
        const time = formatTimeAgo(t.updated_at || t.created_at);
        const shortId = shortTicketId(t);

        if (t.status === 'resolved') {
          return {
            id,
            ticketId: t.id,
            ticket: t,
            shortId,
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
            ticketId: t.id,
            ticket: t,
            shortId,
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
            ticketId: t.id,
            ticket: t,
            shortId,
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
            ticketId: t.id,
            ticket: t,
            shortId,
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
          ticketId: t.id,
          ticket: t,
          shortId,
          title: isStaff ? 'Assigned Ticket' : 'Complaint Submitted',
          desc: `"${t.title || 'Complaint'}" registered in system.`,
          time,
          unread: isUnread,
          type: 'info',
          Icon: Ticket,
          color: 'text-amber-500'
        };
      });
  }, [tickets, readNotifIds, role, uid, user?.email, user?.role]);

  // ── Administrator & Ticket Messages ──
  const [adminMsgs, setAdminMsgs] = useState([]);
  const [msgTab, setMsgTab] = useState('tickets'); // 'tickets' | 'admin'
  const [readAdminMsgIds, setReadAdminMsgIds] = useState(() => {
    try {
      const stored = localStorage.getItem(`cc_read_admin_msgs_${uKey}`) || localStorage.getItem('cc_read_admin_msgs');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [readThreads, setReadThreads] = useState(() => {
    try {
      const stored = localStorage.getItem(`cc_read_threads_${uKey}`);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Re-sync from localStorage when active user changes
  useEffect(() => {
    if (!user) return;
    const currentKey = user.clerk_id || user.id || 'guest';
    try {
      const storedAdmin = localStorage.getItem(`cc_read_admin_msgs_${currentKey}`) || localStorage.getItem('cc_read_admin_msgs');
      if (storedAdmin) setReadAdminMsgIds(JSON.parse(storedAdmin));
      const storedThreads = localStorage.getItem(`cc_read_threads_${currentKey}`);
      if (storedThreads) setReadThreads(JSON.parse(storedThreads));
      const storedNotifs = localStorage.getItem(`cc_read_notifs_${currentKey}`) || localStorage.getItem('cc_read_notifs');
      if (storedNotifs) setReadNotifIds(JSON.parse(storedNotifs));
    } catch {}
  }, [user?.clerk_id, user?.id]);

  // Listen to global thread read events emitted by TicketDetailModal or AppContext
  useEffect(() => {
    const onRead = (e) => {
      const { ticketId, at = Date.now() } = e?.detail || {};
      if (!ticketId) return;
      const sId = String(ticketId);
      setReadThreads(prev => {
        const next = { ...prev, [sId]: Math.max(prev[sId] || 0, at) };
        try {
          const currentKey = user?.clerk_id || user?.id || 'guest';
          localStorage.setItem(`cc_read_threads_${currentKey}`, JSON.stringify(next));
        } catch {}
        return next;
      });
    };
    window.addEventListener('cc-messages-read', onRead);
    return () => window.removeEventListener('cc-messages-read', onRead);
  }, [user?.clerk_id, user?.id]);

  // Subscribe to live administrator messages (only for admin users)
  useEffect(() => {
    const roleStr = (user?.role || '').toLowerCase();
    const isAdmin = roleStr === 'admin' || roleStr === 'administrator';
    if (!isAdmin || !api?.subscribeToAdminMessages) return;
    const unsub = api.subscribeToAdminMessages((list) => {
      if (Array.isArray(list)) setAdminMsgs(list);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [api, user?.role]);

  // The ticket list doesn't carry chat messages, so load active tickets for non-admin users
  const [threads, setThreads] = useState({});
  useEffect(() => {
    if (!msgOpen || !api?.getTicketMessages || !tickets.length) return;
    const roleStr = (user?.role || '').toLowerCase();
    const isAdmin = roleStr === 'admin' || roleStr === 'administrator';
    // For admin, adminMsgs already provides live messages for all tickets via a single fast query
    if (isAdmin) return;

    let alive = true;
    const currentUid = user?.clerk_id || user?.id;
    const myEmail = (user?.email || '').toLowerCase().trim();
    const isStudent = roleStr === 'student' || role === 'student';
    const mine = tickets.filter(t => {
      if (!isStudent) return true;
      if (!currentUid && !myEmail) return false;
      const isOwner = Boolean(
        (currentUid && (t.owner_id === currentUid || t.ownerId === currentUid || t.clerk_id === currentUid || t.userId === currentUid || t.user_id === currentUid)) ||
        (myEmail && (t.userEmail || t.owner_email || '').toLowerCase().trim() === myEmail)
      );
      return isOwner || isLostFound(t);
    });
    const recent = mine
      .slice()
      .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))
      .slice(0, 8);

    const load = async () => {
      const results = await Promise.allSettled(recent.map(t => api.getTicketMessages(t.id)));
      if (!alive) return;
      setThreads(prev => {
        const next = { ...prev };
        results.forEach((r, i) => {
          if (r.status === 'fulfilled' && Array.isArray(r.value)) next[recent[i].id] = r.value;
        });
        return next;
      });
    };
    load();
    const iv = setInterval(load, 8000);
    return () => { alive = false; clearInterval(iv); };
  }, [msgOpen, tickets, role, user?.clerk_id, user?.id, user?.role, user?.email]);

  // Derive conversations from tickets and adminMsgs
  const ticketMsgs = useMemo(() => {
    const res = [];
    const roleStr = (user?.role || role || '').toLowerCase();
    const isStudent = roleStr === 'student';
    const currentUid = user?.clerk_id || user?.id;
    const myEmail = (user?.email || '').toLowerCase().trim();

    // Group any messages with thread_id from adminMsgs
    const msgsByThread = {};
    (adminMsgs || []).forEach(m => {
      const tid = m.thread_id || m.ticket_id || m.ticketId;
      if (tid) {
        if (!msgsByThread[tid]) msgsByThread[tid] = [];
        msgsByThread[tid].push(m);
      }
    });

    const processedTicketIds = new Set();

    // For students, filter down to tickets owned by this student or Lost & Found items they participated in
    const allowedTickets = tickets.filter(t => {
      if (!isStudent) return true;
      if (!currentUid && !myEmail) return false;
      const isOwner = Boolean(
        (currentUid && (t.owner_id === currentUid || t.ownerId === currentUid || t.clerk_id === currentUid || t.userId === currentUid || t.user_id === currentUid)) ||
        (myEmail && (t.userEmail || t.owner_email || '').toLowerCase().trim() === myEmail)
      );
      if (isOwner) return true;
      if (isLostFound(t)) {
        const msgs = (Array.isArray(t.messages) && t.messages.length)
          ? t.messages
          : ((threads[t.id] && threads[t.id].length) ? threads[t.id] : (msgsByThread[t.id] || []));
        return msgs.some(m => currentUid && (m.sender_id === currentUid || m.senderId === currentUid));
      }
      return false;
    });

    allowedTickets.forEach(t => {
      processedTicketIds.add(String(t.id));
      const threadList = msgsByThread[t.id] || [];
      const msgs = (Array.isArray(t.messages) && t.messages.length)
        ? t.messages
        : ((threads[t.id] && threads[t.id].length) ? threads[t.id] : threadList);

      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        const lastSenderId = lastMsg.sender_id || lastMsg.senderId;
        const isMine = Boolean(currentUid && lastSenderId === currentUid);
        const msgTime = lastMsg.created_at ? new Date(lastMsg.created_at).getTime() : (lastMsg.at || 0);
        const threadReadTime = readThreads[String(t.id)] || 0;
        const isUnread = !isMine && msgTime > threadReadTime && !Boolean(lastMsg.read_at);

        res.push({
          id: lastMsg.id ? String(lastMsg.id) : `tmsg_${t.id}_${msgTime}`,
          ticketId: t.id,
          ticket: t,
          ticketTitle: t.title || t.categoryDisplay || t.subCategory || 'Complaint',
          location: t.location || '',
          sender: isMine ? 'You' : (lastMsg.sender_name || lastMsg.senderName || lastMsg.sender || 'Technician'),
          snippet: lastMsg.text || lastMsg.body || lastMsg.snippet || '',
          time: formatTimeAgo(lastMsg.created_at || lastMsg.at),
          at: msgTime,
          tag: shortTicketId(t),
          unread: isUnread,
        });
      }
    });

    // Also include any tickets present in msgsByThread that aren't yet in tickets array (staff/admin only)
    if (!isStudent) {
      Object.keys(msgsByThread).forEach(tid => {
        if (!processedTicketIds.has(String(tid))) {
          const list = msgsByThread[tid];
          if (list.length > 0) {
            const lastMsg = list[list.length - 1];
            const lastSenderId = lastMsg.sender_id || lastMsg.senderId;
            const isMine = Boolean(currentUid && lastSenderId === currentUid);
            const msgTime = lastMsg.created_at ? new Date(lastMsg.created_at).getTime() : (lastMsg.at || 0);
            const threadReadTime = readThreads[String(tid)] || 0;
            const isUnread = !isMine && msgTime > threadReadTime && !Boolean(lastMsg.read_at);

            res.push({
              id: lastMsg.id ? String(lastMsg.id) : `tmsg_${tid}_${msgTime}`,
              ticketId: tid,
              ticket: null,
              ticketTitle: lastMsg.ticket_title || 'Ticket Discussion',
              location: lastMsg.ticket_location || '',
              sender: isMine ? 'You' : (lastMsg.sender_name || lastMsg.sender || 'Campus Member'),
              snippet: lastMsg.text || lastMsg.body || '',
              time: formatTimeAgo(lastMsg.created_at),
              at: msgTime,
              tag: `#${String(tid).slice(0, 8)}`,
              unread: isUnread,
            });
          }
        }
      });
    }

    return res.sort((a, b) => b.at - a.at);
  }, [tickets, threads, adminMsgs, readThreads, user?.role, role, user?.clerk_id, user?.id]);

  // Format administrator messages
  const formattedAdminMsgs = useMemo(() => {
    const currentUid = user?.clerk_id || user?.id;
    return adminMsgs.map(m => {
      const ticketId = m.thread_id || m.ticket_id || m.ticketId;
      const ticket = ticketId ? tickets.find(t => String(t.id) === String(ticketId)) : null;
      const isTicketChat = Boolean(ticketId);

      const tag = ticket
        ? shortTicketId(ticket)
        : (ticketId ? `#${String(ticketId).slice(0, 8)}` : (m.tag || 'Official Broadcast'));

      const title = ticket
        ? (ticket.title || ticket.categoryDisplay || ticket.subCategory || 'Ticket Chat')
        : (m.ticket_title || m.title || (isTicketChat ? 'Ticket Message' : 'Official Administrator Notice'));

      const location = ticket?.location || m.ticket_location || '';
      const isMine = Boolean(currentUid && (m.sender_id === currentUid || m.senderId === currentUid));
      const sender = isMine ? 'You' : (m.sender_name || m.senderName || m.sender || (isTicketChat ? (m.sender_role ? `${m.sender_role.toUpperCase()}` : 'Campus User') : 'Administrator Office'));
      const msgId = m.id ? String(m.id) : String(m.at || 0);
      const isRead = isMine || Boolean(m.read_at) || readAdminMsgIds.includes(msgId);

      return {
        id: msgId,
        ticketId,
        ticket,
        isTicketChat,
        title,
        location,
        sender,
        snippet: m.body || m.text || m.snippet || '',
        time: formatTimeAgo(m.created_at || m.at),
        at: m.created_at ? new Date(m.created_at).getTime() : (m.at || 0),
        tag,
        unread: !isRead,
      };
    }).sort((a, b) => b.at - a.at);
  }, [adminMsgs, readAdminMsgIds, tickets, user?.clerk_id, user?.id]);

  const unreadAdminCount = formattedAdminMsgs.filter(m => m.unread).length;
  const unreadTicketMsgsCount = ticketMsgs.filter(m => m.unread).length;
  const unreadMsgsCount = unreadAdminCount + unreadTicketMsgsCount;

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
  
  const markAllNotifsRead = () => {
    const allIds = notifs.map(n => n.id);
    const currentKey = user?.clerk_id || user?.id || 'guest';
    setReadNotifIds(prev => {
      const next = Array.from(new Set([...prev, ...allIds]));
      try {
        localStorage.setItem(`cc_read_notifs_${currentKey}`, JSON.stringify(next));
        localStorage.setItem('cc_read_notifs', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleNotifClick = (itemOrId) => {
    const notifId = typeof itemOrId === 'object' ? itemOrId.id : itemOrId;
    const currentKey = user?.clerk_id || user?.id || 'guest';
    setReadNotifIds(prev => {
      if (prev.includes(notifId)) return prev;
      const next = [...prev, notifId];
      try {
        localStorage.setItem(`cc_read_notifs_${currentKey}`, JSON.stringify(next));
        localStorage.setItem('cc_read_notifs', JSON.stringify(next));
      } catch {}
      return next;
    });
    setNotifOpen(false);
    const ticketId = typeof itemOrId === 'object' ? (itemOrId.ticketId || itemOrId.id) : itemOrId;
    const targetTicket = (typeof itemOrId === 'object' && itemOrId.ticket) || tickets.find(t => String(t.id) === String(ticketId));
    if (openTicket && (targetTicket || ticketId)) {
      openTicket(targetTicket || ticketId);
    }
  };

  const markAllMsgsRead = () => {
    const currentKey = user?.clerk_id || user?.id || 'guest';
    const allAdminIds = formattedAdminMsgs.map(m => m.id);
    setReadAdminMsgIds(prev => {
      const next = Array.from(new Set([...prev, ...allAdminIds]));
      try {
        localStorage.setItem(`cc_read_admin_msgs_${currentKey}`, JSON.stringify(next));
        localStorage.setItem('cc_read_admin_msgs', JSON.stringify(next));
      } catch {}
      return next;
    });
    allAdminIds.forEach(id => api?.markAdminMessageRead?.(id));

    const now = Date.now();
    setReadThreads(prev => {
      const next = { ...prev };
      ticketMsgs.forEach(m => {
        const tid = String(m.ticketId);
        next[tid] = now;
        api?.markThreadMessagesRead?.(tid);
      });
      try {
        localStorage.setItem(`cc_read_threads_${currentKey}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleAdminMsgClick = (itemOrId) => {
    const id = typeof itemOrId === 'object' ? itemOrId.id : itemOrId;
    const currentKey = user?.clerk_id || user?.id || 'guest';
    setReadAdminMsgIds(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try {
        localStorage.setItem(`cc_read_admin_msgs_${currentKey}`, JSON.stringify(next));
        localStorage.setItem('cc_read_admin_msgs', JSON.stringify(next));
      } catch {}
      return next;
    });
    if (api?.markAdminMessageRead && id) {
      api.markAdminMessageRead(id);
    }

    if (typeof itemOrId === 'object' && itemOrId.ticketId) {
      const tid = String(itemOrId.ticketId);
      setReadThreads(prev => {
        const next = { ...prev, [tid]: Date.now() };
        try {
          localStorage.setItem(`cc_read_threads_${currentKey}`, JSON.stringify(next));
        } catch {}
        return next;
      });
      if (api?.markThreadMessagesRead) api.markThreadMessagesRead(tid);
      setMsgOpen(false);
      const targetTicket = itemOrId.ticket || tickets.find(t => String(t.id) === tid);
      if (openTicket) {
        openTicket(targetTicket || itemOrId.ticketId);
      }
    }
  };

  const handleTicketMsgClick = (itemOrId) => {
    const ticketId = typeof itemOrId === 'object' ? itemOrId.ticketId : itemOrId;
    const sId = String(ticketId);
    const currentKey = user?.clerk_id || user?.id || 'guest';
    const now = Date.now();
    setReadThreads(prev => {
      const next = { ...prev, [sId]: now };
      try {
        localStorage.setItem(`cc_read_threads_${currentKey}`, JSON.stringify(next));
      } catch {}
      return next;
    });
    if (api?.markThreadMessagesRead) {
      api.markThreadMessagesRead(sId);
    }
    setMsgOpen(false);
    const targetTicket = (typeof itemOrId === 'object' && itemOrId.ticket) || tickets.find(t => String(t.id) === sId);
    if (openTicket) {
      openTicket(targetTicket || ticketId);
    }
  };

  return (
    <header className="sticky top-0 z-[80] bg-[#262262] text-white shadow-md">
      <div className="app-container px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-3">
        {/* Brand (Left) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Phones: IIITG emblem sits with the brand (co-branded lockup) instead of floating in the middle */}
          <a
            href="https://www.iiitg.ac.in"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Indian Institute of Information Technology Guwahati — open official website"
            title="Open iiitg.ac.in"
            className="md:hidden shrink-0 rounded-lg p-0.5 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
          >
            <img src="/assets/img/iiitg_emblem.png" alt="" className="h-8 w-8 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
          </a>
          <span className="md:hidden w-px h-7 bg-white/25 mx-0.5" aria-hidden="true" />
          <img src="/assets/img/campuscare-mark.svg" alt="" className="hidden md:block w-9 h-9" />
          <div className="leading-none">
            <span className="block text-[14px] sm:text-[15px] font-extrabold tracking-tight">Campus<span className="text-iiitg-gold">Care</span></span>
            <span className="hidden min-[400px]:block text-[8.5px] sm:text-[9px] text-slate-300 uppercase font-bold mt-1 tracking-widest">{portal}</span>
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

        {/* ── IIITG logo (click → official website). Phone: emblem only · tablet: + name · laptop: + Hindi line ── */}
        <div className="hidden md:flex flex-1 min-w-0 items-center justify-center">
          <a
            href="https://www.iiitg.ac.in"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Indian Institute of Information Technology Guwahati — open official website"
            title="Open iiitg.ac.in"
            className="logo-plate group min-w-0 max-w-full flex items-center gap-2.5 rounded-xl pl-1.5 pr-3 py-1 shadow-sm ring-1 ring-black/5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 transition"
          >
            {/* Tablet & laptop: whole logo on a white filled card, original colours */}
            <img src="/assets/img/iiitg_emblem.png" alt="" className="h-9 w-9 shrink-0 object-contain group-hover:scale-105 transition-transform" />
            <span className="hidden md:flex flex-col text-left leading-tight min-w-0">
              <span className="lg:hidden text-[14px] font-extrabold text-[#262262] tracking-tight truncate">IIIT Guwahati</span>
              <span className="hidden lg:block text-[13px] xl:text-sm font-extrabold text-[#262262] tracking-tight truncate">
                Indian Institute of Information Technology Guwahati
              </span>
              <span className="hidden lg:block text-[10.5px] xl:text-[11px] font-semibold text-[#4b5563] tracking-tight truncate font-hindi mt-0.5">
                भारतीय सूचना प्रौद्योगिकी संस्थान गुवाहाटी · Bongora, Assam
              </span>
            </span>
          </a>
        </div>

        {/* Right action controls */}
        <div className="ml-auto md:ml-0 flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Theme switcher (in the account menu on phones) */}
          <span className="hidden sm:flex">
            <button onClick={cycleTheme} className="cc-round-btn cc-theme-btn" title={`Theme: ${theme}`} aria-label={`Theme: ${theme}`}>
              <ThemeIcon className="w-[18px] h-[18px]" fill={theme === 'auto' ? 'none' : 'currentColor'} strokeWidth={2.2} />
              {theme === 'auto' && <span className="cc-theme-auto">A</span>}
            </button>
          </span>

          {/* ── Messages Box ── */}
          <div className="relative flex" ref={msgRef}>
            <button
              onClick={() => { setMsgOpen(o => !o); setNotifOpen(false); setMenu(false); }}
              className="relative cc-round-btn cc-msg-btn"
              title="Messages & Chats"
            >
              <MessageSquare className="w-5 h-5" />
              {unreadMsgsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#ff3b30] text-white font-black text-[9px] flex items-center justify-center ring-2 ring-[#243b41] dark:ring-[#000000]">
                  {unreadMsgsCount}
                </span>
              )}
            </button>

            {msgOpen && (
              <div className="fixed left-3 right-3 top-[3.75rem] max-h-[75vh] overflow-y-auto sm:overflow-visible sm:max-h-none sm:absolute sm:left-auto sm:top-auto sm:right-0 sm:mt-3 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 z-50 overflow-hidden animate-in fade-in duration-150">
                {/* Header */}
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">Messages</span>
                    {unreadMsgsCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-white">
                        {unreadMsgsCount} new
                      </span>
                    )}
                  </div>
                  {unreadMsgsCount > 0 && (
                    <button
                      onClick={markAllMsgsRead}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-slate-300 hover:underline flex items-center gap-1"
                    >
                      <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                    </button>
                  )}
                </div>

                {/* Segmented Tabs: Ticket Chats (Left) vs Administrator (Right) */}
                <div className="p-2 bg-slate-100/70 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMsgTab('tickets')}
                    className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      msgTab === 'tickets'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <MessageSquare className={`w-3.5 h-3.5 ${msgTab === 'tickets' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                    <span>Ticket Chats</span>
                    {unreadTicketMsgsCount > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-600 text-white">
                        {unreadTicketMsgsCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setMsgTab('admin')}
                    className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      msgTab === 'admin'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <ShieldCheck className={`w-3.5 h-3.5 ${msgTab === 'admin' ? 'text-indigo-600 dark:text-white' : 'text-slate-400'}`} />
                    <span>Administrator</span>
                    {unreadAdminCount > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-indigo-600 dark:bg-white dark:text-black text-white">
                        {unreadAdminCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Tab 1: Administrator Messages */}
                {msgTab === 'admin' && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-80 overflow-y-auto">
                    {formattedAdminMsgs.map(m => (
                      <div
                        key={m.id}
                        onClick={() => handleAdminMsgClick(m)}
                        className={`px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition flex items-start gap-3 group ${
                          m.unread ? 'bg-indigo-50/50 dark:bg-white/5 border-l-2 border-indigo-600 dark:border-l-white' : ''
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl ${m.isTicketChat ? 'bg-gradient-to-tr from-emerald-500 to-teal-600 text-white font-extrabold text-xs' : 'bg-gradient-to-tr from-indigo-600 to-iiitg-800 text-white'} flex items-center justify-center shrink-0 mt-0.5 shadow-sm`}>
                          {m.isTicketChat ? (m.sender || 'T')[0] : <ShieldCheck className="w-4 h-4 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {m.isTicketChat && (
                                <span className="font-mono text-[10px] font-black px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 dark:bg-[#212124] dark:text-white ring-1 ring-indigo-500/20 dark:ring-[#333336] shrink-0">
                                  {m.tag}
                                </span>
                              )}
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                {m.title}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 shrink-0 font-medium">{m.time}</span>
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                            <span className="text-indigo-600 dark:text-white font-bold">{m.sender}</span>
                            {m.location && (
                              <span className="text-[10px] text-slate-400 truncate font-normal">
                                · 📍 {m.location}
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-700 dark:text-slate-200 bg-slate-100/70 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-lg line-clamp-2 leading-relaxed">
                            "{m.snippet}"
                          </p>

                          <div className="flex items-center justify-between gap-1.5 mt-1.5">
                            {m.isTicketChat ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 group-hover:underline">
                                Open Ticket &amp; Reply &rarr;
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-indigo-700 dark:text-white bg-indigo-100/80 dark:bg-white/10 px-2 py-0.5 rounded-full">
                                  🏛️ {m.tag}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">Official Dispatch</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {m.unread && <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-white shrink-0 mt-1.5 ring-2 ring-indigo-200 dark:ring-white/20" />}
                      </div>
                    ))}
                    {formattedAdminMsgs.length === 0 && (
                      <div className="py-8 px-4 text-center">
                        <ShieldCheck className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2 opacity-50" />
                        <p className="font-semibold text-xs text-slate-600 dark:text-slate-300">No Administrator Messages</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Official campus notices and administration broadcasts will appear here.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Ticket Chats */}
                {msgTab === 'tickets' && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-80 overflow-y-auto">
                    {ticketMsgs.map(m => (
                      <div
                        key={m.id}
                        onClick={() => handleTicketMsgClick(m)}
                        className={`px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition flex items-start gap-3 group ${
                          m.unread ? 'bg-emerald-50/50 dark:bg-emerald-950/25 border-l-2 border-emerald-600' : ''
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                          {(m.sender || 'T')[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-mono text-[10px] font-black px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 ring-1 ring-emerald-500/20 shrink-0">
                                {m.tag}
                              </span>
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                {m.ticketTitle}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 shrink-0 font-medium">{m.time}</span>
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold">{m.sender}</span>
                            {m.location && (
                              <span className="text-[10px] text-slate-400 truncate font-normal">
                                · 📍 {m.location}
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-700 dark:text-slate-200 bg-slate-100/70 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-lg line-clamp-2 leading-relaxed">
                            "{m.snippet}"
                          </p>

                          <div className="flex items-center justify-between mt-1.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 group-hover:underline">
                              Open Ticket &amp; Reply &rarr;
                            </span>
                          </div>
                        </div>
                        {m.unread && <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0 mt-1.5 ring-2 ring-emerald-200 dark:ring-emerald-900" />}
                      </div>
                    ))}
                    {ticketMsgs.length === 0 && (
                      <div className="py-8 px-4 text-center">
                        <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2 opacity-50" />
                        <p className="font-semibold text-xs text-slate-600 dark:text-slate-300">No Ticket Chats</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Messages about your tickets will appear here.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200/80 dark:border-slate-800 text-center flex items-center justify-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {msgTab === 'admin' ? 'Official Campus Administration Announcements' : 'All ticket conversations are synchronized'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Notifications Box ── */}
          <div className="relative flex" ref={notifRef}>
            <button
              onClick={() => { setNotifOpen(o => !o); setMsgOpen(false); setMenu(false); }}
              className="relative cc-round-btn cc-bell-btn"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#ff3b30] text-white font-black text-[9px] flex items-center justify-center ring-2 ring-[#243b41] dark:ring-[#000000]">
                  {unreadNotifsCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="fixed left-3 right-3 top-[3.75rem] max-h-[75vh] overflow-y-auto sm:overflow-visible sm:max-h-none sm:absolute sm:left-auto sm:top-auto sm:right-0 sm:mt-3 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 z-50 overflow-hidden animate-in fade-in duration-150">
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
                        onClick={() => handleNotifClick(n)}
                        className={`px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition flex items-start gap-3 group ${n.unread ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}`}
                      >
                        <div className={`w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5 ${n.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {n.shortId && (
                                <span className="font-mono text-[9px] font-black px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 shrink-0">
                                  {n.shortId}
                                </span>
                              )}
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{n.title}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 shrink-0 font-medium">{n.time}</span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">{n.desc}</p>
                          <span className="inline-block mt-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline">
                            View Ticket Details &rarr;
                          </span>
                        </div>
                        {n.unread && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-1.5" />}
                      </div>
                    );
                  })}
                  {notifs.length === 0 && (
                    <div className="py-8 px-4 text-center">
                      <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2 opacity-50" />
                      <p className="font-semibold text-xs text-slate-600 dark:text-slate-300">No notifications yet</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">You'll be notified when a ticket is updated.</p>
                    </div>
                  )}
                </div>

                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200/80 dark:border-slate-800 text-center">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Campus alerts & status notifications</span>
                </div>
              </div>
            )}
          </div>

          {/* Emergency SOS Button */}
          <button
            onClick={() => setEmergency(true)}
            className="h-[38px] min-w-[38px] px-0 sm:px-3.5 flex items-center justify-center gap-1.5 bg-white/12 hover:bg-rose-500/20 active:bg-rose-500/30 text-white hover:text-rose-200 border border-white/22 hover:border-rose-400/50 dark:bg-[#161618] dark:hover:bg-[#212124] dark:border-[#212124] dark:hover:border-rose-500/50 dark:text-rose-400 font-bold text-xs rounded-full shadow-none transition-all cursor-pointer active:scale-95 group"
            aria-label="SOS emergency"
            title="Emergency — campus help numbers & immediate assistance"
          >
            <Siren className="w-4 h-4 text-white dark:text-rose-400 group-hover:scale-105 transition-transform" />
            <span className="hidden sm:inline tracking-wider uppercase font-bold text-[12px]">SOS</span>
          </button>

          {/* User Profile Avatar */}
          <div className="relative flex" ref={menuRef}>
            <button onClick={() => setMenu(m => !m)} aria-label="Account menu" className="w-[38px] h-[38px] rounded-full bg-white/14 hover:bg-white/24 border border-white/24 hover:border-white/40 text-white dark:bg-[#161618] dark:border-[#212124] dark:hover:border-[#333336] dark:text-white font-extrabold text-xs flex items-center justify-center shadow-none ring-0 transition-colors">
              {initials}
            </button>
            {menu && (
              <div className="absolute right-0 mt-3 w-60 max-w-[calc(100vw-1.5rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-2 text-sm text-slate-700 dark:text-slate-200 z-50 animate-in fade-in duration-150">
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
                <button
                  onClick={cycleTheme}
                  className="sm:hidden w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-100 dark:border-slate-800 transition-colors"
                >
                  <ThemeIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" /> Theme: <span className="capitalize">{theme}</span>
                </button>
                <button onClick={logout} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-rose-600 dark:text-rose-400 font-semibold transition-colors">
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile & Tablet tabs */}
      {tabs.length > 0 && (
      <nav className="lg:hidden flex items-center gap-1 px-3 pb-2 overflow-x-auto no-scrollbar">
        {tabs.map(t => (
          <button key={t.key} onClick={() => onTab(t.key)} className={`nav-link text-xs ${activeTab === t.key ? 'active' : ''}`}>
            {t.Icon && <t.Icon className="w-4 h-4" />}{t.label}
          </button>
        ))}
      </nav>
      )}

      {emergency && <EmergencyModal onClose={() => setEmergency(false)} />}
    </header>
  );
}
