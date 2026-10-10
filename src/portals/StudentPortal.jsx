import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ClipboardList, Users, Search, Plus, Inbox,
  Calendar, Clock, Tag, X, RotateCcw,
  Wrench, Archive, CalendarDays, SlidersHorizontal, ChevronDown, Sliders, Map
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

function isMatchingDate(ms, dateStr) {
  if (!dateStr) return true;
  const d = new Date(ms);
  const [y, m, day] = dateStr.split('-').map(Number);
  return d.getFullYear() === y && (d.getMonth() + 1) === m && d.getDate() === day;
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
  const [timeFilter, setTimeFilter] = useState('all'); // 'all' | 'today' | 'week' | 'month' | 'slider' | 'custom_date' | 'custom_month'
  const [timeSliderDays, setTimeSliderDays] = useState(60); // 1 = today, 7 = week, 30 = month, 60+ = all time
  const [customDate, setCustomDate] = useState('');    // 'YYYY-MM-DD'
  const [customMonth, setCustomMonth] = useState('');  // 'YYYY-MM'
  const [showCustomPickers, setShowCustomPickers] = useState(false);
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

      // Time / Date / Month / Slider Filter
      const ms = createdMs(t);
      if (timeFilter === 'today') {
        if (!ms || !isSameDay(new Date(ms), new Date())) return false;
      } else if (timeFilter === 'week') {
        if (!ms || !isWithinDays(ms, 7)) return false;
      } else if (timeFilter === 'month') {
        if (!ms || !isSameMonth(new Date(ms), new Date())) return false;
      } else if (timeFilter === 'slider') {
        if (timeSliderDays < 60) {
          if (!ms || !isWithinDays(ms, timeSliderDays)) return false;
        }
      } else if (timeFilter === 'custom_date') {
        if (!ms || !isMatchingDate(ms, customDate)) return false;
      } else if (timeFilter === 'custom_month') {
        if (!ms || !isMatchingMonth(ms, customMonth)) return false;
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
  }, [baseTickets, typeFilter, timeFilter, timeSliderDays, customDate, customMonth, statusFilter, q]);

  const activeFilterCount = (typeFilter !== 'all' ? 1 : 0) + (timeFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);

  const resetAllFilters = () => {
    setTypeFilter('all');
    setTimeFilter('all');
    setTimeSliderDays(60);
    setCustomDate('');
    setCustomMonth('');
    setStatusFilter('all');
    setQ('');
    setShowCustomPickers(false);
  };

  const handleTimeSliderChange = (days) => {
    setTimeSliderDays(days);
    setCustomDate('');
    setCustomMonth('');
    if (days >= 60) {
      setTimeFilter('all');
    } else if (days === 1) {
      setTimeFilter('today');
    } else if (days === 7) {
      setTimeFilter('week');
    } else if (days === 30) {
      setTimeFilter('month');
    } else {
      setTimeFilter('slider');
    }
  };

  const handleCustomDateChange = (val) => {
    setCustomDate(val);
    if (val) {
      setTimeFilter('custom_date');
      setCustomMonth('');
    } else {
      setTimeFilter('all');
    }
  };

  const handleCustomMonthChange = (val) => {
    setCustomMonth(val);
    if (val) {
      setTimeFilter('custom_month');
      setCustomDate('');
    } else {
      setTimeFilter('all');
    }
  };

  const meInfo = TABS.find(t => t.key === tab);

  async function meToo(t) {
    try { const r = await api.joinTicket(t.id); showToast(`Added you. ${r.count} people affected.`, 'success'); }
    catch (e) { showToast(e.message, 'warning'); }
  }

  // Formatted labels for custom date/month chips
  const customDateLabel = customDate ? new Date(customDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const customMonthLabel = customMonth ? new Date(customMonth + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
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

      {/* Primary Navigation Tabs */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {TABS.map(t => {
          const Icon = t.key === 'Mine' ? ClipboardList : t.key === 'Community' ? Users : t.key === 'LostFound' ? Search : Map;
          return (
            <button key={t.key} onClick={() => { setTab(t.key); resetAllFilters(); setShowFilterMenu(false); }}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${tab === t.key ? 'bg-iiitg-800 text-white shadow' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
              <Icon className="w-4 h-4" /> {t.label}
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
        <>
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
              className="w-full pl-10 pr-9 py-2.5 text-sm bg-white border border-slate-200 rounded-xl shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-iiitg-800/20 focus:border-iiitg-800"
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
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all shadow-xs shrink-0 ${
              showFilterMenu || activeFilterCount > 0
                ? 'bg-iiitg-800 text-white border-iiitg-800 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
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

        {/* Compact Active Filter Chips with High Contrast in Dark Mode */}
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

            {timeFilter !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-600/70 rounded-lg text-xs font-bold shadow-xs">
                <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>
                  {timeFilter === 'today'
                    ? 'Today (Day)'
                    : timeFilter === 'week'
                      ? 'This Week (7d)'
                      : timeFilter === 'month'
                        ? 'This Month (30d)'
                        : timeFilter === 'slider'
                          ? `Last ${timeSliderDays} Days`
                          : timeFilter === 'custom_date'
                            ? `Date: ${customDateLabel}`
                            : `Month: ${customMonthLabel}`}
                </span>
                <button onClick={() => { setTimeFilter('all'); setTimeSliderDays(60); setCustomDate(''); setCustomMonth(''); }} className="text-blue-700 dark:text-blue-300 hover:text-blue-950 dark:hover:text-white ml-0.5 p-0.5 transition-colors">
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

        {/* ── Filter Popover with Full Dark Mode Support ── */}
        {showFilterMenu && (
          <div
            ref={filterMenuRef}
            className="filter-popover absolute right-0 top-full mt-2 w-full max-w-lg rounded-2xl border border-slate-200 shadow-2xl z-30 flex flex-col max-h-[min(540px,70vh)] animate-fadeIn overflow-hidden"
          >
            {/* Popover Sticky Header */}
            <div className="filter-popover-header flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
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
                  className="modal-x"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Popover Scrollable Body (Internal Scrollbar / Sliderbar) */}
            <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1 filter-scrollbar">
              {/* 1. Item Category / Type Filter */}
              {tab === 'Mine' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" /> Category / Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
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
                          className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all ${
                            active
                              ? 'bg-iiitg-800 dark:bg-blue-600 text-white border-iiitg-800 dark:border-blue-500 shadow-sm'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            {Icon && <Icon className="w-3.5 h-3.5" />}
                            <span>{opt.label}</span>
                          </div>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                            {opt.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. Date / Day / Month Filter + Sliderbar */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" /> Time Period
                </label>

                {/* Quick Presets */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { key: 'all', label: 'All Time', days: 60 },
                    { key: 'today', label: 'Today (Day)', days: 1, count: filterCounts.today },
                    { key: 'week', label: 'This Week', days: 7, count: filterCounts.week },
                    { key: 'month', label: 'This Month', days: 30, count: filterCounts.month },
                  ].map(opt => {
                    const active = timeFilter === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setTimeFilter(opt.key);
                          setTimeSliderDays(opt.days);
                          setCustomDate('');
                          setCustomMonth('');
                        }}
                        className={`px-2 py-2 rounded-xl border text-xs font-bold transition-all text-center ${
                          active
                            ? 'bg-iiitg-800 dark:bg-blue-600 text-white border-iiitg-800 dark:border-blue-500 shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div>{opt.label}</div>
                        {opt.count !== undefined && (
                          <span className={`text-[10px] font-semibold px-1.5 rounded-full mt-0.5 inline-block ${active ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                            {opt.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* ── Time Window Range Sliderbar ── */}
                <div className="filter-subpanel p-3 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Time Sliderbar:
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-[11px]">
                      {timeSliderDays >= 60 ? 'All Time (60+ days)' : timeSliderDays === 1 ? 'Last 1 Day (Today)' : `Last ${timeSliderDays} Days`}
                    </span>
                  </div>

                  <input
                    type="range"
                    min="1"
                    max="60"
                    step="1"
                    value={timeSliderDays}
                    onChange={e => handleTimeSliderChange(Number(e.target.value))}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer filter-range-slider"
                  />

                  <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-medium px-0.5">
                    <span>1 Day (Today)</span>
                    <span>7 Days (1 Wk)</span>
                    <span>30 Days (1 Mo)</span>
                    <span>All Time</span>
                  </div>
                </div>

                {/* Toggle Button for Custom Day / Month Picker */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowCustomPickers(v => !v)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      showCustomPickers || customDate || customMonth
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/80 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      {customDate ? `Exact Day: ${customDateLabel}` : customMonth ? `Exact Month: ${customMonthLabel}` : 'Pick specific Day / Month…'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {(customDate || customMonth) && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setCustomDate('');
                            setCustomMonth('');
                            setTimeFilter('all');
                            setTimeSliderDays(60);
                          }}
                          className="text-[10px] text-rose-500 hover:text-rose-700 underline font-bold mr-1"
                        >
                          Clear
                        </span>
                      )}
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showCustomPickers ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {/* Expandable Date Inputs (only shown when button is clicked or custom date is active) */}
                  {showCustomPickers && (
                    <div className="filter-subpanel mt-2 p-3 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 animate-fadeIn">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block mb-1">Exact Day:</span>
                          <input
                            type="date"
                            value={customDate}
                            onChange={e => handleCustomDateChange(e.target.value)}
                            className={`w-full px-2.5 py-1.5 border rounded-lg text-xs font-medium focus:outline-none focus:ring-1 ${
                              timeFilter === 'custom_date' ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-300 dark:border-slate-700'
                            }`}
                          />
                        </div>
                        <div>
                          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block mb-1">Exact Month:</span>
                          <input
                            type="month"
                            value={customMonth}
                            onChange={e => handleCustomMonthChange(e.target.value)}
                            className={`w-full px-2.5 py-1.5 border rounded-lg text-xs font-medium focus:outline-none focus:ring-1 ${
                              timeFilter === 'custom_month' ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-300 dark:border-slate-700'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Status Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" /> Status
                </label>
                <div className="grid grid-cols-4 gap-2">
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
                        className={`px-2 py-2 rounded-xl border text-xs font-bold transition-all text-center ${
                          active
                            ? 'bg-slate-800 dark:bg-blue-600 text-white border-slate-800 dark:border-blue-500 shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div>{opt.label}</div>
                        {opt.count !== undefined && (
                          <span className={`text-[10px] font-semibold px-1.5 rounded-full mt-0.5 inline-block ${active ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                            {opt.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Popover Sticky Footer */}
            <div className="filter-popover-footer px-5 py-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                Matching: <strong className="text-slate-900 dark:text-white font-bold">{list.length}</strong> of {baseTickets.length} tickets
              </span>
              <button
                type="button"
                onClick={() => setShowFilterMenu(false)}
                className="px-4 py-2 bg-iiitg-800 hover:bg-iiitg-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {list.map(t => (
            <TicketCard key={t.id} t={t} onOpen={setOpen}
              action={tab === 'Community' && t.userId !== user?.uid
                ? <button onClick={() => meToo(t)} className="px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg">Me too</button>
                : null} />
          ))}
        </div>
      )}
        </>
      )}

      {open && <TicketDetailModal ticket={open} onClose={() => setOpen(null)} />}
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
