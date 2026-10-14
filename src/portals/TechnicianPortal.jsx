import { useState, useCallback, useMemo, useEffect } from 'react';
import { Inbox, Wrench, CheckCircle2, Loader2, Coffee, AlertCircle, X, Power, Map, Siren, Phone, ChevronDown, Star, Timer, CalendarCheck } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { useSubscription } from '../hooks/useSubscription.js';
import TicketCard from '../components/TicketCard.jsx';
import TicketDetailModal from '../components/TicketDetailModal.jsx';
import CampusMapView from '../components/CampusMapView.jsx';
import { useBodyScrollLock } from '../lib/useBodyScrollLock.js';
import { createdMs } from '../lib/ticketUtils.js';
import { IS_MOCK } from '../api/index.js';
import { DEMO_ADMIN_PHONE } from '../api/mock.js';

// Admin office number for the staff "Call" menu (set VITE_ADMIN_OFFICE_PHONE in .env)
const ADMIN_PHONE = import.meta.env.VITE_ADMIN_OFFICE_PHONE || (IS_MOCK ? DEMO_ADMIN_PHONE : '');

const SORTS = [
  { key: 'urgent', label: 'Urgent first' },
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
];

const DAY = 86400000;
const resolvedMs = (t) => t?.resolvedAtMs || (t?.resolved_at ? Date.parse(t.resolved_at) : null) || null;
const buildingOf = (t) => String(t?.location || '').split(/\s+[—–-]\s+|,/)[0].trim();
const norm = (x) => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim();
// A job belongs to a building if its location names it (e.g. "Academic Block — 1st Floor" → Academic Block)
const inBuilding = (t, b) => { const loc = norm(t?.location); const nb = norm(b); return !!nb && (loc.startsWith(nb) || loc.includes(nb) || norm(buildingOf(t)) === nb); };
const telHref = (p) => 'tel:' + String(p || '').replace(/[^\d+]/g, '');

function fmtDuration(ms) {
  if (!ms || ms < 0) return null;
  const h = ms / 3600000;
  if (h < 1) return `${Math.max(1, Math.round(ms / 60000))}m`;
  if (h < 48) return `${h.toFixed(h < 10 ? 1 : 0)}h`;
  return `${Math.round(h / 24)}d`;
}

// Call (student / admin office) + Directions, shown in each job card's header
function ContactActions({ t }) {
  const [open, setOpen] = useState(false);
  const studentPhone = t.userPhone || t.phone || '';

  return (
    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/25 ring-1 ring-emerald-500/40 transition"
        >
          <Phone className="w-3.5 h-3.5" /> Call <ChevronDown className="w-3 h-3" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 mt-1.5 z-20 w-56 rounded-xl border border-slate-200 dark:border-[#36365f] bg-white dark:bg-[#17324b] shadow-xl py-1 text-sm">
              {[
                { who: 'Student', name: t.userName || 'Reporter', phone: studentPhone },
                { who: 'Admin office', name: 'CampusCare admin', phone: ADMIN_PHONE },
              ].map(c => c.phone ? (
                <a key={c.who} href={telHref(c.phone)} onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 dark:hover:bg-[#1c3c59]">
                  <span className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-400/15 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0"><Phone className="w-3.5 h-3.5" /></span>
                  <span className="min-w-0">
                    <span className="block font-bold text-slate-800 dark:text-slate-100 truncate">{c.who}</span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">{c.name} · {c.phone}</span>
                  </span>
                </a>
              ) : (
                <div key={c.who} className="flex items-center gap-2.5 px-3 py-2 opacity-60 cursor-not-allowed" title="No phone number available">
                  <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-400 flex items-center justify-center shrink-0"><Phone className="w-3.5 h-3.5" /></span>
                  <span className="min-w-0">
                    <span className="block font-bold text-slate-700 dark:text-slate-200">{c.who}</span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">No number shared</span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const TABS = [
  { key: 'New', label: 'New jobs', hint: 'Waiting to start', status: 'Pending', Icon: Inbox, tone: 'text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-400/15' },
  { key: 'Working', label: 'Working on', hint: 'In progress', status: 'In Progress', Icon: Wrench, tone: 'text-sky-600 bg-sky-50 dark:text-sky-300 dark:bg-sky-400/15' },
  { key: 'Done', label: 'Done', hint: 'Fixed', status: 'Resolved', Icon: CheckCircle2, tone: 'text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-400/15' },
  { key: 'Map', label: 'Campus map', hint: 'All my jobs', status: 'Map', Icon: Map, tone: 'text-violet-600 bg-violet-50 dark:text-violet-300 dark:bg-violet-400/15' },
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
  const tabList = mine.filter(t => tab === 'New' ? isNew(t) : tab === 'Working' ? isWorking(t) : isDone(t));
  const places = useMemo(() => {
    const seen = new globalThis.Map(); // (`Map` here is the lucide icon)
    // Only buildings from jobs in the current tab (loads automatically as jobs arrive)
    tabList.map(buildingOf).forEach(n => {
      if (n && !seen.has(norm(n))) seen.set(norm(n), n);
    });
    return [...seen.values()]
      .map(name => ({ name, count: tabList.filter(t => inBuilding(t, name)).length }))
      .sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name));
  }, [tabList]);
  const urgentOf = t => (t.priority === 'High' || t.urgent) ? 1 : 0;
  const list = useMemo(() => {
    const out = tabList.filter(t => (place === 'all' || inBuilding(t, place)) && (!urgentOnly || urgentOf(t)));
    out.sort((a, b) => {
      if (sortBy === 'urgent' && urgentOf(b) !== urgentOf(a)) return urgentOf(b) - urgentOf(a);
      if (sortBy === 'oldest') return (createdMs(a) || 0) - (createdMs(b) || 0);
      return (createdMs(b) || 0) - (createdMs(a) || 0);
    });
    return out;
  }, [tabList, place, sortBy, urgentOnly]);

  // Today / this-week stats (worked out from ticket timestamps)
  const stats = useMemo(() => {
    const now = Date.now();
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const done = mine.filter(isDone);
    const fixedToday = done.filter(t => (resolvedMs(t) || 0) >= start.getTime()).length;
    const fixedWeek = done.filter(t => now - (resolvedMs(t) || 0) <= 7 * DAY).length;
    const durations = done.map(t => resolvedMs(t) && createdMs(t) ? resolvedMs(t) - createdMs(t) : null).filter(d => d > 0);
    const avgFix = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
    const rated = done.map(t => Number(t.rating)).filter(r => r > 0);
    const avgRating = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null;
    return { fixedToday, fixedWeek, avgFix: fmtDuration(avgFix), avgRating, ratedCount: rated.length };
  }, [mine]);

  useEffect(() => { setPlace('all'); }, [tab]);

  // Jump to urgent jobs: open the tab that has them and show only urgent ones
  const openUrgent = () => {
    const firstUrgent = mine.find(t => !isDone(t) && (t.priority === 'High' || t.urgent));
    if (firstUrgent) setTab(isWorking(firstUrgent) ? 'Working' : 'New');
    setSortBy('urgent');
    setUrgentOnly(true);
  };

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
  const urgentCount = mine.filter(t => !isDone(t) && (t.priority === 'High' || t.urgent)).length;
  const onDuty = dutyStatus === 'On Duty';
  const activeTab = TABS.find(t => t.key === tab);

  return (
    <div className="app-container px-4 sm:px-6 lg:px-8 pt-3 pb-1.5 space-y-3 md:space-y-0 md:gap-3 md:flex md:flex-col md:h-[calc(100dvh-66px)]">
      {/* ── Welcome bar (compact) ── */}
      <div className="shrink-0 rounded-2xl bg-gradient-to-r from-[#243b41] via-[#2f4e56] to-[#44646c] text-white shadow-[0_6px_20px_rgba(36,59,65,0.22)] px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">
            Hello, <span className="text-[#f2c94c]">{firstName}</span>
          </h1>

          {/* Quick jumps */}
          <div className="flex flex-wrap items-center gap-1.5">
            {counts.New === 0 && counts.Working === 0 && urgentCount === 0 && (
              <span className="text-[13px] text-white/75">All caught up — nice work!</span>
            )}
            {counts.New > 0 && (
              <button type="button" onClick={() => { setUrgentOnly(false); setTab('New'); }}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold leading-none transition ${tab === 'New' && !urgentOnly ? 'bg-white text-[#243b41]' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                <Inbox className="w-3.5 h-3.5" /> {counts.New} new
              </button>
            )}
            {counts.Working > 0 && (
              <button type="button" onClick={() => { setUrgentOnly(false); setTab('Working'); }}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold leading-none transition ${tab === 'Working' && !urgentOnly ? 'bg-white text-[#243b41]' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                <Wrench className="w-3.5 h-3.5" /> {counts.Working} in progress
              </button>
            )}
            {urgentCount > 0 && (
              <button type="button" onClick={openUrgent}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold leading-none transition ${urgentOnly ? 'bg-rose-500 text-white' : 'bg-rose-500/25 text-rose-100 ring-1 ring-rose-300/40 hover:bg-rose-500/40'}`}>
                <Siren className="w-3.5 h-3.5" /> {urgentCount} urgent
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {/* Today (quiet, laptop only) */}
          {(stats.fixedToday > 0 || stats.avgFix) && (
            <div className="hidden lg:flex items-center gap-3 text-[11.5px] text-white/60">
              {stats.fixedToday > 0 && <span><b className="text-white text-[13px]">{stats.fixedToday}</b> fixed today</span>}
              {stats.avgFix && <span>avg fix <b className="text-white text-[13px]">{stats.avgFix}</b></span>}
              <span className="w-px h-5 bg-white/20" aria-hidden="true" />
            </div>
          )}

        {/* Duty switch */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-[12.5px] font-bold flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${onDuty ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`} />
            {dutyStatus}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={onDuty}
            aria-label={onDuty ? 'Go off duty' : 'Go on duty'}
            disabled={togglingDuty}
            onClick={handleToggleDuty}
            className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-60 ${onDuty ? 'bg-emerald-500' : 'bg-white/25'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center transition-transform ${onDuty ? 'translate-x-5' : ''}`}>
              {togglingDuty ? <Loader2 className="w-3 h-3 animate-spin text-slate-500" /> : <Power className="w-3 h-3 text-slate-500" />}
            </span>
          </button>
        </div>
        </div>
      </div>

      {/* ── Tabs with counts ── */}
      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {TABS.map(t => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => { setTab(t.key); setUrgentOnly(false); }}
              aria-pressed={on}
              className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition ${on ? 'bg-[#2f4e56] border-[#2f4e56] text-white shadow-md dark:bg-[#36365f] dark:border-[#5252a2]' : 'bg-white/80 border-[#d3dfdc] hover:border-[#9fbcbf] hover:bg-white dark:bg-[#17324b] dark:border-[#36365f] dark:hover:bg-[#1c3c59] dark:hover:border-[#466188]'}`}
            >
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${on ? 'bg-white/15 text-white' : t.tone}`}>
                <t.Icon className="w-4 h-4" />
              </span>
              <span className={`flex-1 min-w-0 text-[13px] font-bold truncate ${on ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>{t.label}</span>
              <span className={`text-lg font-extrabold leading-none ${on ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{counts[t.key]}</span>
            </button>
          );
        })}
      </div>

      {/* ── Job list ── */}
      <div className="md:flex-1 md:min-h-0 flex flex-col rounded-2xl sm:rounded-3xl p-2.5 sm:p-4 bg-[#d3dfdc]/80 backdrop-blur-sm dark:bg-[#112a40]/90 border border-[#c3d2ce] dark:border-[#36365f] gap-3">
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-1">
          <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2 whitespace-nowrap">
            {activeTab && <activeTab.Icon className="w-4 h-4 text-[#2f4e56] dark:text-[#b3cacf]" />} {activeTab?.label}
            <span className="hidden sm:inline text-xs font-semibold text-slate-500 dark:text-slate-400">· {activeTab?.hint}</span>
          </h2>
          {tab !== 'Map' && tabList.length > 0 && (
            <div className="flex items-center gap-2 min-w-0">
              {urgentOnly && (
                <button type="button" onClick={() => setUrgentOnly(false)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-400/30">
                  <Siren className="w-3 h-3" /> Urgent only <X className="w-3 h-3" />
                </button>
              )}
              {places.length > 0 && (
                <select value={place} onChange={e => setPlace(e.target.value)} aria-label="Filter by building"
                  className="max-w-[10rem] truncate text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#c3d2ce] dark:border-[#36365f] bg-white/80 dark:bg-[#17324b] text-slate-700 dark:text-slate-200 focus:outline-none">
                  <option value="all">All buildings</option>
                  {places.map(p => <option key={p.name} value={p.name}>{p.name}{p.count ? ` (${p.count})` : ''}</option>)}
                </select>
              )}
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort jobs"
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#c3d2ce] dark:border-[#36365f] bg-white/80 dark:bg-[#17324b] text-slate-700 dark:text-slate-200 focus:outline-none">
                {SORTS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-200 bg-white/70 dark:bg-white/10 border border-[#c3d2ce] dark:border-[#36365f] rounded-full px-2.5 py-0.5">{list.length}</span>
            </div>
          )}
        </div>

        {/* Done tab: this week at a glance */}
        {tab === 'Done' && (
          <div className="shrink-0 grid grid-cols-3 gap-2">
            {[
              { Icon: CalendarCheck, label: 'Fixed this week', value: stats.fixedWeek, tone: 'text-emerald-600 dark:text-emerald-300' },
              { Icon: Timer, label: 'Avg fix time', value: stats.avgFix || '—', tone: 'text-sky-600 dark:text-sky-300' },
              { Icon: Star, label: stats.ratedCount ? `Avg rating (${stats.ratedCount})` : 'Avg rating', value: stats.avgRating ? `${stats.avgRating.toFixed(1)}★` : '—', tone: 'text-amber-600 dark:text-amber-300' },
            ].map(c => (
              <div key={c.label} className="rounded-xl bg-white/80 dark:bg-[#17324b] border border-[#c3d2ce] dark:border-[#36365f] px-3 py-2 flex items-center gap-2.5">
                <c.Icon className={`w-4 h-4 shrink-0 ${c.tone}`} />
                <span className="min-w-0">
                  <span className="block text-base font-extrabold text-slate-900 dark:text-white leading-none">{c.value}</span>
                  <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5">{c.label}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {tab === 'Map' ? (
          <div className="md:flex-1 md:min-h-0 overflow-y-auto"><CampusMapView tickets={mine} onSelectTicket={setOpen} /></div>
        ) : loading && (!all || all.length === 0) ? (
          <div className="text-center py-14">
            <Loader2 className="w-6 h-6 animate-spin text-iiitg-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-500">Retrieving tickets…</p>
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-14 px-6 bg-white/80 dark:bg-[#17324b] rounded-2xl border border-[#c3d2ce] dark:border-[#36365f] border-dashed">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#eef3f1] dark:bg-white/10 flex items-center justify-center mb-3"><Coffee className="w-7 h-7 text-[#7f999f] dark:text-slate-300" /></div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-100">Nothing here right now</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {tab === 'New' ? 'New jobs assigned to you will appear here.' : tab === 'Working' ? 'Jobs you have started will appear here.' : 'Jobs you fix will appear here.'}
            </p>
          </div>
        ) : (
          <div className="md:flex-1 md:min-h-0 overflow-y-auto -mx-2 px-2 -mt-1 pt-1 custom-ticket-scrollbar overscroll-contain">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pb-1.5 md:min-h-full lg:[grid-template-rows:repeat(2,minmax(min-content,1fr))]">
              {list.map(t => (
                <TicketCard key={t.id} t={t} onOpen={setOpen} headerAction={isDone(t) ? null : <ContactActions t={t} />} footerAction={renderAction(t)} canRate={false} />
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
