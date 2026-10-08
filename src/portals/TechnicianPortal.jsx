import { useState, useCallback } from 'react';
import { Inbox, Wrench, CheckCircle2, Loader2, Coffee } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { useSubscription } from '../hooks/useSubscription.js';
import TicketCard from '../components/TicketCard.jsx';
import TicketDetailModal from '../components/TicketDetailModal.jsx';

const TABS = [
  { key: 'New', label: 'New', status: 'Pending', Icon: Inbox },
  { key: 'Working', label: 'Working on', status: 'In Progress', Icon: Wrench },
  { key: 'Done', label: 'Done', status: 'Resolved', Icon: CheckCircle2 },
];

export default function TechnicianPortal() {
  const { api, user, showToast } = useApp();
  const [tab, setTab] = useState('New');
  const [open, setOpen] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const subscribe = useCallback(
    (cb, onErr, onSync) => api.subscribeToTickets({ role: 'staff', uid: user?.uid, email: user?.email }, cb, onErr, onSync),
    [api, user?.uid, user?.email]
  );
  const { data: all, loading } = useSubscription(subscribe, [user?.email]);

  const email = (user?.email || '').toLowerCase();
  const uid = user?.id || user?.uid || user?.techId;
  const mine = all.filter(t => (t.assignedToEmail || '').toLowerCase() === email || (t.assignedTo || t.assigned_to) === uid);
  const isNew = t => t.status === 'Pending' || t.status === 'assigned' || t.status === 'submitted';
  const isWorking = t => t.status === 'In Progress' || t.status === 'in_progress';
  const isDone = t => t.status === 'Resolved' || t.status === 'resolved';

  const counts = {
    New: mine.filter(isNew).length,
    Working: mine.filter(isWorking).length,
    Done: mine.filter(isDone).length
  };
  const list = mine.filter(t => tab === 'New' ? isNew(t) : tab === 'Working' ? isWorking(t) : isDone(t));

  async function act(fn, t, okMsg) {
    setBusyId(t.id);
    try { await fn(); showToast(okMsg, 'success'); }
    catch (e) { showToast(e.message || 'Action failed', 'error'); }
    finally { setBusyId(null); }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div>
        <h1 className="page-title">Work Desk</h1>
        <p className="page-sub">New tickets for you. Press Start Work when you begin.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`panel p-4 text-left transition-all ${tab === t.key ? 'ring-2 ring-iiitg-500' : ''}`}>
            <div className="stat-label text-slate-500 flex items-center gap-1.5"><t.Icon className="w-3.5 h-3.5" />{t.label}</div>
            <div className="text-2xl font-extrabold text-slate-800 mt-1">{counts[t.key]}</div>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-sm text-slate-400 py-14">Loading…</p>
      ) : list.length === 0 ? (
        <div className="text-center py-14 px-6 bg-white rounded-2xl border border-slate-200 border-dashed">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-50 flex items-center justify-center mb-3"><Coffee className="w-7 h-7 text-slate-300" /></div>
          <p className="text-sm font-bold text-slate-700">Nothing here right now</p>
          <p className="text-xs text-slate-400 mt-1">New tickets appear automatically.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {list.map(t => (
            <TicketCard key={t.id} t={t} onOpen={setOpen} action={
              isNew(t) ? (
                <button disabled={busyId === t.id} onClick={() => act(() => api.acknowledgeTicket(t.id, uid, user?.name || user?.full_name), t, 'Started work.')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-iiitg-800 hover:bg-iiitg-900 rounded-lg disabled:opacity-60">
                  {busyId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />} Start work
                </button>
              ) : isWorking(t) ? (
                <button disabled={busyId === t.id} onClick={() => act(() => api.resolveTicket(t.id, 'Resolved by technician', null, []), t, 'Marked as fixed.')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-60">
                  {busyId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Mark as fixed
                </button>
              ) : null
            } />
          ))}
        </div>
      )}


      {open && <TicketDetailModal ticket={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
