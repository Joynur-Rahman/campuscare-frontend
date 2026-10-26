import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Inbox, Wrench, CheckCircle2, Loader2, Coffee,
  X, Power, Siren, Star, Timer, CalendarCheck, Filter
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { useSubscription } from '../hooks/useSubscription.js';
import TicketCard from '../components/TicketCard.jsx';
import TicketDetailModal from '../components/TicketDetailModal.jsx';
import { useBodyScrollLock } from '../lib/useBodyScrollLock.js';
import CallMenu from '../components/CallMenu.jsx';
import { createdMs, isLostFound, shortTicketId } from '../lib/ticketUtils.js';
import { landmarkForText } from '../lib/campus.js';

const ADMIN_PHONE = import.meta.env.VITE_ADMIN_OFFICE_PHONE || '';

const SORTS = [
  { key: 'urgent', label: 'Urgent first' },
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
];

const DAY = 86400000;
const resolvedMs = (t) =>
  t?.resolvedAtMs || (t?.resolved_at ? Date.parse(t.resolved_at) : null) || null;

const buildingOf = (t) => {
  const lm = landmarkForText(t?.location);
  if (lm) return lm.name;
  return String(t?.location || '').split(/\s+[—–-]\s+|,/)[0].trim();
};

const norm = (x) => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim();
const inBuilding = (t, b) => {
  if (!b || b === 'all') return true;
  return norm(buildingOf(t)) === norm(b) || norm(t?.location).includes(norm(b));
};

function fmtDuration(ms) {
  if (!ms || ms < 0) return null;
  const h = ms / 3600000;
  if (h < 1) return `${Math.max(1, Math.round(ms / 60000))}m`;
  if (h < 48) return `${h.toFixed(h < 10 ? 1 : 0)}h`;
  return `${Math.round(h / 24)}d`;
}

function ContactActions({ t }) {
  return (
    <CallMenu
      contacts={[
        { who: 'Student', name: t.userName || 'Reporter', phone: t.userPhone || t.phone || '' },
        { who: 'Admin office', name: 'CampusCare admin', phone: ADMIN_PHONE },
      ]}
    />
  );
}

const TABS = [
  { key: 'New', label: 'New Jobs', hint: 'Assigned to you · ready to start', Icon: Inbox },
  { key: 'Working', label: 'Working On', hint: 'Active repairs in progress', Icon: Wrench },
  { key: 'Done', label: 'Completed', hint: 'Fixed & resolved', Icon: CheckCircle2 },
];

export default function TechnicianPortal() {
  const { api, user, showToast, ticketModal, closeTicket } = useApp();
  const [tab, setTab] = useState('New');
  const [open, setOpen] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [sortBy, setSortBy] = useState('urgent');
  const [place, setPlace] = useState('all');
  const [urgentOnly, setUrgentOnly] = useState(false);

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

  const [initialTickets] = useState(() => {
    try {
      const stored = localStorage.getItem(cacheKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const subscribe = useCallback(
    (cb, onErr, onSync) =>
      api.subscribeToTickets(
        { role: 'staff', uid, email },
        (list) => {
          if (Array.isArray(list)) {
            try {
              localStorage.setItem(cacheKey, JSON.stringify(list));
            } catch {}
          }
          cb(list);
        },
        onErr,
        onSync
      ),
    [api, uid, email, cacheKey]
  );
  const { data: all, loading } = useSubscription(subscribe, [email, uid], initialTickets);

  // Listen to global open ticket triggers from TopNav messages / notifications
  useEffect(() => {
    if (ticketModal) {
      const full = (all || []).find(t => String(t.id) === String(ticketModal.id)) || ticketModal;
      setOpen(full);
      closeTicket();
    }
  }, [ticketModal, closeTicket, all]);

  // Apply optimistic overlay & exclude Lost & Found items from the Technician repair queue
  const enrichedTickets = useMemo(() => {
    return (all || [])
      .filter((t) => !isLostFound(t))
      .map((t) => {
        if (optimisticStatus[t.id]) {
          return { ...t, status: optimisticStatus[t.id] };
        }
        return t;
      });
  }, [all, optimisticStatus]);

  const isAssignedToMe = useCallback(
    (t) =>
      ((t.assignedToEmail || '').toLowerCase() && (t.assignedToEmail || '').toLowerCase() === email) ||
      (uid && (t.assignedTo === uid || t.assigned_to === uid)),
    [email, uid]
  );

  const mine = useMemo(() => {
    // Staff only see jobs the admin has assigned to them — no open queue to claim from
    return enrichedTickets.filter(isAssignedToMe);
  }, [enrichedTickets, isAssignedToMe]);

  const isNew = (t) =>
    t.status === 'Pending' || t.status === 'assigned' || t.status === 'submitted' || t.status === 'open';
  const isWorking = (t) => t.status === 'In Progress' || t.status === 'in_progress';
  const isDone = (t) => t.status === 'Resolved' || t.status === 'resolved' || t.status === 'fixed';

  const counts = {
    New: mine.filter(isNew).length,
    Working: mine.filter(isWorking).length,
    Done: mine.filter(isDone).length,
  };

  const tabList = mine.filter((t) =>
    tab === 'New' ? isNew(t) : tab === 'Working' ? isWorking(t) : isDone(t)
  );

  const places = useMemo(() => {
    const seen = new globalThis.Map();
    tabList.map(buildingOf).forEach((n) => {
      if (n && !seen.has(norm(n))) seen.set(norm(n), n);
    });
    return [...seen.values()]
      .map((name) => ({ name, count: tabList.filter((t) => inBuilding(t, name)).length }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [tabList]);

  const urgentOf = (t) => (t.priority === 'High' || t.urgent ? 1 : 0);

  const list = useMemo(() => {
    const out = tabList.filter(
      (t) => (place === 'all' || inBuilding(t, place)) && (!urgentOnly || urgentOf(t))
    );
    out.sort((a, b) => {
      if (sortBy === 'urgent' && urgentOf(b) !== urgentOf(a)) return urgentOf(b) - urgentOf(a);
      if (sortBy === 'oldest') return (createdMs(a) || 0) - (createdMs(b) || 0);
      return (createdMs(b) || 0) - (createdMs(a) || 0);
    });
    return out;
  }, [tabList, place, sortBy, urgentOnly]);

  const stats = useMemo(() => {
    const now = Date.now();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const done = mine.filter(isDone);
    const fixedToday = done.filter((t) => (resolvedMs(t) || 0) >= start.getTime()).length;
    const fixedWeek = done.filter((t) => now - (resolvedMs(t) || 0) <= 7 * DAY).length;
    const durations = done
      .map((t) => (resolvedMs(t) && createdMs(t) ? resolvedMs(t) - createdMs(t) : null))
      .filter((d) => d > 0);
    const avgFix = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
    const rated = done.map((t) => Number(t.rating)).filter((r) => r > 0);
    const avgRating = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null;
    return {
      fixedToday,
      fixedWeek,
      avgFix: fmtDuration(avgFix),
      avgRating,
      ratedCount: rated.length,
    };
  }, [mine]);

  useEffect(() => {
    setPlace('all');
  }, [tab]);

  const openUrgent = () => {
    const firstUrgent = mine.find((t) => !isDone(t) && (t.priority === 'High' || t.urgent));
    if (firstUrgent) setTab(isWorking(firstUrgent) ? 'Working' : 'New');
    setSortBy('urgent');
    setUrgentOnly((v) => !v);
  };

  const handleStartWork = async (t) => {
    setBusyId(t.id);
    try {
      await api.acknowledgeTicket(t.id, uid, user?.name || user?.full_name);
      setOptimisticStatus((prev) => ({ ...prev, [t.id]: 'in_progress' }));
      showToast('Started work! Ticket moved to "Working On".', 'success');
      setTab('Working');
      if (open && open.id === t.id) {
        setOpen((prev) => ({ ...prev, status: 'in_progress' }));
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
      await api.resolveTicket(
        resolveTarget.id,
        resolutionRemarks || 'Resolved by technician',
        null,
        []
      );
      setOptimisticStatus((prev) => ({ ...prev, [resolveTarget.id]: 'resolved' }));
      showToast('Ticket marked as fixed and resolved!', 'success');
      setTab('Done');
      if (open && open.id === resolveTarget.id) {
        setOpen((prev) => ({ ...prev, status: 'resolved' }));
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
      showToast(
        next === 'On Duty' ? 'You are now On Duty!' : 'You are now Off Duty. Enjoy your break!',
        'success'
      );
    } catch (e) {
      setDutyStatus(dutyStatus);
      showToast(e.message || 'Failed to update duty status', 'error');
    } finally {
      setTogglingDuty(false);
    }
  };

  const renderAction = (t) => {
    if (isNew(t)) {
      return (
        <button
          disabled={busyId === t.id}
          onClick={(e) => {
            e.stopPropagation();
            handleStartWork(t);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#2f4e56] hover:bg-[#233b41] dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded-xl disabled:opacity-60 transition-colors shadow-xs shrink-0 cursor-pointer"
        >
          {busyId === t.id ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Wrench className="w-3.5 h-3.5" />
          )}
          <span>Start work</span>
        </button>
      );
    }
    if (isWorking(t)) {
      return (
        <button
          disabled={busyId === t.id}
          onClick={(e) => {
            e.stopPropagation();
            handleOpenResolve(t);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-60 transition-colors shadow-xs shrink-0 cursor-pointer"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Mark Fixed</span>
        </button>
      );
    }
    return null;
  };

  const firstName = String(
    user?.name || user?.full_name || user?.email?.split('@')[0] || 'Technician'
  )
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .trim()
    .split(/\s+/)[0];

  const deptTag =
    (user?.name || '').match(/\((.*?)\)/)?.[1] || user?.dept || 'Campus Maintenance';
  const urgentCount = mine.filter((t) => !isDone(t) && (t.priority === 'High' || t.urgent)).length;
  const onDuty = dutyStatus === 'On Duty';
  const activeTab = TABS.find((t) => t.key === tab);

  return (
    <div className="app-container flex-1 flex flex-col min-h-0 px-4 sm:px-6 lg:px-8 pt-2.5 sm:pt-3 pb-2 space-y-2.5 lg:space-y-0 lg:gap-2.5 lg:h-[calc(100dvh-66px)]">
      {/* ── Merged Single-Row Staff Command Header ── */}
      <div className="shrink-0 rounded-2xl bg-gradient-to-r from-[#243b41] via-[#2f4e56] to-[#3b5d66] text-white shadow-sm px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Greeting + Specialty + Urgent Alert + Duty Switch */}
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-extrabold tracking-tight leading-none">
              Hello, <span className="text-[#f2c94c]">{firstName}</span>
            </h1>
            <span className="px-2 py-0.5 rounded-md bg-white/15 text-[11px] font-bold text-slate-100 border border-white/15">
              {deptTag}
            </span>
          </div>

          {/* Duty Toggle Pill */}
          <div className="inline-flex items-center gap-2 pl-2.5 pr-1.5 py-1 rounded-full bg-black/20 border border-white/15">
            <span className="text-[11px] font-bold flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  onDuty ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
                }`}
              />
              {dutyStatus}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={onDuty}
              aria-label={onDuty ? 'Go off duty' : 'Go on duty'}
              disabled={togglingDuty}
              onClick={handleToggleDuty}
              className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer disabled:opacity-60 ${
                onDuty ? 'bg-emerald-500' : 'bg-white/25'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow flex items-center justify-center transition-transform ${
                  onDuty ? 'translate-x-4' : ''
                }`}
              >
                {togglingDuty ? (
                  <Loader2 className="w-2.5 h-2.5 animate-spin text-slate-500" />
                ) : (
                  <Power className="w-2.5 h-2.5 text-slate-500" />
                )}
              </span>
            </button>
          </div>

          {urgentCount > 0 && (
            <button
              type="button"
              onClick={openUrgent}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                urgentOnly
                  ? 'bg-rose-500 text-white shadow'
                  : 'bg-rose-500/25 text-rose-100 ring-1 ring-rose-300/40 hover:bg-rose-500/40'
              }`}
            >
              <Siren className="w-3.5 h-3.5" />
              <span>{urgentCount} urgent</span>
            </button>
          )}
        </div>

        {/* Right: Segmented Workbench Tabs with Live Counts */}
        <div className="p-1 rounded-xl bg-black/20 border border-white/15 inline-flex gap-1 overflow-x-auto no-scrollbar max-w-full">
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTab(t.key);
                  setUrgentOnly(false);
                }}
                aria-pressed={on}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  on
                    ? 'bg-[#f1f5f4] text-[#243b41] shadow-xs'
                    : 'text-white/85 hover:bg-white/10 hover:text-white'
                }`}
              >
                <t.Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
                <span
                  className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                    on ? 'bg-[#243b41] text-white' : 'bg-white/15 text-white'
                  }`}
                >
                  {counts[t.key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main Content: Job Workbench ── */}
      <div key={tab} className="cc-page-in flex-1 min-h-[380px] lg:min-h-0 flex flex-col rounded-2xl p-3 sm:p-4 bg-[#d3dfdc]/80 backdrop-blur-xs dark:bg-[#101214]/90 border border-[#c3d2ce] dark:border-[#2a2e35] gap-3">
          {/* Compact Toolbar: Section Title + Scope Filter + Building Filter + Sort */}
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {activeTab && (
                <activeTab.Icon className="w-4 h-4 text-[#2f4e56] dark:text-[#b9bec9]" />
              )}
              <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                {activeTab?.label}
              </h2>
              <span className="hidden sm:inline text-xs font-medium text-slate-500 dark:text-slate-400">
                · {activeTab?.hint}
              </span>
              <span className="text-xs font-extrabold text-[#2f4e56] dark:text-slate-200 bg-white/80 dark:bg-white/10 border border-[#c3d2ce] dark:border-[#2a2e35] rounded-full px-2 py-0.5">
                {list.length}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {urgentOnly && (
                <button
                  type="button"
                  onClick={() => setUrgentOnly(false)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer"
                >
                  <Siren className="w-3 h-3" /> Urgent only <X className="w-3 h-3" />
                </button>
              )}

              {places.length > 0 && (
                <select
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  aria-label="Filter by building"
                  className="max-w-[11rem] truncate text-xs font-bold px-2.5 py-1.5 rounded-xl border border-[#c3d2ce] dark:border-[#2a2e35] bg-white dark:bg-[#15171a] text-slate-700 dark:text-slate-200 focus:outline-none"
                >
                  <option value="all">All buildings</option>
                  {places.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name} ({p.count})
                    </option>
                  ))}
                </select>
              )}

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort jobs"
                className="text-xs font-bold px-2.5 py-1.5 rounded-xl border border-[#c3d2ce] dark:border-[#2a2e35] bg-white dark:bg-[#15171a] text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                {SORTS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Done tab performance summary strip */}
          {tab === 'Done' && (
            <div className="shrink-0 grid grid-cols-3 gap-2">
              {[
                {
                  Icon: CalendarCheck,
                  label: 'Fixed this week',
                  value: stats.fixedWeek,
                  tone: 'text-emerald-600 dark:text-emerald-300',
                },
                {
                  Icon: Timer,
                  label: 'Avg resolution time',
                  value: stats.avgFix || '—',
                  tone: 'text-sky-600 dark:text-sky-300',
                },
                {
                  Icon: Star,
                  label: stats.ratedCount ? `Avg rating (${stats.ratedCount})` : 'Student rating',
                  value: stats.avgRating ? `${stats.avgRating.toFixed(1)}★` : '—',
                  tone: 'text-amber-600 dark:text-amber-300',
                },
              ].map((c) => (
                <div
                  key={c.label}
                  className="rounded-xl bg-white/85 dark:bg-[#15171a] border border-[#c3d2ce] dark:border-[#2a2e35] px-3 py-2 flex items-center gap-2.5"
                >
                  <c.Icon className={`w-4 h-4 shrink-0 ${c.tone}`} />
                  <span className="min-w-0">
                    <span className="block text-base font-extrabold text-slate-900 dark:text-white leading-none">
                      {c.value}
                    </span>
                    <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {c.label}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Job Cards Grid */}
          {loading && (!all || all.length === 0) ? (
            <div className="text-center py-14 my-auto">
              <Loader2 className="w-6 h-6 animate-spin text-iiitg-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-500">Loading jobs…</p>
            </div>
          ) : list.length === 0 ? (
            <div className="text-center py-12 px-6 bg-white/85 dark:bg-[#15171a] rounded-2xl border border-[#c3d2ce] dark:border-[#2a2e35] border-dashed my-auto">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-[#eef3f1] dark:bg-white/10 flex items-center justify-center mb-3">
                <Coffee className="w-6 h-6 text-[#7f999f] dark:text-slate-300" />
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-100">
                No repair jobs in this view
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {tab === 'New'
                  ? 'Jobs the admin assigns to you will appear here.'
                  : tab === 'Working'
                  ? 'Tickets you have started working on will appear here.'
                  : 'Completed repair tickets will appear here.'}
              </p>
            </div>
          ) : (
            <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto -mx-1 px-1 custom-ticket-scrollbar lg:overscroll-contain">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pb-2">
                {list.map((t) => (
                  <TicketCard
                    key={t.id}
                    t={t}
                    onOpen={setOpen}
                    headerAction={isDone(t) ? null : <ContactActions t={t} />}
                    footerAction={renderAction(t)}
                    canRate={false}
                  />
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
          action={renderAction(open)}
        />
      )}

      {/* Resolution Remarks Modal */}
      {resolveTarget && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs"
          onClick={() => setResolveTarget(null)}
        >
          <div
            className="bg-white dark:bg-[#121417] rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-200 dark:border-[#2a2e35]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Mark Work as Finished
                </h3>
              </div>
              <button onClick={() => setResolveTarget(null)} className="modal-x">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Ticket</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {resolveTarget.title || resolveTarget.categoryDisplay || shortTicketId(resolveTarget)}
              </p>
            </div>

            <form onSubmit={handleConfirmResolve} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Resolution Remarks / Summary of Work
                </label>
                <textarea
                  rows={3}
                  value={resolutionRemarks}
                  onChange={(e) => setResolutionRemarks(e.target.value)}
                  placeholder="Describe the action taken (e.g. replaced parts, verified working)..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#101214] dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResolveTarget(null)}
                  disabled={resolving}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-60 shadow-xs cursor-pointer"
                >
                  {resolving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  Confirm &amp; Resolve
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
