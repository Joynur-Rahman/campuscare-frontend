import { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { statusLabel, statusStyle, ticketLabel } from '../lib/ticketUtils.js';

// Shared ticket detail + chat. `role` controls which actions show.
export default function TicketDetailModal({ ticket, onClose }) {
  const { api, user, showToast } = useApp();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [local, setLocal] = useState(ticket);
  const endRef = useRef(null);

  const role = user?.role;
  const isAdmin = role === 'admin' || role === 'administrator';
  const isStaff = role === 'staff' || role === 'technician';
  const currentUserId = user?.clerk_id || user?.id || user?.uid;
  const senderName = isAdmin ? 'Administrator' : (user?.name || user?.full_name || user?.email?.split('@')[0] || 'You');
  const senderTag = isAdmin ? 'Admin' : isStaff ? 'Technician' : 'Student';

  const mapMsg = (m) => {
    if (m.sender && m.text && !m.sender_id) return m; // mock format
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
    // Optimistic add FIRST — this also detaches `local` from any shared object
    // reference (mock mode), so a message can never be counted twice.
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

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] lf-modal" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-iiitg-700">{local.id}</span>
              <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${statusStyle(local)}`}>{statusLabel(local)}</span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 mt-1">{ticketLabel(local)}</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="modal-x"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
          {local.description && <div className="text-xs text-slate-600 bg-white border border-slate-200 rounded-xl p-3">{local.description}</div>}
          {dedupeMessages(local.messages).map((m, i) => {
            const mine = m.isMine !== undefined ? m.isMine : (m.sender === senderTag);
            if (m.isSystem) return <div key={i} className="text-center text-[11px] text-slate-400 py-1">{m.text}</div>;
            return (
              <div key={i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${mine ? 'bg-iiitg-800 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'}`}>
                  {!mine && <div className="text-[10px] font-bold opacity-70 mb-0.5">{m.senderName || m.sender}</div>}
                  {m.text}
                </div>
              </div>
            );
          })}
          {(local.messages || []).filter(m => !m.isSystem).length === 0 && (
            <p className="text-center text-xs text-slate-400 py-6">No messages yet. Say hello 👋</p>
          )}
          <div ref={endRef} />
        </div>

        {!(role === 'student' && (local.status === 'Resolved' || local.status === 'resolved')) && (
          <form onSubmit={send} className="p-3 border-t border-slate-100 flex items-center gap-2">
            <input value={text} onChange={e => setText(e.target.value)} placeholder="Type a message…"
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm input-enhanced focus:outline-none" />
            <button type="submit" disabled={sending} className="w-10 h-10 rounded-xl bg-iiitg-800 hover:bg-iiitg-900 text-white flex items-center justify-center disabled:opacity-60">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// Guard against a message rendering twice (e.g. an optimistic add + a feed
// echo of the same object). Genuine repeat sends differ by `at`, so kept.
function dedupeMessages(list) {
  const seen = new Set();
  return (list || []).filter(m => {
    const k = m.id || `${m.at}|${m.sender}|${m.text}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}
