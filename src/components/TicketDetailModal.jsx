import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Send, Loader2, CheckCheck, MapPin, Compass,
  Calendar, Wrench, Star, MessageSquare
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import {
  statusLabel, statusStyle, ticketLabel, getTicketCoords,
  cleanDescription, fmtDate, createdMs
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

// Shared ticket detail + right-hand-side drawer chat
export default function TicketDetailModal({ ticket, onClose, action }) {
  useBodyScrollLock();
  const { api, user, showToast } = useApp();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  // Own copy so outside updates to the ticket object can't double-append messages
  const [local, setLocal] = useState(() => (ticket ? { ...ticket, messages: [...(ticket.messages || [])] } : ticket));
  useEffect(() => {
    if (ticket) {
      setLocal(prev => prev ? { ...prev, ...ticket, messages: prev.messages?.length ? prev.messages : [...(ticket.messages || [])] } : { ...ticket, messages: [...(ticket.messages || [])] });
    }
  }, [ticket?.id, ticket?.status, ticket?.assignedToName, ticket?.rating, ticket?.upvotes]);

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const endRef = useRef(null);

  const coords = getTicketCoords(local);
  const hasLocation = !local?.confidential && Boolean(local?.location || coords);

  const role = user?.role;
  const isAdmin = role === 'admin' || role === 'administrator';
  const isStaff = role === 'staff' || role === 'technician';
  const currentUserId = user?.clerk_id || user?.id || user?.uid;
  const senderName = isAdmin ? 'Administrator' : (user?.name || user?.full_name || user?.email?.split('@')[0] || 'You');
  const senderTag = isAdmin ? 'Admin' : isStaff ? 'Technician' : 'Student';

  const s = String(local?.status || '').toLowerCase().trim();
  // Rating: students only; on shared issues only the reporter or people who joined ("Me too")
  const myEmail = (user?.email || '').toLowerCase();
  const isOwner = Boolean((currentUserId && (local?.userId === currentUserId || local?.owner_id === currentUserId)) ||
    (myEmail && (local?.userEmail || '').toLowerCase() === myEmail));
  const hasJoined = Boolean(currentUserId && Array.isArray(local?.upvotedBy) && local.upvotedBy.includes(currentUserId));
  const canRate = !isAdmin && !isStaff && (!local?.isPublic || isOwner || hasJoined);
  const isResolved = s === 'resolved' || s === 'fixed' || s === 'done';

  const mapMsg = (m) => {
    if (m.sender && m.text && !m.sender_id) return m;
    const isMine = Boolean(currentUserId && (m.sender_id === currentUserId || m.senderId === currentUserId));
    const isSys = m.is_system || m.isSystem || false;
    const tag = (m.sender_role === 'administrator' || m.sender_role === 'admin')
      ? 'Admin'
      : (m.sender_role === 'staff' || m.sender_role === 'technician')
        ? 'Technician'
        : 'Student';
    return {
      id: m.id,
      text: m.text,
      sender_id: m.sender_id,
      sender: tag,
      senderName: m.sender_name || (isMine ? 'You' : tag),
      at: m.created_at ? new Date(m.created_at).getTime() : (m.at || Date.now()),
      isSystem: isSys,
      isMine,
    };
  };

  // Poll for thread updates
  useEffect(() => {
    let active = true;
    const fetchThread = async () => {
      if (!local?.id) return;
      try {
        const list = await api.getTicketMessages(local.id);
        if (active && Array.isArray(list)) {
          setLocal(l => {
            if (!l) return l;
            return {
              ...l,
              messages: list.map(mapMsg)
            };
          });
        }
      } catch (err) {
        // quiet fallback
      }
    };
    fetchThread();
    const interval = setInterval(fetchThread, 3000);
    return () => { active = false; clearInterval(interval); };
  }, [local?.id, currentUserId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [local?.messages?.length]);

  if (!local) return null;

  async function send(e) {
    e.preventDefault();
    await sendBody(text.trim());
  }

  async function sendBody(body) {
    if (!body || sending) return;
    setSending(true);
    const msg = {
      sender: senderTag,
      senderName,
      sender_id: currentUserId,
      isMine: true,
      text: body,
      at: Date.now(),
      isSystem: false,
    };
    // Optimistic add
    setLocal(l => ({ ...l, messages: [...(l?.messages || []), msg] }));
    setText('');
    try {
      const res = await api.addTicketMessage(local.id, msg);
      if (res && res.id) {
        const mapped = mapMsg(res);
        setLocal(l => ({
          ...l,
          messages: [...(l?.messages || []).filter(m => m !== msg), mapped]
        }));
      }
    } catch (err) {
      showToast(err.message || 'Failed to send message', 'error');
      setLocal(l => ({ ...l, messages: (l?.messages || []).filter(m => m !== msg) }));
    } finally {
      setSending(false);
    }
  }

  const rawMessages = dedupeMessages((local?.messages || []).map(mapMsg));

  const drawerContent = (
    <>
      {/* ── 1. Backdrop Overlay (Touches from TopNav to Bottom) ── */}
      <div
        className="fixed inset-0 top-16 z-[95] bg-black/40 backdrop-blur-xs chat-drawer-backdrop cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── 2. Full-Length Right-Hand Drawer ── */}
      <aside
        className="fixed top-16 right-0 bottom-0 z-[100] w-full sm:w-[470px] md:w-[500px] lg:w-[530px] max-w-full flex flex-col bg-[#e4ecea] dark:bg-[#101214] text-slate-800 dark:text-slate-100 shadow-[-12px_0_36px_rgba(0,0,0,0.18)] border-l border-[#d9e3e1] dark:border-[#25282e] chat-drawer-panel"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header Strip ── */}
        <div className="px-4 sm:px-5 py-3.5 bg-[#edf2f1]/95 dark:bg-[#0e0f12]/95 border-b border-[#d9e3e1] dark:border-[#25282e] shrink-0 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            <span title={`#${local.id}`} className="font-mono text-xs font-black text-[#2f4e56] dark:text-[#b9bec9] px-2.5 py-1 rounded-lg bg-[#e1e9e7] dark:bg-[#1b1e22] border border-[#d6ded7] dark:border-[#2a2e35] tracking-tight min-w-0 truncate">
              #{local.id}
            </span>
            <span className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border shrink-0 whitespace-nowrap ${statusStyle(local)}`}>
              {statusLabel(local)}
            </span>
            {local.priority === 'High' && (
              <span className="px-2 py-0.5 text-[9px] font-black rounded-md bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 uppercase tracking-wider shrink-0">
                Urgent
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

          {rawMessages.filter(m => !m.isSystem).length === 0 && (
            <div className="text-center py-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/80 dark:bg-[#15171a]/80 border border-[#d9e3e1] dark:border-[#25282e] text-xs font-semibold text-slate-600 dark:text-slate-300 shadow-2xs">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                <span>No messages yet. Send a message to start the thread.</span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* ── Locked Bottom Input Bar ── */}
        {!(role === 'student' && isResolved) && (
          <>
          {isStaff && (
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
          <form
            onSubmit={send}
            className={`p-3 sm:p-4 bg-[#edf2f1] dark:bg-[#0e0f11] flex items-center gap-2 shrink-0 ${isStaff ? 'pt-2' : 'border-t border-[#d9e3e1] dark:border-[#25282e]'}`}
          >
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Type a message…"
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
