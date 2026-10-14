import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ClipboardList, Users, Search, Plus, Inbox,
  Calendar, Clock, Tag, X, RotateCcw,
  Wrench, Archive, CalendarDays, SlidersHorizontal, ChevronDown, Map, ArrowRight
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { useSubscription } from '../hooks/useSubscription.js';
import TicketCard from '../components/TicketCard.jsx';
import TicketDetailModal from '../components/TicketDetailModal.jsx';
import ReportModal from '../components/ReportModal.jsx';
import LostFoundModal from '../components/LostFoundModal.jsx';
import CampusMapView from '../components/CampusMapView.jsx';
import { isLostFound, createdMs } from '../lib/ticketUtils.js';

const TABS = [
  { key: 'Mine', label: 'My Tickets', title: 'My Tickets', sub: "Problems you reported, and how they're going." },
  { key: 'Community', label: 'Shared Issues', title: 'Shared Issues', sub: 'Public issues affecting many people. Press "Me too" instead of reporting again.' },
  { key: 'LostFound', label: 'Lost & Found', title: 'Lost & Found', sub: 'Lost or found something on campus? Posted here for everyone.' },
  { key: 'Map', label: 'Campus Map', title: 'Campus Issue Map', sub: 'Explore issues and lost & found spots on the interactive MapmyIndia campus map.' },
];

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function isWithinDays(ms, days) {
  const now = Date.now();
  return ms >= (now - days * 86400000) && ms <= (now + 60000);
}

function isSameMonth(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth();
}

function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isMatchingDate(ms, dateStr) {
  if (!dateStr) return true;
  const d = new Date(ms);
  const [y, m, day] = dateStr.split('-').map(Number);
  return d.getFullYear() === y && (d.getMonth() + 1) === m && d.getDate() === day;
}

function isWithinDateRange(ms, startStr, endStr) {
  if (!ms) return false;
  if (!startStr && !endStr) return true;
  if (startStr && endStr) {
    const s = new Date(startStr + 'T00:00:00').getTime();
    const e = new Date(endStr + 'T23:59:59.999').getTime();
    return ms >= s && ms <= e;
  }
  if (startStr) {
    const s = new Date(startStr + 'T00:00:00').getTime();
    return ms >= s;
  }
  if (endStr) {
    const e = new Date(endStr + 'T23:59:59.999').getTime();
    return ms <= e;
  }
  return true;
}

function isMatchingMonth(ms, monthStr) {
  if (!monthStr) return true;
  const d = new Date(ms);
  const [y, m, day] = monthStr.split('-').map(Number);
  return d.getFullYear() === y && (d.getMonth() + 1) === m;
}

const STATUS_OPTS = [
  { key: 'all', label: 'All' },
  { key: 'waiting', label: 'Waiting', count: 'waiting' },
  { key: 'progress', label: 'Being fixed', count: 'progress' },
  { key: 'resolved', label: 'Fixed', count: 'resolved' },
];
const TIME_OPTS = [
  { key: 'all', label: 'Any time' },
  { key: 'today', label: 'Today', count: 'today' },
  { key: 'week', label: 'This week', count: 'week' },
  { key: 'month', label: 'This month', count: 'month' },
];
const SORT_OPTS = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'updated', label: 'Recently updated' },
];
const updatedMs = (t) => Date.parse(t?.updated_at || '') || createdMs(t) || 0;

function Chip({ active, onClick, children, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition whitespace-nowrap ${
        active
          ? 'bg-[#2f4e56] text-white border-[#2f4e56] shadow-sm dark:bg-[#5252a2] dark:border-[#5252a2]'
          : 'bg-white/80 text-slate-700 border-[#c3d2ce] hover:bg-white hover:border-[#9fbcbf] dark:bg-[#17324b] dark:text-slate-200 dark:border-[#36365f] dark:hover:bg-[#1c3c59]'
      }`}
    >
      {children}
      {typeof count === 'number' && (
        <span className={`text-[10px] font-extrabold px-1.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-[#e3ebe9] text-[#2f4e56] dark:bg-white/10 dark:text-slate-200'}`}>{count}</span>
      )}
    </button>
  );
}

function FilterGroup({ label, children }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-0.5">{label}</span>
      {children}
    </div>
  );
}

export default function StudentPortal() {
  const { api, user, showToast } = useApp();
  const [tab, setTab] = useState('Mine');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [report, setReport] = useState(false);
  const [lf, setLf] = useState(false);

  // Filter states
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'lostfound' | 'complaints'
  const [timeFilter, setTimeFilter] = useState('all'); // 'all' | 'today' | 'week' | 'month' | 'custom_date' | 'custom_range'
  const [dateMode, setDateMode] = useState('range'); // 'single' | 'range'
  const [startDate, setStartDate] = useState('');    // 'YYYY-MM-DD'
  const [endDate, setEndDate] = useState('');        // 'YYYY-MM-DD'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'waiting' | 'progress' | 'resolved'
  const [sortBy, setSortBy] = useState('newest');
  const [showCustomDate, setShowCustomDate] = useState(false);

  const filterMenuRef = useRef(null);
  const filterBtnRef = useRef(null);

  // Close filter popover on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        filterMenuRef.current &&
        !filterMenuRef.current.contains(e.target) &&
        filterBtnRef.current &&
        !filterBtnRef.current.contains(e.target)
      ) {
        setShowFilterMenu(false);
      }
    }
    if (showFilterMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showFilterMenu]);

  const subscribe = useCallback(
    (cb, onErr, onSync) => api.subscribeToTickets({ role: 'student', uid: user?.clerk_id || user?.id || user?.uid, email: user?.email }, cb, onErr, onSync),
    [api, user?.clerk_id, user?.id, user?.uid, user?.email]
  );
  const { data: all, loading } = useSubscription(subscribe, [user?.clerk_id, user?.id, user?.uid, user?.email]);

  const myUid = user?.id || user?.uid;
  const myEmail = (user?.email || '').toLowerCase();
  const mineIds = useMemo(() => new Set(
    all.filter(t =>
      (myUid && (t.userId === myUid || t.owner_id === myUid)) ||
      (myEmail && (t.userEmail || '').toLowerCase() === myEmail)
    ).map(t => t.id)
  ), [all, myUid, myEmail]);

  // 1. Base tickets for selected tab
  const baseTickets = useMemo(() => {
    return all.filter(t => {
      if (tab === 'Mine') return mineIds.has(t.id);
      if (tab === 'LostFound') return t.isPublic && isLostFound(t);
      return t.isPublic && !isLostFound(t);
    });
  }, [all, tab, mineIds]);

  // Counts for filters within baseTickets
  const filterCounts = useMemo(() => {
    const todayDate = new Date();
    return {
      all: baseTickets.length,
      lostfound: baseTickets.filter(isLostFound).length,
      complaints: baseTickets.filter(t => !isLostFound(t)).length,
      today: baseTickets.filter(t => {
        const ms = createdMs(t);
        return ms ? isSameDay(new Date(ms), todayDate) : false;
      }).length,
      week: baseTickets.filter(t => {
        const ms = createdMs(t);
        return ms ? isWithinDays(ms, 7) : false;
      }).length,
      month: baseTickets.filter(t => {
        const ms = createdMs(t);
        return ms ? isSameMonth(new Date(ms), todayDate) : false;
      }).length,
      waiting: baseTickets.filter(t => ['pending', 'submitted', 'waiting'].includes((t?.status || '').toLowerCase().trim())).length,
      progress: baseTickets.filter(t => ['in progress', 'in_progress', 'being fixed', 'assigned'].includes((t?.status || '').toLowerCase().trim())).length,
      resolved: baseTickets.filter(t => ['resolved', 'fixed', 'done'].includes((t?.status || '').toLowerCase().trim())).length,
    };
  }, [baseTickets]);

  // 2. Filtered list based on active filters
  const list = useMemo(() => {
    return baseTickets.filter(t => {
      // Type Filter (Lost & Found vs Complaints)
      const isLf = isLostFound(t);
      if (typeFilter === 'lostfound' && !isLf) return false;
      if (typeFilter === 'complaints' && isLf) return false;

      // Time / Date / Range Filter
      const ms = createdMs(t);
      if (timeFilter === 'today') {
        if (!ms || !isSameDay(new Date(ms), new Date())) return false;
      } else if (timeFilter === 'week') {
        if (!ms || !isWithinDays(ms, 7)) return false;
      } else if (timeFilter === 'month') {
        if (!ms || !isSameMonth(new Date(ms), new Date())) return false;
      } else if (timeFilter === 'custom_date') {
        if (!ms || !isMatchingDate(ms, startDate)) return false;
      } else if (timeFilter === 'custom_range') {
        if (!ms || !isWithinDateRange(ms, startDate, endDate)) return false;
      }

      // Status Filter
      if (statusFilter !== 'all') {
        const s = (t?.status || '').toLowerCase().trim();
        if (statusFilter === 'waiting' && !['pending', 'submitted', 'waiting'].includes(s)) return false;
        if (statusFilter === 'progress' && !['in progress', 'in_progress', 'being fixed', 'assigned'].includes(s)) return false;
        if (statusFilter === 'resolved' && !['resolved', 'fixed', 'done'].includes(s)) return false;
      }

      // Search Query
      if (q.trim()) {
        const s = q.toLowerCase();
        const searchCorpus = `${t.id || ''} ${t.categoryDisplay || ''} ${t.category || ''} ${t.subCategory || ''} ${t.description || ''} ${t.location || ''} ${t.title || ''}`.toLowerCase();
        if (!searchCorpus.includes(s)) return false;
      }

      return true;
    }).sort((a, b) => sortBy === 'oldest' ? createdMs(a) - createdMs(b)
      : sortBy === 'updated' ? updatedMs(b) - updatedMs(a)
      : createdMs(b) - createdMs(a));
  }, [baseTickets, typeFilter, timeFilter, startDate, endDate, statusFilter, q, sortBy]);

  const isTimeFiltered = timeFilter !== 'all' || startDate !== '' || endDate !== '';
  const activeFilterCount = (typeFilter !== 'all' ? 1 : 0) + (isTimeFiltered ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);

  const resetAllFilters = () => {
    setTypeFilter('all');
    setTimeFilter('all');
    setStartDate('');
    setEndDate('');
    setStatusFilter('all');
    setQ('');
  };

  const handlePresetTime = (preset) => {
    setTimeFilter(preset);
    setStartDate('');
    setEndDate('');
  };

  const handleSingleDateChange = (val) => {
    setStartDate(val);
    setEndDate('');
    if (val) {
      setTimeFilter('custom_date');
    } else {
      setTimeFilter('all');
    }
  };

  const handleStartDateChange = (val) => {
    setStartDate(val);
    if (val || endDate) {
      setTimeFilter('custom_range');
    } else {
      setTimeFilter('all');
    }
  };

  const handleEndDateChange = (val) => {
    setEndDate(val);
    if (val || startDate) {
      setTimeFilter('custom_range');
    } else {
      setTimeFilter('all');
    }
  };

  const meInfo = TABS.find(t => t.key === tab);

  async function meToo(t) {
    try { const r = await api.joinTicket(t.id); showToast(`Added you. ${r.count} people affected.`, 'success'); }
    catch (e) { showToast(e.message, 'warning'); }
  }


  return (
    <div className={`app-container px-4 sm:px-6 lg:px-8 pt-3 pb-1.5 space-y-3 ${tab !== 'Map' ? 'md:space-y-0 md:gap-3 md:flex md:flex-col md:h-[calc(100dvh-66px)]' : ''}`}>
      {/* Page Title & Action */}
      <div className="shrink-0 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">{meInfo.title}</h1>
          <p className="page-sub">{meInfo.sub}</p>
        </div>
        <button onClick={() => (tab === 'LostFound' ? setLf(true) : setReport(true))} className="inline-flex items-center gap-2 px-4 py-2.5 bg-iiitg-800 hover:bg-iiitg-900 text-white text-sm font-bold rounded-xl shadow-md transition-colors">
          <Plus className="w-4 h-4 text-iiitg-gold" /> {tab === 'LostFound' ? 'Post item' : 'Report Issue'}
        </button>
      </div>

      {/* Primary Navigation Tabs — Segmented Control */}
      <div className="shrink-0 self-start p-1.5 rounded-2xl bg-[#e3ebe9]/90 dark:bg-[#152d43] border border-[#d6ded7] dark:border-[#36365f] inline-flex gap-1.5 shadow-xs overflow-x-auto no-scrollbar max-w-full">
        {TABS.map(t => {
          const Icon = t.key === 'Mine' ? ClipboardList : t.key === 'Community' ? Users : t.key === 'LostFound' ? Search : Map;
          const isActive = tab === t.key;
          return (
            <button key={t.key} onClick={() => { setTab(t.key); resetAllFilters(); setShowFilterMenu(false); }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#2f4e56] text-white shadow-sm'
                  : 'text-[#1e2f33] dark:text-[#b4c7dc] hover:bg-[#d6ded7]/60 dark:hover:bg-[#20405c]'
              }`}>
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Lost & Found Callout Banner */}
      {tab === 'LostFound' && (
        <div className="shrink-0 flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0"><Search className="w-5 h-5 text-amber-700" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900">Lost or found something on campus?</p>
            <p className="text-xs text-slate-500">Post it here so everyone can see it — the fastest way to reunite an item with its owner.</p>
          </div>
          <button onClick={() => setLf(true)} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl shrink-0 transition-colors">
            <Plus className="w-4 h-4" /> Post item
          </button>
        </div>
      )}

      {/* Main Content: Map View or Ticket List */}
      {tab === 'Map' ? (
        <CampusMapView
          tickets={all}
          onSelectTicket={setOpen}
          onRequestReport={(prefill) => setReport(prefill || true)}
        />
      ) : (
        <div className="rounded-2xl sm:rounded-3xl p-2.5 sm:p-5 bg-[#d3dfdc]/80 backdrop-blur-sm dark:bg-[#112a40]/90 border border-[#c3d2ce] dark:border-[#36365f] shadow-[0_8px_32px_rgba(47,78,86,0.06)] space-y-4 md:space-y-0 md:gap-3 md:flex-1 md:min-h-0 md:flex md:flex-col">
          {/* ── Search, sort & filters (apply instantly) ── */}
          {(() => {
            const showType = filterCounts.lostfound > 0 && filterCounts.complaints > 0;
            const customLabel = timeFilter === 'custom_range' || timeFilter === 'custom_date'
              ? (startDate && endDate && startDate === endDate
                  ? formatDateLabel(startDate)
                  : `${formatDateLabel(startDate) || 'Start'} → ${formatDateLabel(endDate) || 'Today'}`)
              : null;
            const setCustom = (from, to) => {
              setStartDate(from); setEndDate(to);
              setTimeFilter(from || to ? 'custom_range' : 'all');
            };
            const statusLabel = STATUS_OPTS.find(o => o.key === statusFilter)?.label;
            const timeLabel = customLabel || TIME_OPTS.find(o => o.key === timeFilter)?.label;

            const controls = (vertical = false) => (
              <div className={vertical ? 'space-y-4' : 'flex flex-wrap items-center gap-x-5 gap-y-2'}>
                <FilterGroup label="Status">
                  {STATUS_OPTS.map(o => (
                    <Chip key={o.key} active={statusFilter === o.key} onClick={() => setStatusFilter(o.key)} count={o.count ? filterCounts[o.count] : undefined}>{o.label}</Chip>
                  ))}
                </FilterGroup>
                {showType && (
                  <FilterGroup label="Type">
                    <Chip active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>All</Chip>
                    <Chip active={typeFilter === 'complaints'} onClick={() => setTypeFilter('complaints')} count={filterCounts.complaints}>Complaints</Chip>
                    <Chip active={typeFilter === 'lostfound'} onClick={() => setTypeFilter('lostfound')} count={filterCounts.lostfound}>Lost &amp; Found</Chip>
                  </FilterGroup>
                )}
                <FilterGroup label="Date">
                  {TIME_OPTS.map(o => (
                    <Chip key={o.key} active={timeFilter === o.key} onClick={() => { handlePresetTime(o.key); setShowCustomDate(false); }} count={o.count ? filterCounts[o.count] : undefined}>{o.label}</Chip>
                  ))}
                  <div className="relative">
                    <Chip active={!!customLabel} onClick={() => setShowCustomDate(v => !v)}>
                      <Calendar className="w-3.5 h-3.5" /> {customLabel || 'Custom…'}
                    </Chip>
                    {showCustomDate && (
                      <div className={`${vertical ? 'mt-2' : 'absolute left-0 sm:left-auto sm:right-0 top-full mt-2 z-30 w-72'} rounded-xl border border-[#c3d2ce] dark:border-[#36365f] bg-white dark:bg-[#17324b] shadow-xl p-3 space-y-2.5`}>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Pick the same date twice for a single day.</p>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">From
                            <input type="date" value={startDate} max={endDate || undefined} onChange={e => setCustom(e.target.value, endDate)} className="mt-1 w-full px-2 py-1.5 text-xs border border-slate-300 dark:border-[#36365f] rounded-lg bg-white dark:bg-[#112a40] dark:text-white" />
                          </label>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">To
                            <input type="date" value={endDate} min={startDate || undefined} onChange={e => setCustom(startDate, e.target.value)} className="mt-1 w-full px-2 py-1.5 text-xs border border-slate-300 dark:border-[#36365f] rounded-lg bg-white dark:bg-[#112a40] dark:text-white" />
                          </label>
                        </div>
                        <div className="flex justify-between">
                          <button type="button" onClick={() => setCustom('', '')} className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">Clear</button>
                          <button type="button" onClick={() => setShowCustomDate(false)} className="text-xs font-bold px-3 py-1 rounded-lg bg-[#2f4e56] dark:bg-[#5252a2] text-white">Done</button>
                        </div>
                      </div>
                    )}
                  </div>
                </FilterGroup>
              </div>
            );

            return (
              <div className="shrink-0 space-y-3">
                {/* Search + sort (+ mobile filter button) */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      value={q}
                      onChange={e => setQ(e.target.value)}
                      placeholder="Search by ID, issue or location…"
                      className="w-full pl-10 pr-9 py-2.5 text-sm bg-white dark:bg-[#152d43] border border-[#d6ded7] dark:border-[#36365f] rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2f4e56]/20 focus:border-[#2f4e56] text-[#1e2f33] dark:text-white placeholder-[#7f999f]"
                    />
                    {q && (
                      <button onClick={() => setQ('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    aria-label="Sort tickets"
                    className="hidden sm:block shrink-0 text-sm font-semibold px-3 py-2.5 rounded-xl border border-[#d6ded7] dark:border-[#36365f] bg-white dark:bg-[#152d43] text-slate-700 dark:text-slate-200 focus:outline-none"
                  >
                    {SORT_OPTS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowFilterMenu(true)}
                    className={`sm:hidden shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold border ${activeFilterCount ? 'bg-[#2f4e56] text-white border-[#2f4e56] dark:bg-[#5252a2] dark:border-[#5252a2]' : 'bg-white text-[#2f4e56] border-[#d6ded7] dark:bg-[#152d43] dark:text-slate-200 dark:border-[#36365f]'}`}
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    {activeFilterCount > 0 && <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-900 text-[11px] font-black flex items-center justify-center">{activeFilterCount}</span>}
                  </button>
                </div>

                {/* Inline filter row (tablet & laptop) */}
                <div className="hidden sm:block">{controls(false)}</div>

                {/* Active filter tags */}
                {activeFilterCount > 0 && (
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    {statusFilter !== 'all' && (
                      <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-[#2f4e56]/10 dark:bg-white/10 text-[#2f4e56] dark:text-slate-100 font-bold">
                        {statusLabel}<button onClick={() => setStatusFilter('all')} aria-label="Remove status filter" className="p-0.5 rounded-full hover:bg-black/10"><X className="w-3 h-3" /></button>
                      </span>
                    )}
                    {typeFilter !== 'all' && (
                      <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-[#2f4e56]/10 dark:bg-white/10 text-[#2f4e56] dark:text-slate-100 font-bold">
                        {typeFilter === 'lostfound' ? 'Lost & Found' : 'Complaints'}<button onClick={() => setTypeFilter('all')} aria-label="Remove type filter" className="p-0.5 rounded-full hover:bg-black/10"><X className="w-3 h-3" /></button>
                      </span>
                    )}
                    {isTimeFiltered && (
                      <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-[#2f4e56]/10 dark:bg-white/10 text-[#2f4e56] dark:text-slate-100 font-bold">
                        {timeLabel}<button onClick={() => { handlePresetTime('all'); setShowCustomDate(false); }} aria-label="Remove date filter" className="p-0.5 rounded-full hover:bg-black/10"><X className="w-3 h-3" /></button>
                      </span>
                    )}
                    <button onClick={() => { resetAllFilters(); setShowCustomDate(false); }} className="font-bold text-rose-600 dark:text-rose-400 hover:underline">Clear all</button>
                    <span className="ml-auto text-slate-500 dark:text-slate-400">Showing <b className="text-slate-800 dark:text-white">{list.length}</b> of {baseTickets.length}</span>
                  </div>
                )}

                {/* Phone: bottom sheet */}
                {showFilterMenu && createPortal(
                  <div className="sm:hidden fixed inset-0 z-[95] flex items-end bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowFilterMenu(false)}>
                    <div className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white dark:bg-[#112a40] p-5 pb-6 space-y-5 shadow-2xl" onClick={e => e.stopPropagation()}>
                      <div className="mx-auto w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Filter &amp; sort</h3>
                        <button onClick={() => { resetAllFilters(); setShowCustomDate(false); }} className="text-xs font-bold text-rose-600 dark:text-rose-400">Reset</button>
                      </div>
                      <FilterGroup label="Sort">
                        {SORT_OPTS.map(o => <Chip key={o.key} active={sortBy === o.key} onClick={() => setSortBy(o.key)}>{o.label}</Chip>)}
                      </FilterGroup>
                      {controls(true)}
                      <button onClick={() => setShowFilterMenu(false)} className="w-full py-3 rounded-xl bg-[#2f4e56] dark:bg-[#5252a2] text-white text-sm font-bold">
                        Show {list.length} ticket{list.length === 1 ? '' : 's'}
                      </button>
                    </div>
                  </div>
                , document.body)}
              </div>
            );
          })()}

      {/* Ticket List View */}
      {loading ? (
        <p className="text-center text-sm text-slate-400 py-14">Loading…</p>
      ) : list.length === 0 ? (
        <div className="text-center py-12 px-6 bg-white/80 dark:bg-[#17324b] rounded-2xl border border-[#c3d2ce] dark:border-[#36365f] border-dashed">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#eef3f1] dark:bg-white/10 flex items-center justify-center mb-3"><Inbox className="w-7 h-7 text-[#7f999f] dark:text-slate-300" /></div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
            {activeFilterCount > 0 || q ? 'No tickets match' : 'Nothing here yet'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            {activeFilterCount > 0 || q
              ? 'Try a different status or date, or clear the filters.'
              : tab === 'Mine'
                ? 'Report an issue and track the fix here.'
                : 'Items will appear here.'}
          </p>
          {(activeFilterCount > 0 || q) && (
            <button
              onClick={() => { resetAllFilters(); setShowCustomDate(false); }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2f4e56] hover:bg-[#243d43] dark:bg-[#5252a2] text-white text-xs font-bold rounded-xl transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="md:flex-1 md:min-h-0 overflow-y-auto -mx-2 px-2 -mt-1 pt-1 custom-ticket-scrollbar overscroll-contain">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pb-1.5 lg:min-h-full lg:[grid-template-rows:repeat(2,minmax(min-content,1fr))]">
            {list.map(t => {
              const isMyTicket = (myUid && (t.userId === myUid || t.owner_id === myUid)) ||
                                 (myEmail && (t.userEmail || '').toLowerCase() === myEmail);
              const hasJoined = Array.isArray(t.upvotedBy) && myUid && t.upvotedBy.includes(myUid);
              let actionBtn = null;
              if (isLostFound(t)) {
                const isLost = /\[lost\]/i.test(`${t.title || ''} ${t.description || ''}`);
                actionBtn = (
                  <span className="pl-2 text-xs font-semibold text-[#2f4e56] dark:text-[#b4c7dc]">
                    {isMyTicket ? 'Your post · replies appear in chat' : isLost ? 'Seen it? Tell the owner in chat' : 'Is it yours? Claim it in chat'}
                  </span>
                );
              } else if (tab === 'Community' || t.isPublic) {
                if (isMyTicket) {
                  actionBtn = (
                    <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold text-[#2f4e56] dark:text-[#b4c7dc] bg-[#eaf1ef] dark:bg-[#20405c] border border-[#d3dfdc] dark:border-[#36365f] rounded-full">
                      Your report
                    </span>
                  );
                } else if (hasJoined) {
                  actionBtn = (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-full">
                      ✓ Joined ({t.upvotes || 1})
                    </span>
                  );
                } else {
                  actionBtn = (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); meToo(t); }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-[#2f4e56] hover:bg-[#1e353b] dark:bg-[#5252a2] dark:hover:bg-[#466188] rounded-full transition-all shadow-xs cursor-pointer active:scale-95"
                    >
                      👍 Me too ({t.upvotes || 0})
                    </button>
                  );
                }
              }

              return (
                <TicketCard
                  key={t.id}
                  t={t}
                  onOpen={setOpen}
                  action={actionBtn}
                  canRate={Boolean(isMyTicket || hasJoined)}
                />
              );
            })}
          </div>
        </div>
      )}
        </div>
      )}

      {open && (
        <TicketDetailModal
          ticket={open}
          onClose={() => setOpen(null)}
          action={(() => {
            const isMyTicket = (myUid && (open.userId === myUid || open.owner_id === myUid)) ||
                               (myEmail && (open.userEmail || '').toLowerCase() === myEmail);
            const hasJoined = Array.isArray(open.upvotedBy) && myUid && open.upvotedBy.includes(myUid);
            if (!open.isPublic || isLostFound(open)) return null;
            if (isMyTicket) {
              return (
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                  Your report
                </span>
              );
            }
            if (hasJoined) {
              return (
                <span className="px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center gap-1">
                  ✓ Joined ({open.upvotes || 1})
                </span>
              );
            }
            return (
              <button
                type="button"
                onClick={async () => {
                  await meToo(open);
                  setOpen(prev => prev ? ({ ...prev, upvotes: (prev.upvotes || 0) + 1, upvotedBy: [...(prev.upvotedBy || []), myUid] }) : null);
                }}
                className="px-3.5 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/60 rounded-xl transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-sm"
              >
                👍 Me too ({open.upvotes || 0})
              </button>
            );
          })()}
        />
      )}
      {report && (
        <ReportModal 
          onClose={() => setReport(false)} 
          onCreated={() => setTab('Mine')} 
          initialLocation={typeof report === 'object' ? report.location : ''} 
          initialCoords={typeof report === 'object' && report.lat ? { lat: report.lat, lng: report.lng } : null} 
        />
      )}
      {lf && <LostFoundModal onClose={() => setLf(false)} onCreated={() => setTab('LostFound')} />}
    </div>
  );
}
