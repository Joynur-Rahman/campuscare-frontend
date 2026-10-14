import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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
    }).sort((a, b) => createdMs(b) - createdMs(a));
  }, [baseTickets, typeFilter, timeFilter, startDate, endDate, statusFilter, q]);

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
    <div className="app-container px-4 sm:px-6 lg:px-8 pt-3 pb-1.5 space-y-3">
      {/* Page Title & Action */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">{meInfo.title}</h1>
          <p className="page-sub">{meInfo.sub}</p>
        </div>
        <button onClick={() => (tab === 'LostFound' ? setLf(true) : setReport(true))} className="inline-flex items-center gap-2 px-4 py-2.5 bg-iiitg-800 hover:bg-iiitg-900 text-white text-sm font-bold rounded-xl shadow-md transition-colors">
          <Plus className="w-4 h-4 text-iiitg-gold" /> {tab === 'LostFound' ? 'Post item' : 'Report Issue'}
        </button>
      </div>

      {/* Primary Navigation Tabs — Segmented Control */}
      <div className="p-1.5 rounded-2xl bg-[#e3ebe9]/90 dark:bg-[#152d43] border border-[#d6ded7] dark:border-[#36365f] inline-flex gap-1.5 shadow-xs overflow-x-auto no-scrollbar max-w-full">
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
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
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
        <div className="rounded-2xl sm:rounded-3xl p-2.5 sm:p-5 bg-[#d3dfdc]/80 backdrop-blur-sm dark:bg-[#112a40]/90 border border-[#c3d2ce] dark:border-[#36365f] shadow-[0_8px_32px_rgba(47,78,86,0.06)] space-y-4">
          {/* ── Search Bar + Clean Filter Button ── */}
          <div className="relative">
            <div className="flex items-center gap-2.5">
              {/* Search Input */}
              <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search by ID, issue description, or location…"
              className="w-full pl-10 pr-9 py-2.5 text-sm bg-white dark:bg-[#152d43] border border-[#d6ded7] dark:border-[#36365f] rounded-xl shadow-xs transition-all focus:bg-white dark:focus:bg-[#152d43] focus:outline-none focus:ring-2 focus:ring-[#2f4e56]/20 focus:border-[#2f4e56] text-[#1e2f33] dark:text-[#ffffff] placeholder-[#7f999f]"
            />
            {q && (
              <button
                onClick={() => setQ('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Trigger Button */}
          <button
            ref={filterBtnRef}
            onClick={() => setShowFilterMenu(v => !v)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all shadow-xs shrink-0 cursor-pointer ${
              showFilterMenu || activeFilterCount > 0
                ? 'bg-[#2f4e56] text-white border-[#2f4e56] shadow-sm'
                : 'bg-[#e3ebe9] text-[#2f4e56] dark:bg-[#152d43] dark:text-[#b4c7dc] border-[#d6ded7] dark:border-[#36365f] hover:bg-[#d6ded7]'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-black text-[11px] flex items-center justify-center shadow-xs">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showFilterMenu ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Compact Active Filter Chips */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-2.5 px-0.5">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Active:</span>

            {typeFilter !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-600/70 rounded-lg text-xs font-bold shadow-xs">
                <Archive className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>{typeFilter === 'lostfound' ? 'Lost & Found' : 'Complaints & Issues'}</span>
                <button onClick={() => setTypeFilter('all')} className="text-amber-700 dark:text-amber-300 hover:text-amber-950 dark:hover:text-white ml-0.5 p-0.5 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {isTimeFiltered && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-600/70 rounded-lg text-xs font-bold shadow-xs">
                <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>
                  {timeFilter === 'today'
                    ? 'Today'
                    : timeFilter === 'week'
                      ? 'This Week (7d)'
                      : timeFilter === 'month'
                        ? 'This Month (30d)'
                        : timeFilter === 'custom_date'
                          ? `Date: ${formatDateLabel(startDate)}`
                          : timeFilter === 'custom_range'
                            ? `Range: ${formatDateLabel(startDate) || 'Start'} → ${formatDateLabel(endDate) || 'Now'}`
                            : 'Date Filter'}
                </span>
                <button
                  onClick={() => { setTimeFilter('all'); setStartDate(''); setEndDate(''); }}
                  className="text-blue-700 dark:text-blue-300 hover:text-blue-950 dark:hover:text-white ml-0.5 p-0.5 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-600/70 rounded-lg text-xs font-bold shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Status: {statusFilter === 'waiting' ? 'Waiting' : statusFilter === 'progress' ? 'Being fixed' : 'Fixed'}</span>
                <button onClick={() => setStatusFilter('all')} className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-white ml-0.5 p-0.5 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            <button
              onClick={resetAllFilters}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:underline flex items-center gap-1 ml-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Clear all
            </button>

            <span className="text-xs text-slate-400 ml-auto font-medium">
              Showing <strong className="text-slate-700 dark:text-slate-200">{list.length}</strong> of {baseTickets.length} tickets
            </span>
          </div>
        )}

        {/* ── Compact Filter Drawer with Calendar & Date Range ── */}
        {showFilterMenu && (
          <div
            ref={filterMenuRef}
            className="filter-popover w-full rounded-2xl border border-[#d6ded7] dark:border-[#36365f] bg-white/98 dark:bg-[#152d43] shadow-md flex flex-col animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden my-3 max-h-[min(420px,60vh)]"
          >
            {/* Popover Header */}
            <div className="filter-popover-header flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-iiitg-800 dark:text-amber-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Filter Tickets</h3>
                {activeFilterCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold">
                    {activeFilterCount} active
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {activeFilterCount > 0 && (
                  <button
                    onClick={resetAllFilters}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                )}
                <button
                  onClick={() => setShowFilterMenu(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Popover Body (Compact & Clean) */}
            <div className="overflow-y-auto px-4 py-3 space-y-3.5 flex-1 filter-scrollbar">
              {/* Row 1: Category & Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1. Item Category / Type Filter */}
                {tab === 'Mine' && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Tag className="w-3 h-3 text-slate-400 dark:text-slate-500" /> Category
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { key: 'all', label: 'All Items', count: filterCounts.all },
                        { key: 'lostfound', label: 'Lost & Found', icon: Archive, count: filterCounts.lostfound },
                        { key: 'complaints', label: 'Complaints', icon: Wrench, count: filterCounts.complaints },
                      ].map(opt => {
                        const active = typeFilter === opt.key;
                        const Icon = opt.icon;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setTypeFilter(opt.key)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                              active
                                ? 'bg-iiitg-800 dark:bg-blue-600 text-white border-iiitg-800 dark:border-blue-500 shadow-xs'
                                : 'bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            {Icon && <Icon className="w-3 h-3" />}
                            <span>{opt.label}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                              active ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}>
                              {opt.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Status Filter */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" /> Status
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { key: 'all', label: 'All Status' },
                      { key: 'waiting', label: 'Waiting', count: filterCounts.waiting },
                      { key: 'progress', label: 'Being fixed', count: filterCounts.progress },
                      { key: 'resolved', label: 'Fixed', count: filterCounts.resolved },
                    ].map(opt => {
                      const active = statusFilter === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setStatusFilter(opt.key)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                            active
                              ? 'bg-slate-800 dark:bg-blue-600 text-white border-slate-800 dark:border-blue-500 shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {opt.count !== undefined && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                              active ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}>
                              {opt.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Row 2: Calendar & Date Range Section */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" /> Calendar & Date Range
                  </label>
                  
                  {/* Date Mode Switcher: Single Date vs Date Range */}
                  <div className="p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center gap-0.5 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => { setDateMode('single'); if (startDate && !endDate) setTimeFilter('custom_date'); }}
                      className={`px-2.5 py-1 rounded-md transition ${
                        dateMode === 'single'
                          ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      📅 Single Day
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDateMode('range'); if (startDate || endDate) setTimeFilter('custom_range'); }}
                      className={`px-2.5 py-1 rounded-md transition ${
                        dateMode === 'range'
                          ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      ↔️ Date Range
                    </button>
                  </div>
                </div>

                {/* Quick Presets Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { key: 'all', label: 'All Time' },
                    { key: 'today', label: 'Today', count: filterCounts.today },
                    { key: 'week', label: 'This Week', count: filterCounts.week },
                    { key: 'month', label: 'This Month', count: filterCounts.month },
                  ].map(opt => {
                    const active = timeFilter === opt.key && !startDate && !endDate;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => handlePresetTime(opt.key)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                          active
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {opt.count !== undefined && (
                          <span className={`ml-1 text-[10px] px-1 rounded-full ${
                            active ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}>
                            {opt.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Interactive Calendar Input Box */}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-2">
                  {dateMode === 'single' ? (
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 shrink-0 flex items-center gap-1">
                        <CalendarDays className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Select Day:
                      </span>
                      <input
                        type="date"
                        value={startDate}
                        onChange={e => handleSingleDateChange(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      {startDate && (
                        <button
                          type="button"
                          onClick={() => { setStartDate(''); setTimeFilter('all'); }}
                          className="text-[11px] font-bold text-rose-500 hover:text-rose-700 underline px-1 shrink-0"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 w-full flex-wrap sm:flex-nowrap">
                      <div className="flex items-center gap-1.5 flex-1 min-w-[130px]">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">From:</span>
                        <input
                          type="date"
                          value={startDate}
                          onChange={e => handleStartDateChange(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0 hidden sm:block" />
                      <div className="flex items-center gap-1.5 flex-1 min-w-[130px]">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">To:</span>
                        <input
                          type="date"
                          value={endDate}
                          onChange={e => handleEndDateChange(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      {(startDate || endDate) && (
                        <button
                          type="button"
                          onClick={() => { setStartDate(''); setEndDate(''); setTimeFilter('all'); }}
                          className="text-[11px] font-bold text-rose-500 hover:text-rose-700 underline px-1 shrink-0"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Active Range Feedback Text */}
                {(startDate || endDate) && (
                  <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 px-1">
                    <span>📅 Showing tickets from <strong>{formatDateLabel(startDate) || 'Start'}</strong> to <strong>{formatDateLabel(endDate) || 'Now'}</strong></span>
                  </p>
                )}
              </div>
            </div>

            {/* Popover Sticky Footer */}
            <div className="filter-popover-footer px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/60 dark:bg-slate-900/40">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                Matching: <strong className="text-slate-900 dark:text-white font-bold">{list.length}</strong> of {baseTickets.length} tickets
              </span>
              <button
                type="button"
                onClick={() => setShowFilterMenu(false)}
                className="px-4 py-1.5 bg-[#2f4e56] hover:bg-[#243d43] dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
              >
                Apply & Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Ticket List View */}
      {loading ? (
        <p className="text-center text-sm text-slate-400 py-14">Loading…</p>
      ) : list.length === 0 ? (
        <div className="text-center py-14 px-6 bg-white rounded-2xl border border-slate-200 border-dashed">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-50 flex items-center justify-center mb-3"><Inbox className="w-7 h-7 text-slate-300" /></div>
          <h3 className="text-sm font-bold text-slate-900 mb-1">
            {activeFilterCount > 0 ? 'No tickets match your filters' : 'Nothing here yet'}
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            {activeFilterCount > 0
              ? 'Try adjusting your type, date/slider or status filter to see more tickets.'
              : tab === 'Mine'
                ? 'Report an issue and track the fix here.'
                : 'Items will appear here.'}
          </p>
          {activeFilterCount > 0 && (
            <button
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="ticket-scroll-area overflow-y-auto -mx-2 px-2 -mt-1 pt-1 custom-ticket-scrollbar overscroll-contain">
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
