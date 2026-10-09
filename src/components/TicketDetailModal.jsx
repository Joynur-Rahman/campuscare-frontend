import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Loader2, CheckCheck, Phone, MessageCircle, Smile, DoorOpen, ChevronDown, User, Wrench } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { statusLabel, statusStyle, ticketLabel, fmtPhone } from '../lib/ticketUtils.js';

// Time formatting helper (e.g. 10:45 AM)
function formatMsgTime(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

// WhatsApp-style day separator helper (Today, Yesterday, Oct 9)
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

// Role accent color for received messages
function getSenderColor(roleOrSender) {
  const s = String(roleOrSender || '').toLowerCase();
  if (s.includes('tech') || s.includes('staff')) return 'text-amber-600 dark:text-amber-400';
  if (s.includes('admin')) return 'text-purple-600 dark:text-purple-400';
  return 'text-emerald-600 dark:text-emerald-400';
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

// Shared ticket detail + chat drawer docked cleanly into body below topbar
export default function TicketDetailModal({ ticket, onClose, action, techs = [] }) {
  const { api, user, showToast } = useApp();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [local, setLocal] = useState(ticket);
  const endRef = useRef(null);
  const [modalCallMenuOpen, setModalCallMenuOpen] = useState(false);
  const modalCallMenuRef = useRef(null);

  useEffect(() => {
    if (!modalCallMenuOpen) return;
    const handleOutside = (e) => {
      if (modalCallMenuRef.current && !modalCallMenuRef.current.contains(e.target)) {
        setModalCallMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [modalCallMenuOpen]);

  // Measure exact bottom coordinate of the sticky TopNav header so drawer touches it with 0 gap
  const [topOffset, setTopOffset] = useState(() => {
    if (typeof document !== 'undefined') {
      const header = document.getElementById('mainTopNav') || document.querySelector('header');
      if (header) {
        return Math.round(header.getBoundingClientRect().bottom);
      }
    }
    return 64;
  });

  useEffect(() => {
    const updateOffset = () => {
      const header = document.getElementById('mainTopNav') || document.querySelector('header');
      if (header) {
        setTopOffset(Math.round(header.getBoundingClientRect().bottom));
      }
    };
    updateOffset();
    window.addEventListener('resize', updateOffset);
    window.addEventListener('scroll', updateOffset);
    return () => {
      window.removeEventListener('resize', updateOffset);
      window.removeEventListener('scroll', updateOffset);
    };
  }, []);

  const techId = local?.assignedTo || local?.assigned_to;
  const assignedTech = (techs || []).find(x => (x.firebaseId || x.clerk_id || x.id) === techId) || null;
  const techName = local?.assignedToName || assignedTech?.name || assignedTech?.full_name || (techId ? "Technician" : null);
  const techPhone = local?.assignedToPhone || assignedTech?.phone || (techId ? "9000000001" : null);
  const cleanTechPhone = techPhone ? String(techPhone).replace(/[^0-9]/g, "") : "";
  const canAdminCallBoth = isAdmin && techName && cleanTechPhone;

  const role = user?.role;
  const isAdmin = role === 'admin' || role === 'administrator';
  const isStaff = role === 'staff' || role === 'technician';
  const isStudent = role === 'student';
  const currentUserId = user?.clerk_id || user?.id || user?.uid;
  const senderName = isAdmin ? 'Administrator' : (user?.name || user?.full_name || user?.email?.split('@')[0] || 'You');
  const senderTag = isAdmin ? 'Admin' : isStaff ? 'Technician' : 'Student';

  const studentName = local?.userName || local?.studentName || 'Student';
  const studentPhone = local?.userPhone || local?.phone || local?.studentPhone || local?.user_phone || '9876543210';
  const cleanPhone = String(studentPhone).replace(/[^0-9]/g, '') || '9876543210';
  const waPhone = cleanPhone.startsWith('91') && cleanPhone.length > 10
    ? cleanPhone
    : '91' + cleanPhone.replace(/^0+/, '');
  const doorMessage = `Hi ${studentName}, I am the technician at your door (${local?.location || 'campus'}) regarding complaint #${local?.id} (${ticketLabel(local)}). Please let me in or reply here!`;
  const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(doorMessage)}`;

  // Header display identity
  const displayName = isStudent ? (local?.assignedToName || 'Campus Technician') : studentName;
  const displayPhone = isStudent ? null : cleanPhone;

  const handleSendDoorPing = async () => {
    const doorMsg = `🚪 Hello! I am at your door/room (${local?.location || 'campus'}) to resolve this complaint. Please let me in or reply here if you are away.`;
    const msg = {
      sender: senderTag,
      senderName,
      sender_id: currentUserId,
      isMine: true,
      text: doorMsg,
      at: Date.now(),
      isSystem: false,
    };
    setLocal(l => ({ ...l, messages: [...(l?.messages || []), msg] }));
    try {
      await api.addTicketMessage(local.id, msg);
      showToast('Sent arrival notification in chat!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to post arrival note', 'error');
    }
  };

  const mapMsg = (m) => {
    if (m.sender && m.text && !m.sender_id) {
      const isMine = m.isMine !== undefined ? m.isMine : (m.sender === senderTag);
      return {
        ...m,
        isMine,
        at: m.at || Date.now()
      };
    }
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
      isMine,
      sender: isMine ? senderTag : tag,
      senderName: isMine ? senderName : (m.sender_name || tag),
      at: m.created_at ? new Date(m.created_at).getTime() : (m.at || Date.now()),
      isSystem: isSys,
    };
  };

  useEffect(() => { setLocal(ticket); }, [ticket]);

  useEffect(() => {
    if (!local?.id || !api?.getThread) return;
    let active = true;
    const fetchThread = async () => {
      try {
        const list = await api.getThread(local.id);
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

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [local?.messages?.length]);

  if (!local) return null;

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
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
    } finally { setSending(false); }
  }

  const rawMessages = dedupeMessages(local.messages);

  const modalContent = (
    <>
      {/* ── Soft transparent backdrop with NO blur (click outside in body to dismiss) ── */}
      <div
        className="fixed inset-x-0 bottom-0 !m-0 !mt-0 !mb-0 z-30 bg-black/15 dark:bg-black/35 transition-opacity"
        style={{ top: `${topOffset}px`, margin: 0, marginTop: 0, marginBottom: 0 }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── Docked Slide-Over Message Drawer (Seamlessly touches top bar, perfectly fits bottom) ── */}
      <aside
        className="fixed right-0 !m-0 !mt-0 !mb-0 w-full sm:w-[430px] md:w-[450px] z-40 flex flex-col bg-[#efeae2] dark:bg-[#0b141a] shadow-2xl border-l border-slate-300/80 dark:border-[#2a3942] chat-drawer overflow-hidden"
        style={{
          top: `${topOffset}px`,
          bottom: 0,
          height: `calc(100vh - ${topOffset}px)`,
          maxHeight: `calc(100vh - ${topOffset}px)`,
          margin: 0,
          marginTop: 0,
          marginBottom: 0
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Ticket message panel"
      >
        {/* ── 1. Clean Spacious WhatsApp Header (Touches top bar) ── */}
        <div className="px-4 py-2.5 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-[#d1d7db] dark:border-[#2a3942] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Avatar with status indicator dot */}
            <div className="relative shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-600 dark:bg-[#00a884] text-white flex items-center justify-center font-bold text-sm shadow-xs select-none">
                {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#f0f2f5] dark:ring-[#202c33]" />
            </div>

            {/* Contact identity */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#111b21] dark:text-[#e9edef] truncate leading-tight">
                  {displayName}
                </h3>
              </div>
              <div className="text-[11px] text-[#667781] dark:text-[#8696a0] truncate mt-0.5 flex items-center gap-1.5 font-medium">
                {local.location && (
                  <span className="truncate max-w-[130px]">{local.location}</span>
                )}
                {displayPhone && (
                  <>
                    <span>·</span>
                    <span className="font-mono">{fmtPhone(displayPhone)}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Status badge & Close button */}
          <div className="flex items-center gap-2 shrink-0">
            <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border shadow-2xs ${statusStyle(local)}`}>
              {statusLabel(local)}
            </span>
            <button
              onClick={onClose}
              aria-label="Close message panel"
              className="p-1.5 rounded-lg text-[#54656f] hover:text-[#111b21] dark:text-[#aebac1] dark:hover:text-[#e9edef] hover:bg-slate-200/80 dark:hover:bg-slate-700/60 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── 2. Dedicated Sub-Bar for Quick Actions (Completely decluttered) ── */}
        {((isStaff || isAdmin) || action) && (
          <div className="px-3.5 py-1.5 bg-white/95 dark:bg-[#182229]/95 backdrop-blur-xs border-b border-[#d1d7db]/80 dark:border-[#2a3942]/80 flex items-center justify-between gap-2 shrink-0">
            {/* Left: Communication shortcuts tailored for Admin vs Staff */}
            {isAdmin ? (
              <div className="flex items-center gap-1.5">
                {canAdminCallBoth ? (
                  <div className="relative" ref={modalCallMenuRef}>
                    <button
                      type="button"
                      onClick={() => setModalCallMenuOpen(!modalCallMenuOpen)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-200 border border-sky-300/80 dark:border-sky-800/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 transition active:scale-95 shadow-2xs cursor-pointer"
                      title="Choose to call student or technician"
                    >
                      <Phone className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                      <span>Call</span>
                      <ChevronDown className="w-3 h-3 text-sky-500" />
                    </button>

                    {modalCallMenuOpen && (
                      <div className="absolute left-0 top-full mt-1.5 w-60 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-1.5 space-y-1">
                        <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Direct Call
                        </div>
                        <a
                          href={`tel:${cleanPhone}`}
                          onClick={() => setModalCallMenuOpen(false)}
                          className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-950/60 text-slate-800 dark:text-slate-200 transition"
                        >
                          <User className="w-3.5 h-3.5 text-sky-600" />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold truncate">{studentName} (Student)</div>
                            <div className="text-[10px] text-slate-400 font-mono">{fmtPhone(cleanPhone)}</div>
                          </div>
                        </a>
                        <a
                          href={`tel:${cleanTechPhone}`}
                          onClick={() => setModalCallMenuOpen(false)}
                          className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-slate-800 dark:text-slate-200 transition"
                        >
                          <Wrench className="w-3.5 h-3.5 text-emerald-600" />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold truncate">{techName} (Technician)</div>
                            <div className="text-[10px] text-slate-400 font-mono">{fmtPhone(cleanTechPhone)}</div>
                          </div>
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <a
                    href={`tel:${cleanPhone}`}
                    title={`Call student (${fmtPhone(cleanPhone)})`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-200 border border-sky-300/80 dark:border-sky-800/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 transition active:scale-95 shadow-2xs"
                  >
                    <Phone className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    <span>Call Student</span>
                  </a>
                )}
              </div>
            ) : isStaff ? (
              <div className="flex items-center gap-1.5">
                <a
                  href={`tel:${cleanPhone}`}
                  title={`Call student (${fmtPhone(cleanPhone)})`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300/80 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition active:scale-95 shadow-2xs"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Call</span>
                </a>

                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`WhatsApp student (${fmtPhone(cleanPhone)})`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#25d366]/10 text-emerald-800 dark:text-emerald-200 border border-[#25d366]/40 dark:border-[#25d366]/30 hover:bg-[#25d366]/20 transition active:scale-95 shadow-2xs"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-[#25d366]" />
                  <span>WhatsApp</span>
                </a>

                <button
                  type="button"
                  onClick={handleSendDoorPing}
                  title="Post arrival note in chat"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-300/80 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition active:scale-95 shadow-2xs cursor-pointer"
                >
                  <DoorOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>At door</span>
                </button>
              </div>
            ) : <div />}

            {/* Right: Primary Ticket Workflow Action (Start work / Mark as fixed) */}
            {action && (
              <div className="flex items-center shrink-0">
                {action}
              </div>
            )}
          </div>
        )}

        {/* ── 3. WhatsApp Chat Feed (Flex-1 and min-h-0 prevents bottom overflow) ── */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 chat-container-wa">
          {/* Subtle Pinned Ticket Summary Pill */}
          {local.description && (
            <div className="px-3 py-1.5 rounded-xl bg-white/95 dark:bg-[#182229]/95 backdrop-blur-xs border border-[#d1d7db] dark:border-[#263540] shadow-2xs text-xs mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span className="font-bold text-amber-700 dark:text-amber-400 text-xs shrink-0">
                  #{local.id}:
                </span>
                <span className="text-slate-700 dark:text-[#d1d7db] text-xs truncate">
                  {local.description}
                </span>
              </div>
            </div>
          )}

          {/* Messages Feed */}
          {rawMessages.map((m, i, arr) => {
            const mine = m.isMine !== undefined ? m.isMine : (m.sender === senderTag);
            if (m.isSystem) return <div key={i} className="text-center text-[11px] text-slate-500 dark:text-slate-400 py-1">{m.text}</div>;

            const currentDay = getDayString(m.at);
            const prevDay = i > 0 ? getDayString(arr[i - 1].at) : null;
            const showDaySeparator = Boolean(currentDay && currentDay !== prevDay);

            return (
              <div key={i}>
                {showDaySeparator && (
                  <div className="flex justify-center my-2">
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-white dark:bg-[#182229] text-[#54656f] dark:text-[#8696a0] shadow-2xs select-none border border-slate-200/60 dark:border-slate-800/60">
                      {currentDay}
                    </span>
                  </div>
                )}
                <div className={`flex ${mine ? 'justify-end' : 'justify-start'} my-1`}>
                  <div
                    className={`max-w-[85%] sm:max-w-[80%] px-3.5 pt-2 pb-1.5 rounded-2xl text-[13.5px] leading-relaxed relative ${
                      mine
                        ? 'chat-bubble-sent rounded-tr-xs'
                        : 'chat-bubble-received rounded-tl-xs'
                    }`}
                  >
                    {!mine && (
                      <div className={`text-[11px] font-bold tracking-tight mb-0.5 ${getSenderColor(m.sender || m.senderName)}`}>
                        {m.senderName || m.sender}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap break-words pr-2">
                      {m.text}
                    </div>
                    {/* Timestamp & double blue ticks */}
                    <div className="flex items-center justify-end gap-1 mt-1 -mb-0.5 select-none text-[10.5px] font-normal leading-none">
                      <span className={mine ? 'chat-time-sent' : 'chat-time-received'}>
                        {formatMsgTime(m.at)}
                      </span>
                      {mine && (
                        <CheckCheck className="w-3.5 h-3.5 chat-tick-blue shrink-0 inline-block" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {rawMessages.filter(m => !m.isSystem).length === 0 && (
            <div className="text-center py-10">
              <div className="inline-block px-3.5 py-1.5 rounded-xl bg-white dark:bg-[#182229] border border-slate-200/80 dark:border-[#263540] text-slate-600 dark:text-slate-300 text-xs font-medium shadow-2xs">
                No messages yet. Send a message to start the thread 👋
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* ── 4. WhatsApp Clean Input Bar (Always locked at bottom, shrink-0) ── */}
        {!(role === 'student' && (local.status === 'Resolved' || local.status === 'resolved')) && (
          <form
            onSubmit={send}
            className="p-2.5 sm:p-3 bg-[#f0f2f5] dark:bg-[#202c33] flex items-center gap-2 shrink-0 border-t border-[#d1d7db] dark:border-[#2a3942]"
          >
            <div className="text-slate-400 dark:text-[#8696a0] pl-1">
              <Smile className="w-5 h-5" />
            </div>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 px-4 py-2 sm:py-2.5 rounded-full bg-white dark:bg-[#2a3942] text-[#111b21] dark:text-[#e9edef] placeholder-slate-400 dark:placeholder-[#8696a0] text-sm focus:outline-none focus:ring-1 focus:ring-[#00a884] shadow-2xs border border-transparent transition-all"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#00a884] hover:bg-[#008f6f] text-white flex items-center justify-center transition-all disabled:opacity-40 shadow-sm shrink-0 active:scale-95 cursor-pointer"
              title="Send message"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
            </button>
          </form>
        )}
      </aside>
    </>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
}
