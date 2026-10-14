import { useState, useCallback, useMemo, useEffect } from 'react';
import { Inbox, Wrench, CheckCircle2, Loader2, Coffee, AlertCircle, X, Power, Map, Siren, CalendarDays } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { useSubscription } from '../hooks/useSubscription.js';
import TicketCard from '../components/TicketCard.jsx';
import TicketDetailModal from '../components/TicketDetailModal.jsx';
import CampusMapView from '../components/CampusMapView.jsx';
import { useBodyScrollLock } from '../lib/useBodyScrollLock.js';

const TABS = [
  { key: 'New', label: 'New jobs', hint: 'Waiting to start', status: 'Pending', Icon: Inbox, tone: 'text-amber-600 bg-amber-50' },
  { key: 'Working', label: 'Working on', hint: 'In progress', status: 'In Progress', Icon: Wrench, tone: 'text-sky-600 bg-sky-50' },
  { key: 'Done', label: 'Done', hint: 'Fixed', status: 'Resolved', Icon: CheckCircle2, tone: 'text-emerald-600 bg-emerald-50' },
  { key: 'Map', label: 'Campus map', hint: 'All my jobs', status: 'Map', Icon: Map, tone: 'text-violet-600 bg-violet-50' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function TechnicianPortal() {
  const { api, user, showToast } = useApp();
  const [tab, setTab] = useState('New');
  const [open, setOpen] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // Duty status state
  const [dutyStatus, setDutyStatus] = useState(user?.status || 'On Duty');
  const [togglingDuty, setTogglingDuty] = useState(false);

  useEffect(() => {
    if (user?.status) {
      setDutyStatus(user.status);
    }
  }, [user?.status]);

  // Resolution modal state
  const [resolveTarget, setResolveTarget] = useState(null);
  useBodyScrollLock(Boolean(resolveTarget));
  const [resolutionRemarks, setResolutionRemarks] = useState('');
  const [resolving, setResolving] = useState(false);

  // Local optimistic overlay map: ticketId -> updated status
  const [optimisticStatus, setOptimisticStatus] = useState({});

  const email = (user?.email || '').toLowerCase();
  const uid = user?.clerk_id || user?.id || user?.uid || user?.techId;
  const cacheKey = 'cc_tech_tickets_' + (uid || 'staff');

  // Instant local cache initialization so tickets render immediately (0ms)
  const [initialTickets] = useState(() => {
    try {
      const stored = localStorage.getItem(cacheKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const subscribe = useCallback(
    (cb, onErr, onSync) => api.subscribeToTickets(
      { role: 'staff', uid, email },
      (list) => {
        if (Array.isArray(list)) {
          try { localStorage.setItem(cacheKey, JSON.stringify(list)); } catch {}
        }
        cb(list);
      },
      onErr,
      onSync
    ),
    [api, uid, email, cacheKey]
  );
  const { data: all, loading } = useSubscription(subscribe, [email, uid], initialTickets);

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
    Done: mine.filter(isDone).length,
    Map: mine.length,
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

  const handleToggleDuty = async () => {
    const next = dutyStatus === 'On Duty' ? 'Off Duty' : 'On Duty';
    setTogglingDuty(true);
    setDutyStatus(next);
    try {
      if (api.updateMyDutyStatus) {
        await api.updateMyDutyStatus(next);
      } else {
        await api.updateTechnicianStatus(uid, next);
      }
      showToast(next === 'On Duty' ? 'You are now On Duty!' : 'You are now Off Duty. Enjoy your break!', 'success');
    } catch (e) {
      setDutyStatus(dutyStatus);
      showToast(e.message || 'Failed to update duty status', 'error');
    } finally {
      setTogglingDuty(false);
    }
  };

  const renderAction = (t, inModal = false) => {
    if (isNew(t)) {
      return (
        <button
          disabled={busyId === t.id}
          onClick={(e) => { e.stopPropagation(); handleStartWork(t); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-iiitg-800 hover:bg-iiitg-900 rounded-xl disabled:opacity-60 transition-colors shadow-sm shrink-0"
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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-60 transition-colors shadow-sm shrink-0"
        >
          <CheckCircle2 className="w-3.5 h-3.5" /> Mark as fixed
        </button>
      );
    }
    return null;
  };

  const firstName = String(user?.name || user?.full_name || user?.email?.split('@')[0] || 'there')
    .replace(/\s*\(.*?\)\s*/g, ' ').trim().split(/\s+/)[0];
  const roleLine = user?.dept || user?.department || user?.roleTitle || 'Campus maintenance';
  const urgentCount = mine.filter(t => !isDone(t) && (t.priority === 'High' || t.urgent)).length;
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const onDuty = dutyStatus === 'On Duty';
  const activeTab = TABS.find(t => t.key === tab);

  return (
    <div className="app-container px-4 sm:px-6 lg:px-8 pt-3 pb-1.5 space-y-3 sm:space-y-4">
      {/* ── Welcome banner ── */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#243b41] via-[#2f4e56] to-[#44646c] text-white shadow-[0_10px_30px_rgba(36,59,65,0.25)]">
        <div aria-hidden="true" className="absolute -right-16 -top-20 w-64 h-64 rounded-full bg-white/5" />
        <div aria-hidden="true" className="absolute right-24 -bottom-24 w-56 h-56 rounded-full bg-white/5" />
        <div className="relative p-5 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60 flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" /> {today}
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight">
              {greeting()}, <span className="text-[#f2c94c]">{firstName}</span>
            </h1>
            <p className="mt-1 text-sm text-white/75">
              {roleLine} · {counts.New > 0
                ? <>You have <b className="text-white">{counts.New} new job{counts.New > 1 ? 's' : ''}</b>{counts.Working > 0 && <> and <b className="text-white">{counts.Working} in progress</b></>}.</>
                : counts.Working > 0 ? <>You have <b className="text-white">{counts.Working} job{counts.Working > 1 ? 's' : ''} in progress</b>.</> : 'All caught up — nice work!'}
            </p>
            {urgentCount > 0 && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 border border-rose-300/40 px-2.5 py-1 text-[11.5px] font-bold text-rose-100">
                <Siren className="w-3.5 h-3.5" /> {urgentCount} urgent job{urgentCount > 1 ? 's' : ''} need{urgentCount > 1 ? '' : 's'} attention
              </p>
            )}
          </div>

          {/* Duty switch */}
          <div className="flex items-center gap-3 rounded-2xl bg-white/10 border border-white/15 px-4 py-3 shrink-0 self-start md:self-auto">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Status</p>
              <p className="text-sm font-bold flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${onDuty ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`} />
                {dutyStatus}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={onDuty}
              aria-label={onDuty ? 'Go off duty' : 'Go on duty'}
              disabled={togglingDuty}
              onClick={handleToggleDuty}
              className={`relative w-12 h-7 rounded-full transition-colors disabled:opacity-60 ${onDuty ? 'bg-emerald-500' : 'bg-white/25'}`}
            >
              <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center transition-transform ${onDuty ? 'translate-x-5' : ''}`}>
                {togglingDuty ? <Loader2 className="w-3 h-3 animate-spin text-slate-500" /> : <Power className="w-3 h-3 text-slate-500" />}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs with counts ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {TABS.map(t => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-pressed={on}
              className={`group flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl border text-left transition ${on ? 'bg-[#2f4e56] border-[#2f4e56] text-white shadow-md' : 'bg-white/80 border-[#d3dfdc] hover:border-[#9fbcbf] hover:bg-white'}`}
            >
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${on ? 'bg-white/15 text-white' : t.tone}`}>
                <t.Icon className="w-5 h-5" />
              </span>
              <span className="min-w-0">
                <span className={`block text-xl font-extrabold leading-none ${on ? 'text-white' : 'text-slate-900'}`}>{counts[t.key]}</span>
                <span className={`block text-[12px] font-bold mt-1 truncate ${on ? 'text-white/90' : 'text-slate-700'}`}>{t.label}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Job list ── */}
      <div className="rounded-2xl sm:rounded-3xl p-2.5 sm:p-5 bg-[#d3dfdc]/80 backdrop-blur-sm dark:bg-[#112a40]/90 border border-[#c3d2ce] dark:border-[#36365f] space-y-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
            {activeTab && <activeTab.Icon className="w-4 h-4 text-[#2f4e56]" />} {activeTab?.label}
            <span className="text-xs font-semibold text-slate-500">· {activeTab?.hint}</span>
          </h2>
          {tab !== 'Map' && list.length > 0 && <span className="text-xs font-bold text-slate-600 bg-white/70 border border-[#c3d2ce] rounded-full px-2.5 py-0.5">{list.length}</span>}
        </div>

        {tab === 'Map' ? (
          <CampusMapView tickets={mine} onSelectTicket={setOpen} />
        ) : loading && (!all || all.length === 0) ? (
          <div className="text-center py-14">
            <Loader2 className="w-6 h-6 animate-spin text-iiitg-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-500">Retrieving tickets…</p>
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-14 px-6 bg-white/80 rounded-2xl border border-[#c3d2ce] border-dashed">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#eef3f1] flex items-center justify-center mb-3"><Coffee className="w-7 h-7 text-[#7f999f]" /></div>
            <p className="text-sm font-bold text-slate-700">Nothing here right now</p>
            <p className="text-xs text-slate-500 mt-1">
              {tab === 'New' ? 'New jobs assigned to you will appear here.' : tab === 'Working' ? 'Jobs you have started will appear here.' : 'Jobs you fix will appear here.'}
            </p>
          </div>
        ) : (
          <div className="tech-scroll-area overflow-y-auto -mx-2 px-2 -mt-1 pt-1 custom-ticket-scrollbar overscroll-contain">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pb-1.5">
              {list.map(t => (
                <TicketCard key={t.id} t={t} onOpen={setOpen} footerAction={renderAction(t)} canRate={false} />
              ))}
            </div>
          </div>
        )}
      </div>

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-md" onClick={() => setResolveTarget(null)}>
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
