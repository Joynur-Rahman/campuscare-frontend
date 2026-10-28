import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Send, Loader2, CheckCheck, MapPin, Compass,
  Calendar, Wrench, Star, MessageSquare, Lock,
  Camera, Eye, ExternalLink, ChevronLeft, ChevronRight, FileText
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import {
  statusLabel, statusStyle, ticketLabel, shortTicketId, getTicketCoords,
  cleanDescription, fmtDate, createdMs, isLostFound
} from '../lib/ticketUtils.js';
import { useBodyScrollLock } from '../lib/useBodyScrollLock.js';
import LocationModal from './LocationModal.jsx';
import RatingModal from './RatingModal.jsx';
import TicketTimelineStepper from './TicketTimelineStepper.jsx';

// Time formatting helper (e.g. 10:45 AM)
function formatMsgTime(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

// Day separator helper (Today, Yesterday, Oct 9)
function getDayString(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

// One-tap replies for staff (sent as normal chat messages)
const QUICK_REPLIES = [
  'On my way 🚶',
  'Will reach in 15 minutes',
  'Need a spare part — will come back',
  'Please be available at the spot',
  'Fixed ✅ — please check and confirm',
];

// In-memory cache for loaded threads so reopening any ticket renders instantly with 0ms delay
const threadCache = new Map();

// Shared ticket detail + right-hand-side drawer chat
export default function TicketDetailModal({ ticket, onClose, action }) {
  useBodyScrollLock();
  const { api, user, showToast, markTicketMessagesRead } = useApp();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  // Initialize from ticket or cached messages for instant display
  const cachedMessages = ticket?.id ? (threadCache.get(ticket.id) || []) : [];
  const initialMessages = (ticket?.messages?.length ? ticket.messages : cachedMessages) || [];
  const [local, setLocal] = useState(() => (ticket ? { ...ticket, messages: [...initialMessages] } : ticket));
  const [loadingThread, setLoadingThread] = useState(() => !initialMessages.length);

  // Automatically mark this ticket's messages as read upon viewing
  useEffect(() => {
    if (ticket?.id && markTicketMessagesRead) {
      markTicketMessagesRead(ticket.id);
    }
  }, [ticket?.id, markTicketMessagesRead]);

  useEffect(() => {
    if (ticket) {
      const cached = ticket.id ? (threadCache.get(ticket.id) || []) : [];
      setLocal(prev => {
        const msgs = prev?.messages?.length ? prev.messages : (ticket.messages?.length ? ticket.messages : cached);
        return prev ? { ...prev, ...ticket, messages: [...msgs] } : { ...ticket, messages: [...msgs] };
      });
    }
  }, [ticket?.id, ticket?.status, ticket?.assignedToName, ticket?.rating, ticket?.upvotes]);

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const endRef = useRef(null);

  // Fetch ticket media / attachments directly so Admin and Staff always see uploaded photos (skip if already provided)
  useEffect(() => {
    if (!ticket?.id || !api?.getTicketMedia || ticket?.attachments?.length) return;
    let active = true;
    api.getTicketMedia(ticket.id)
      .then(media => {
        if (!active || !Array.isArray(media) || !media.length) return;
        setLocal(prev => {
          if (!prev) return prev;
          const attachments = media.map(m => m.secure_url || m.url || m).filter(Boolean);
          return {
            ...prev,
            media,
            attachments,
            photoUrl: attachments[0] || prev.photoUrl
          };
        });
      })
      .catch(() => {});
    return () => { active = false; };
  }, [ticket?.id, api]);

  const coords = getTicketCoords(local);
  const hasLocation = !local?.confidential && Boolean(local?.location || coords);

  const role = user?.role;
  const isAdmin = role === 'admin' || role === 'administrator';
  const isStaff = role === 'staff' || role === 'technician';
  const currentUserId = user?.clerk_id || user?.id || user?.uid;
  const senderName = isAdmin ? 'Administrator' : (user?.name || user?.full_name || user?.email?.split('@')[0] || 'You');
  const senderTag = isAdmin ? 'Admin' : isStaff ? 'Technician' : 'Student';

  const s = String(local?.status || '').toLowerCase().trim();
  const myEmail = (user?.email || '').toLowerCase().trim();
  const isOwner = Boolean(
    (currentUserId && (
      local?.userId === currentUserId ||
      local?.owner_id === currentUserId ||
      local?.ownerId === currentUserId ||
      local?.clerk_id === currentUserId ||
      local?.user_id === currentUserId
    )) ||
    (myEmail && (local?.userEmail || local?.owner_email || '').toLowerCase().trim() === myEmail)
  );
  const hasJoined = Boolean(
    currentUserId && Array.isArray(local?.upvotedBy || local?.upvoted_by) && (local.upvotedBy || local.upvoted_by).includes(currentUserId)
  );
  const canRate = !isAdmin && !isStaff && (isOwner || (Boolean(local?.isPublic) && hasJoined));
  const isResolved = s === 'resolved' || s === 'fixed' || s === 'done';
  const isLf = isLostFound(local);
  const canViewChat = isAdmin || isStaff || isOwner || isLf;

  const mapMsg = (m) => {
    if (!m) return m;
    const isMine = Boolean(currentUserId && (m.sender_id === currentUserId || m.senderId === currentUserId));
    const isSys = Boolean(m.is_system || m.isSystem);

    const role = String(m.sender_role || m.senderRole || m.role || '').toLowerCase();
    const isSenderAdmin = role === 'administrator' || role === 'admin' || m.sender === 'Admin' || m.sender === 'Administrator';
    const isSenderStaff = role === 'staff' || role === 'technician' || m.sender === 'Technician';

    const tag = isSenderAdmin
      ? 'Admin'
      : isSenderStaff
        ? 'Technician'
        : 'Student';

    const resolvedName = isSenderAdmin
      ? 'Administrator'
      : (m.sender_name || m.senderName || (isSenderStaff ? 'Technician' : 'Student'));

    return {
      id: m.id,
      text: m.text,
      sender_id: m.sender_id || m.senderId,
      sender_role: role || (isSenderAdmin ? 'administrator' : isSenderStaff ? 'staff' : 'student'),
      sender_name: m.sender_name || m.senderName || resolvedName,
      sender: tag,
      senderName: isMine ? 'You' : resolvedName,
      at: m.created_at ? new Date(m.created_at).getTime() : (m.at || Date.now()),
      isSystem: isSys,
      isMine,
    };
  };

  // Poll for thread updates with 4000ms frequency and memory cache sync (only if user has chat access)
  useEffect(() => {
    if (!canViewChat) {
      setLoadingThread(false);
      return;
    }
    let active = true;
    const fetchThread = async () => {
      if (!local?.id || (typeof document !== 'undefined' && document.hidden)) return;
      try {
        const list = await api.getTicketMessages(local.id);
        if (active && Array.isArray(list)) {
          threadCache.set(local.id, list);
          setLocal(l => {
            if (!l) return l;
            return {
              ...l,
              messages: list.map(mapMsg)
            };
          });
          setLoadingThread(false);
        }
      } catch (err) {
        if (active) setLoadingThread(false);
      }
    };
    fetchThread();
    const interval = setInterval(fetchThread, 4000);
    return () => { active = false; clearInterval(interval); };
  }, [local?.id, currentUserId, canViewChat]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [local?.messages?.length]);

  if (!local) return null;

  async function send(e) {
    e.preventDefault();
    await sendBody(text.trim());
  }

  async function sendBody(body) {
    if (!body || sending || !canViewChat) return;
    setSending(true);
    const msg = {
      sender: senderTag,
      senderName,
      sender_role: isAdmin ? 'administrator' : isStaff ? 'staff' : 'student',
      sender_name: senderName,
      sender_id: currentUserId,
      isMine: true,
      text: body,
      at: Date.now(),
      isSystem: false,
    };
    // Optimistic add to state and threadCache immediately
    const nextList = [...(local?.messages || []), msg];
    setLocal(l => ({ ...l, messages: nextList }));
    threadCache.set(local.id, nextList);
    setText('');
    try {
      const res = await api.addTicketMessage(local.id, msg);
      if (res && res.id) {
        const mapped = mapMsg(res);
        setLocal(l => {
          const updated = [...(l?.messages || []).filter(m => m !== msg), mapped];
          threadCache.set(local.id, updated);
          return { ...l, messages: updated };
        });
      }
    } catch (err) {
      showToast(err.message || 'Failed to send message', 'error');
      setLocal(l => {
        const reverted = (l?.messages || []).filter(m => m !== msg);
        threadCache.set(local.id, reverted);
        return { ...l, messages: reverted };
      });
    } finally {
      setSending(false);
    }
  }

  const rawMessages = dedupeMessages((local?.messages || []).map(mapMsg));

  // Extract all media & attachments with deduplication
  const mediaItems = [
    ...(Array.isArray(local?.media) ? local.media : []),
    ...(Array.isArray(local?.attachments) ? local.attachments.map((url, i) => ({
      id: `att-${i}`,
      secure_url: url,
      original_filename: `Attachment ${i + 1}`,
      resource_type: url?.toLowerCase?.().endsWith('.pdf') ? 'raw' : 'image',
      format: url?.toLowerCase?.().endsWith('.pdf') ? 'pdf' : 'jpg'
    })) : []),
    ...(local?.photoUrl ? [{ id: 'photo-url', secure_url: local.photoUrl, original_filename: 'Attached Photo', format: 'jpg' }] : [])
  ].reduce((acc, item) => {
    const url = item?.secure_url || item?.url || (typeof item === 'string' ? item : null);
    if (url && !acc.some(x => (x.secure_url || x.url) === url)) {
      acc.push({ ...item, secure_url: url, url });
    }
    return acc;
  }, []);

  // Keyboard navigation for image lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowLeft' && mediaItems.length > 1) {
        setLightboxIndex((prev) => (prev - 1 + mediaItems.length) % mediaItems.length);
      }
      if (e.key === 'ArrowRight' && mediaItems.length > 1) {
        setLightboxIndex((prev) => (prev + 1) % mediaItems.length);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, mediaItems.length]);

  const drawerContent = (
    <>
      {/* ── 1. Backdrop Overlay ── */}
      <div
        className="fixed inset-0 z-[95] bg-black/40 backdrop-blur-xs chat-drawer-backdrop cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── 2. Full-Length Right-Hand Drawer ── */}
      <aside
        className="fixed inset-y-0 sm:top-16 right-0 z-[100] w-full sm:w-[470px] md:w-[500px] lg:w-[530px] max-w-full flex flex-col bg-[#e4ecea] dark:bg-[#101214] text-slate-800 dark:text-slate-100 shadow-[-12px_0_36px_rgba(0,0,0,0.18)] border-l border-[#d9e3e1] dark:border-[#25282e] chat-drawer-panel"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header Strip ── */}
        <div className="px-4 sm:px-5 py-3.5 bg-[#edf2f1]/95 dark:bg-[#0e0f12]/95 border-b border-[#d9e3e1] dark:border-[#25282e] shrink-0 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            <span
              title={`Full ID: ${local.id} (Click to copy)`}
              onClick={() => {
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(local.id);
                }
              }}
              className="font-mono text-xs font-black text-[#2f4e56] dark:text-[#b9bec9] px-2.5 py-1 rounded-lg bg-[#e1e9e7] dark:bg-[#1b1e22] border border-[#d6ded7] dark:border-[#2a2e35] tracking-tight min-w-0 truncate cursor-pointer hover:border-[#2f4e56] dark:hover:border-slate-500 transition-colors"
            >
              {shortTicketId(local)}
            </span>
            <span className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border shrink-0 whitespace-nowrap ${statusStyle(local)}`}>
              {statusLabel(local)}
            </span>
            {local.priority === 'High' && (
              <span className="px-2 py-0.5 text-[9px] font-black rounded-md bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 uppercase tracking-wider shrink-0">
                Urgent
              </span>
            )}
            {isLf && (
              <span className="px-2 py-0.5 text-[9.5px] font-black rounded-md bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 uppercase tracking-wider shrink-0">
                Claim Chat
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Rating Option — ONLY shown if work is completed (resolved/fixed) or already rated */}
            {isResolved && canRate && (
              <button
                type="button"
                onClick={() => setShowRateModal(true)}
                title="Rate resolution & technician"
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-xl border transition-all active:scale-95 cursor-pointer shadow-2xs ${
                  local.rating
                    ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800'
                    : 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-xs'
                }`}
              >
                <Star className={`w-3.5 h-3.5 ${local.rating ? 'fill-amber-400 text-amber-500' : 'fill-white text-white'}`} />
                <span>{local.rating ? `${local.rating}★` : 'Rate'}</span>
              </button>
            )}

            {action}

            <button
              onClick={onClose}
              aria-label="Close drawer"
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Context & Metadata Info Box ── */}
        <div className="px-4 sm:px-5 py-3 bg-white/70 dark:bg-[#131518]/70 border-b border-[#d9e3e1] dark:border-[#25282e] shrink-0">
          <h3 className="text-sm sm:text-[15px] font-extrabold text-slate-900 dark:text-white leading-snug">
            {ticketLabel(local)}
          </h3>

          {cleanDescription(local.description) && (
            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mt-1 leading-relaxed">
              {cleanDescription(local.description)}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
            {hasLocation && (
              <button
                type="button"
                onClick={() => setShowLocationModal(true)}
                title={coords ? `GPS: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} — Click to view Map` : 'Click to view on Map'}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#f4f7f6] hover:bg-[#eaf0ef] dark:bg-[#15171a] dark:hover:bg-[#1b1d21] border border-[#d9e3e1] dark:border-[#2c3037] text-slate-800 dark:text-slate-100 font-semibold cursor-pointer group shadow-2xs"
              >
                <MapPin className="w-3.5 h-3.5 text-rose-500 group-hover:scale-110 transition-transform" />
                <span className="truncate max-w-[170px]">{local.location || 'Campus Location'}</span>
                <span className="cc-map-chip inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ml-1">
                  <Compass className="w-2.5 h-2.5" />
                  <span>Map</span>
                </span>
              </button>
            )}

            {local.assignedToName && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#e1e9e7] dark:bg-[#1b1e22] border border-[#d6ded7] dark:border-[#335678] font-bold text-[#2f4e56] dark:text-[#b9bec9]">
                <Wrench className="w-3 h-3" />
                <span className="truncate max-w-[140px]">{local.assignedToName}</span>
              </span>
            )}

            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 font-medium text-slate-500 dark:text-slate-400 ml-auto">
              <Calendar className="w-3 h-3" />
              <span>{local.date || fmtDate(createdMs(local))}</span>
            </span>
          </div>
        </div>

        {/* ── People (staff & admin only) ── */}
        {(isAdmin || isStaff) && (
          <div className="px-4 sm:px-5 py-2.5 grid grid-cols-2 gap-2 bg-white/60 dark:bg-[#111215]/70 border-b border-[#d9e3e1] dark:border-[#25282e] shrink-0 text-xs">
            <div className="min-w-0 rounded-lg bg-[#f4f7f6] dark:bg-[#15171a] border border-[#d9e3e1] dark:border-[#25282e] px-2.5 py-1.5">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Reported by</p>
              <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{local.userName || 'Student'}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {local.userPhone || local.phone
                  ? <a href={`tel:${String(local.userPhone || local.phone).replace(/[^\d+]/g, '')}`} className="text-emerald-700 dark:text-emerald-300 font-semibold hover:underline">{local.userPhone || local.phone}</a>
                  : (local.userEmail || 'No contact shared')}
              </p>
            </div>
            <div className={`min-w-0 rounded-lg border px-2.5 py-1.5 ${local.assignedToName || local.assignedTo || local.assigned_to ? 'bg-[#f4f7f6] dark:bg-[#15171a] border-[#d9e3e1] dark:border-[#25282e]' : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-400/30'}`}>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Assigned to</p>
              <p className={`font-bold truncate ${local.assignedToName || local.assignedTo || local.assigned_to ? 'text-slate-800 dark:text-slate-100' : 'text-rose-700 dark:text-rose-300'}`}>
                {local.assignedToName || (local.assignedTo || local.assigned_to ? 'Assigned' : 'Not assigned yet')}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{local.priority === 'High' ? 'Urgent priority' : 'Normal priority'}</p>
            </div>
          </div>
        )}

        {/* ── Lifecycle Stepper Strip ── */}
        <div className="px-4 py-2 bg-[#edf2f1]/85 dark:bg-[#0e1012]/85 border-b border-[#d9e3e1] dark:border-[#25282e] shrink-0 text-slate-900 dark:text-white">
          <TicketTimelineStepper ticket={local} />
        </div>

        {/* ── Attached Photos & Evidence Section (Visible to Admin, Staff & Students) ── */}
        {mediaItems.length > 0 && (
          <div className="px-4 sm:px-5 py-2.5 bg-white/85 dark:bg-[#131518]/90 border-b border-[#d9e3e1] dark:border-[#25282e] shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                <Camera className="w-3.5 h-3.5 text-[#2f4e56] dark:text-teal-400" />
                <span>Problem Photos & Evidence</span>
                <span className="px-1.5 py-0.2 rounded-full bg-[#e1e9e7] dark:bg-[#20242a] text-[#2f4e56] dark:text-[#b9bec9] text-[10px] font-black">
                  {mediaItems.length}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Click to view full size</span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {mediaItems.map((item, idx) => {
                const url = item.secure_url || item.url;
                const isPdf = item.format === 'pdf' || url?.toLowerCase?.().endsWith('.pdf');
                return (
                  <div
                    key={item.id || idx}
                    onClick={() => {
                      if (isPdf) {
                        window.open(url, '_blank', 'noopener,noreferrer');
                      } else {
                        setLightboxIndex(idx);
                      }
                    }}
                    title={item.original_filename || `Attachment ${idx + 1} (Click to inspect)`}
                    className="group relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shrink-0 border border-[#d9e3e1] dark:border-[#2f333a] bg-slate-100 dark:bg-[#1b1e23] cursor-pointer hover:border-[#2f4e56] dark:hover:border-teal-500 transition-all shadow-2xs hover:shadow-md"
                  >
                    {isPdf ? (
                      <div className="w-full h-full flex flex-col items-center justify-center p-1.5 text-rose-600 dark:text-rose-400 bg-rose-50/60 dark:bg-rose-950/20">
                        <FileText className="w-6 h-6 mb-1" />
                        <span className="text-[9px] font-bold uppercase tracking-wider text-center line-clamp-1">PDF Doc</span>
                      </div>
                    ) : (
                      <>
                        <img
                          src={url}
                          alt={item.original_filename || `Problem photo ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors">
                          <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 drop-shadow-md transition-opacity" />
                        </div>
                      </>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1 text-[9px] text-white font-medium truncate px-1 pointer-events-none text-center">
                      {item.original_filename || `Photo ${idx + 1}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Chat Messages or Privacy Notice ── */}
        {!canViewChat ? (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center bg-[#e4ecea]/40 dark:bg-[#0d0f11]/60">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/40 flex items-center justify-center mb-3.5 text-amber-600 dark:text-amber-400 shadow-xs">
              <Lock className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
              Private Conversation
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[280px] leading-relaxed">
              Ticket messages and updates are confidential between the student who submitted this issue and the maintenance team.
            </p>
          </div>
        ) : (
          <>
            {/* ── Chat Messages Scroll Feed ── */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3 bg-[#e4ecea]/70 dark:bg-[#0d0f11]/90">
              {rawMessages.map((m, i, arr) => {
                const mine = m.isMine !== undefined ? m.isMine : (m.sender === senderTag);
                if (m.isSystem) {
                  return (
                    <div key={i} className="text-center py-1 select-none">
                      <span className="inline-block text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-[#e1e9e7]/80 dark:bg-[#16181c] px-3 py-0.5 rounded-full border border-[#d2dddb] dark:border-[#25282e] shadow-2xs">
                        {m.text}
                      </span>
                    </div>
                  );
                }

                const currentDay = getDayString(m.at);
                const prevDay = i > 0 ? getDayString(arr[i - 1].at) : null;
                const showDaySeparator = Boolean(currentDay && currentDay !== prevDay);

                return (
                  <div key={i} className="space-y-1">
                    {showDaySeparator && (
                      <div className="flex justify-center my-2 select-none">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-[#e1e9e7] dark:bg-[#16181c] text-slate-600 dark:text-slate-300 shadow-2xs border border-[#d2dddb] dark:border-[#25282e]">
                          {currentDay}
                        </span>
                      </div>
                    )}

                    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] sm:max-w-[80%] px-3.5 pt-2 pb-1.5 rounded-2xl text-[13px] sm:text-sm leading-relaxed relative shadow-xs ${
                          mine
                            ? 'bg-[#262262] text-white rounded-tr-xs'
                            : 'bg-white dark:bg-[#191b1f] text-slate-800 dark:text-slate-100 rounded-tl-xs border border-[#d9e3e1] dark:border-[#25282e]'
                        }`}
                      >
                        {!mine && (
                          <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mb-0.5">
                            {m.senderName || m.sender}
                          </div>
                        )}
                        <div className="whitespace-pre-wrap break-words pr-2">
                          {m.text}
                        </div>
                        <div className="flex items-center justify-end gap-1 mt-1 -mb-0.5 select-none text-[10px] opacity-75 font-medium leading-none">
                          <span>{formatMsgTime(m.at)}</span>
                          {mine && <CheckCheck className="w-3 h-3 text-emerald-400 shrink-0 inline-block" />}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {loadingThread && rawMessages.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Loading conversation history…</span>
                </div>
              ) : rawMessages.filter(m => !m.isSystem).length === 0 && (
                <div className="text-center py-12">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/80 dark:bg-[#15171a]/80 border border-[#d9e3e1] dark:border-[#25282e] text-xs font-semibold text-slate-600 dark:text-slate-300 shadow-2xs">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                    <span>{isLf ? 'No messages yet. Message the owner to claim or verify this item.' : 'No messages yet. Send a message to start the thread.'}</span>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* ── Bottom Input Bar ── */}
            {!(role === 'student' && isResolved && !isLf) && (
              <>
              {isStaff && !isLf && (
                <div className="shrink-0 px-3 sm:px-4 pt-2 flex gap-1.5 overflow-x-auto no-scrollbar bg-[#edf2f1] dark:bg-[#0e0f11] border-t border-[#d9e3e1] dark:border-[#25282e]">
                  {QUICK_REPLIES.map(q => (
                    <button
                      key={q}
                      type="button"
                      disabled={sending}
                      onClick={() => sendBody(q)}
                      className="shrink-0 px-3 py-1.5 rounded-full text-[11.5px] font-semibold bg-white dark:bg-[#15171a] text-[#2f4e56] dark:text-[#b9bec9] border border-[#d3dfdc] dark:border-[#25282e] hover:bg-[#e3ebe9] dark:hover:bg-[#1b1d21] disabled:opacity-50 transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
              {isLf && (
                <div className="shrink-0 px-3 sm:px-4 pt-2 flex gap-1.5 overflow-x-auto no-scrollbar bg-[#edf2f1] dark:bg-[#0e0f11] border-t border-[#d9e3e1] dark:border-[#25282e]">
                  {(isOwner ? [
                    'Please describe any unique marks or ID',
                    'Meet me at campus entrance',
                    'Item kept at campus security gate',
                    'Verified & claimed! Thank you 🙌',
                  ] : [
                    'Hi! I think this is mine 🙋‍♂️',
                    'Where can we meet to verify?',
                    'Can you share more details?',
                    'I found and handed it to security 🏢',
                  ]).map(q => (
                    <button
                      key={q}
                      type="button"
                      disabled={sending}
                      onClick={() => sendBody(q)}
                      className="shrink-0 px-3 py-1.5 rounded-full text-[11.5px] font-semibold bg-white dark:bg-[#15171a] text-[#2f4e56] dark:text-[#b9bec9] border border-[#d3dfdc] dark:border-[#25282e] hover:bg-[#e3ebe9] dark:hover:bg-[#1b1d21] disabled:opacity-50 transition cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
              <form
                onSubmit={send}
                className={`p-3 sm:p-4 bg-[#edf2f1] dark:bg-[#0e0f11] flex items-center gap-2 shrink-0 ${isStaff || isLf ? 'pt-2' : 'border-t border-[#d9e3e1] dark:border-[#25282e]'}`}
              >
                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder={isLf ? (isOwner ? "Reply to student claimants…" : "Message to claim or share details…") : "Type a message…"}
                  className="flex-1 px-4 py-2 sm:py-2.5 rounded-full bg-white dark:bg-[#15171a] text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#262262] border border-[#d9e3e1] dark:border-[#25282e] shadow-2xs transition-all"
                />
                <button
                  type="submit"
                  disabled={sending || !text.trim()}
                  className="w-10 h-10 rounded-full bg-[#262262] hover:bg-[#1c184c] text-white flex items-center justify-center transition-all disabled:opacity-40 shadow-sm shrink-0 active:scale-95 cursor-pointer"
                  title="Send message"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 ml-0.5" />
                  )}
                </button>
              </form>
              </>
            )}
          </>
        )}
      </aside>

      {/* ── Location & Rating Modals (Rendered above Drawer) ── */}
      {showLocationModal && (
        <LocationModal
          ticket={coords ? { ...local, latitude: coords.lat, longitude: coords.lng } : local}
          onClose={() => setShowLocationModal(false)}
        />
      )}

      {showRateModal && (
        <RatingModal
          ticket={local}
          onClose={() => setShowRateModal(false)}
          onRated={(r) => {
            setLocal(prev => ({ ...prev, rating: r }));
            ticket.rating = r;
          }}
        />
      )}

      {/* ── Fullscreen Media Lightbox Modal ── */}
      {lightboxIndex !== null && mediaItems[lightboxIndex] && (
        <div
          className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 select-none animate-in fade-in duration-200"
          onClick={() => setLightboxIndex(null)}
          role="dialog"
          aria-modal="true"
        >
          {/* Top Bar */}
          <div
            className="w-full flex items-center justify-between text-white/90 z-10 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-white/10 backdrop-blur-md border border-white/20">
                Photo {lightboxIndex + 1} of {mediaItems.length}
              </span>
              <span className="text-xs text-white/70 truncate max-w-[200px] sm:max-w-xs">
                {mediaItems[lightboxIndex].original_filename || 'Evidence Photo'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={mediaItems[lightboxIndex].secure_url || mediaItems[lightboxIndex].url}
                target="_blank"
                rel="noopener noreferrer"
                title="Open original in new tab"
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                aria-label="Close photo preview"
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Central Image Viewer with Prev / Next */}
          <div
            className="relative flex-1 flex items-center justify-center w-full max-w-5xl my-2 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {mediaItems.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev - 1 + mediaItems.length) % mediaItems.length);
                }}
                className="absolute left-2 sm:left-4 z-10 p-2 sm:p-3 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 backdrop-blur-md transition-all active:scale-95 cursor-pointer shadow-lg"
                title="Previous photo (Left arrow)"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <img
              src={mediaItems[lightboxIndex].secure_url || mediaItems[lightboxIndex].url}
              alt={mediaItems[lightboxIndex].original_filename || 'Problem photo'}
              className="max-h-[80vh] max-w-[90vw] object-contain rounded-xl shadow-2xl transition-all duration-200"
            />

            {mediaItems.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev + 1) % mediaItems.length);
                }}
                className="absolute right-2 sm:right-4 z-10 p-2 sm:p-3 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 backdrop-blur-md transition-all active:scale-95 cursor-pointer shadow-lg"
                title="Next photo (Right arrow)"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Bottom Thumbnails Strip (if multiple) */}
          {mediaItems.length > 1 && (
            <div
              className="flex items-center gap-2 overflow-x-auto max-w-xl py-2 px-3 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 z-10 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              {mediaItems.map((item, idx) => (
                <button
                  key={item.id || idx}
                  type="button"
                  onClick={() => setLightboxIndex(idx)}
                  className={`w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                    idx === lightboxIndex ? 'border-white scale-105 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={item.secure_url || item.url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );

  return typeof document !== 'undefined'
    ? createPortal(drawerContent, document.body)
    : drawerContent;
}

// Guard against duplicate messages
function dedupeMessages(list) {
  const seen = new Set();
  return (list || []).filter(m => {
    const k = m.id || `${m.at}|${m.sender}|${m.text}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
