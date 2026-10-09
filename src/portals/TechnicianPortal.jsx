import { useState, useCallback, useMemo } from 'react';
import { Inbox, Wrench, CheckCircle2, Loader2, Coffee, AlertCircle, X } from 'lucide-react';
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

  // Resolution modal state
  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolutionRemarks, setResolutionRemarks] = useState('');
  const [resolving, setResolving] = useState(false);

  // Local optimistic overlay map: ticketId -> updated status
  const [optimisticStatus, setOptimisticStatus] = useState({});

  const subscribe = useCallback(
    (cb, onErr, onSync) => api.subscribeToTickets({ role: 'staff', uid: user?.clerk_id || user?.uid || user?.id, email: user?.email }, cb, onErr, onSync),
    [api, user?.clerk_id, user?.uid, user?.id, user?.email]
  );
  const { data: all, loading } = useSubscription(subscribe, [user?.email, user?.clerk_id]);

  const email = (user?.email || '').toLowerCase();
  const uid = user?.clerk_id || user?.id || user?.uid || user?.techId;

  // Apply optimistic overlay to incoming tickets
  const enrichedTickets = useMemo(() => {
    return (all || []).map(t => {
      if (optimisticStatus[t.id]) {
        return { ...t, status: optimisticStatus[t.id] };
      }
      return t;
    });
  }, [all, optimisticStatus]);

  const mine = useMemo(() => {
    // If backend already filtered to staff assigned tickets, use enrichedTickets; otherwise match uid/email
    return enrichedTickets.filter(t => 
      !t.assigned_to && !t.assignedTo 
        ? true 
        : (t.assignedToEmail || '').toLowerCase() === email || (t.assignedTo || t.assigned_to) === uid
    );
  }, [enrichedTickets, email, uid]);

  const isNew = t => t.status === 'Pending' || t.status === 'assigned' || t.status === 'submitted';
  const isWorking = t => t.status === 'In Progress' || t.status === 'in_progress';
  const isDone = t => t.status === 'Resolved' || t.status === 'resolved';

  const counts = {
    New: mine.filter(isNew).length,
    Working: mine.filter(isWorking).length,
    Done: mine.filter(isDone).length
  };
  const list = mine.filter(t => tab === 'New' ? isNew(t) : tab === 'Working' ? isWorking(t) : isDone(t));

  const handleStartWork = async (t) => {
    setBusyId(t.id);
    try {
      await api.acknowledgeTicket(t.id, uid, user?.name || user?.full_name);
      // Immediately reflect In Progress optimistically and switch tab
      setOptimisticStatus(prev => ({ ...prev, [t.id]: 'in_progress' }));
      showToast('Started work! Ticket moved to "Working on" list.', 'success');
      setTab('Working');
      if (open && open.id === t.id) {
        setOpen(prev => ({ ...prev, status: 'in_progress' }));
      }
    } catch (e) {
      showToast(e.message || 'Action failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleOpenResolve = (t) => {
    setResolveTarget(t);
    setResolutionRemarks('Issue resolved by technician.');
  };

  const handleConfirmResolve = async (e) => {
    e?.preventDefault();
    if (!resolveTarget) return;
    setResolving(true);
    try {
      await api.resolveTicket(resolveTarget.id, resolutionRemarks || 'Resolved by technician', null, []);
      setOptimisticStatus(prev => ({ ...prev, [resolveTarget.id]: 'resolved' }));
      showToast('Ticket marked as fixed and resolved!', 'success');
      setTab('Done');
      if (open && open.id === resolveTarget.id) {
        setOpen(prev => ({ ...prev, status: 'resolved' }));
      }
      setResolveTarget(null);
      setResolutionRemarks('');
    } catch (e) {
      showToast(e.message || 'Failed to resolve ticket', 'error');
    } finally {
      setResolving(false);
    }
  };

  const renderAction = (t, inModal = false) => {
    if (isNew(t)) {
      return (
        <button
          disabled={busyId === t.id}
          onClick={(e) => { e.stopPropagation(); handleStartWork(t); }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-iiitg-800 hover:bg-iiitg-900 rounded-lg disabled:opacity-60 transition-colors shadow-sm"
        >
          {busyId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />} Start work
        </button>
      );
    }
    if (isWorking(t)) {
      return (
        <button
          disabled={busyId === t.id}
          onClick={(e) => { e.stopPropagation(); handleOpenResolve(t); }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-60 transition-colors shadow-sm"
        >
          <CheckCircle2 className="w-3.5 h-3.5" /> Mark as fixed
        </button>
      );
    }
    return null;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div>
        <h1 className="page-title">Work Desk</h1>
        <p className="page-sub">New tickets for you. Press Start Work when you begin, and Mark as Fixed when finished.</p>
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
          <p className="text-sm font-bold text-slate-700">Nothing in this tab right now</p>
          <p className="text-xs text-slate-400 mt-1">
            {tab === 'New' ? 'New tickets assigned to you will appear here.' : tab === 'Working' ? 'Tickets you have started will appear here.' : 'Completed tickets will appear here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {list.map(t => (
            <TicketCard key={t.id} t={t} onOpen={setOpen} action={renderAction(t)} />
          ))}
        </div>
      )}

      {/* Ticket Details Modal */}
      {open && (
        <TicketDetailModal
          ticket={open}
          onClose={() => setOpen(null)}
          action={renderAction(open, true)}
        />
      )}

      {/* Resolution Remarks Modal */}
      {resolveTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm" onClick={() => setResolveTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Mark Work as Finished</h3>
              </div>
              <button onClick={() => setResolveTarget(null)} className="modal-x"><X className="w-5 h-5" /></button>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">Complaint</p>
              <p className="text-sm font-bold text-slate-800">{resolveTarget.title || resolveTarget.categoryDisplay || resolveTarget.id}</p>
            </div>

            <form onSubmit={handleConfirmResolve} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Resolution Remarks / Summary of Work
                </label>
                <textarea
                  rows={3}
                  value={resolutionRemarks}
                  onChange={e => setResolutionRemarks(e.target.value)}
                  placeholder="Describe the action taken (e.g. replaced parts, verified working)..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResolveTarget(null)}
                  disabled={resolving}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-60 shadow-sm"
                >
                  {resolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Confirm & Resolve
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
