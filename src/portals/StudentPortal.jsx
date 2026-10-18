import { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ClipboardList, Users, Search, Plus, Inbox,
  Calendar, X, RotateCcw,
  SlidersHorizontal, Map, Archive, Sparkles
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { useSubscription } from '../hooks/useSubscription.js';
import TicketCard from '../components/TicketCard.jsx';
import TicketDetailModal from '../components/TicketDetailModal.jsx';
import ReportModal from '../components/ReportModal.jsx';
import LostFoundModal from '../components/LostFoundModal.jsx';
import CampusMapView from '../components/CampusMapView.jsx';
import { isLostFound, createdMs } from '../lib/ticketUtils.js';
import { landmarkForText } from '../lib/campus.js';

const TABS = [
  { key: 'Mine', label: 'My Tickets', title: 'My Tickets', sub: "Track issues you've reported across campus.", Icon: ClipboardList },
  { key: 'Community', label: 'Shared Issues', title: 'Shared Issues', sub: 'Public campus issues — press "Me too" to boost priority.', Icon: Users },
  { key: 'LostFound', label: 'Lost & Found', title: 'Lost & Found', sub: 'Lost something or found something? Post it here.', Icon: Archive },
  { key: 'Map', label: 'Campus Map', title: 'Campus Map', sub: 'Where issues have been reported.', Icon: Map },
];

function isSameDay(d1, d2) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function isWithinDays(ms, days) {
  const now = Date.now();
  return ms >= now - days * 86400000 && ms <= now + 60000;
}

function isSameMonth(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
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
  return d.getFullYear() === y && d.getMonth() + 1 === m && d.getDate() === day;
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

const STATUS_OPTS = [
  { key: 'all', label: 'All', count: 'all' },
  { key: 'waiting', label: 'Waiting', count: 'waiting' },
  { key: 'progress', label: 'Being fixed', count: 'progress' },
  { key: 'resolved', label: 'Fixed', count: 'resolved' },
];

const LF_STATUS_OPTS = [
  { key: 'all', label: 'All Items', count: 'all' },
  { key: 'lost', label: '🔍 Lost', count: 'lost' },
  { key: 'found', label: '📦 Found', count: 'found' },
  { key: 'resolved', label: '✓ Claimed', count: 'resolved' },
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

const isLostPost = (t) =>
  /\[lost\]|\blost\b/i.test(`${t?.subCategory || ''} ${t?.title || ''} ${t?.description || ''}`) &&
  !/\[found\]|\bfound item\b/i.test(`${t?.subCategory || ''} ${t?.title || ''} ${t?.description || ''}`);

function Chip({ active, onClick, children, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition whitespace-nowrap cursor-pointer ${
        active
          ? 'bg-[#2f4e56] text-white border-[#2f4e56] shadow-2xs dark:bg-indigo-600 dark:border-indigo-500'
          : 'bg-white text-slate-700 border-[#c3d2ce] hover:bg-slate-50 dark:bg-[#15171a] dark:text-slate-200 dark:border-[#2a2e35] dark:hover:bg-[#1b1d21]'
      }`}
    >
      {children}
      {typeof count === 'number' && (
        <span
          className={`text-[10px] font-extrabold px-1.5 rounded-full ${
            active
              ? 'bg-white/20 text-white'
              : 'bg-[#e3ebe9] text-[#2f4e56] dark:bg-white/10 dark:text-slate-200'
          }`}
        >
          {count}
        </span>
      )}
    </button>
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
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'waiting' | 'progress' | 'resolved' | 'lost' | 'found'
  const [buildingFilter, setBuildingFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all'); // 'all' | 'today' | 'week' | 'month' | 'custom_date' | 'custom_range'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [showCustomDate, setShowCustomDate] = useState(false);

  const subscribe = useCallback(
    (cb, onErr, onSync) =>
      api.subscribeToTickets(
        { role: 'student', uid: user?.clerk_id || user?.id || user?.uid, email: user?.email },
        cb,
        onErr,
        onSync
      ),
    [api, user?.clerk_id, user?.id, user?.uid, user?.email]
  );
  const { data: all, loading } = useSubscription(subscribe, [
    user?.clerk_id,
    user?.id,
    user?.uid,
    user?.email,
  ]);

  const myUid = user?.clerk_id || user?.id || user?.uid;
  const myEmail = (user?.email || '').toLowerCase();

  const mineIds = useMemo(
    () =>
      new Set(
        (all || [])
          .filter(
            (t) =>
              (myUid && (t.userId === myUid || t.owner_id === myUid || t.clerk_id === myUid || t.clerk_id === myUid)) ||
              (myEmail && (t.userEmail || '').toLowerCase() === myEmail)
          )
          .map((t) => t.id)
      ),
    [all, myUid, myEmail]
  );

  // Campus map: only this student's own tickets + shared issues + lost & found (never other
  // students' private or confidential complaints)
  const mapTickets = useMemo(
    () => (all || []).filter((t) => mineIds.has(t.id) || (t.isPublic && !t.confidential)),
    [all, mineIds]
  );

  // Tab counts for the header segmented bar
  const tabCounts = useMemo(() => {
    const listAll = all || [];
    return {
      Mine: listAll.filter((t) => mineIds.has(t.id)).length,
      Community: listAll.filter((t) => t.isPublic && !isLostFound(t)).length,
      LostFound: listAll.filter((t) => t.isPublic && isLostFound(t)).length,
      Map: listAll.filter((t) => mineIds.has(t.id) || (t.isPublic && !t.confidential)).length,
    };
  }, [all, mineIds]);

  // Base tickets for the active tab
  const baseTickets = useMemo(() => {
    return (all || []).filter((t) => {
      if (tab === 'Mine') return mineIds.has(t.id);
      if (tab === 'LostFound') return t.isPublic && isLostFound(t);
      return t.isPublic && !isLostFound(t);
    });
  }, [all, tab, mineIds]);

  // Building options present in baseTickets
  const buildingOpts = useMemo(() => {
    const map = new globalThis.Map();
    baseTickets.forEach((t) => {
      const lm = landmarkForText(t.location);
      const name = lm ? lm.name : String(t.location || '').split(/\s+[—–-]\s+|,/)[0].trim();
      if (name) map.set(name, (map.get(name) || 0) + 1);
    });
    return [...map.entries()].map(([name, count]) => ({ name, count }));
  }, [baseTickets]);

  // Counts for status & time filters
  const filterCounts = useMemo(() => {
    const todayDate = new Date();
    const isRes = (t) => ['resolved', 'fixed', 'done'].includes((t?.status || '').toLowerCase().trim());
    return {
      all: baseTickets.length,
      lost: baseTickets.filter((t) => !isRes(t) && isLostPost(t)).length,
      found: baseTickets.filter((t) => !isRes(t) && !isLostPost(t)).length,
      today: baseTickets.filter((t) => {
        const ms = createdMs(t);
        return ms ? isSameDay(new Date(ms), todayDate) : false;
      }).length,
      week: baseTickets.filter((t) => {
        const ms = createdMs(t);
        return ms ? isWithinDays(ms, 7) : false;
      }).length,
      month: baseTickets.filter((t) => {
        const ms = createdMs(t);
        return ms ? isSameMonth(new Date(ms), todayDate) : false;
      }).length,
      waiting: baseTickets.filter((t) =>
        ['pending', 'submitted', 'waiting'].includes((t?.status || '').toLowerCase().trim())
      ).length,
      progress: baseTickets.filter((t) =>
        ['in progress', 'in_progress', 'being fixed', 'assigned'].includes(
          (t?.status || '').toLowerCase().trim()
        )
      ).length,
      resolved: baseTickets.filter(isRes).length,
    };
  }, [baseTickets]);

  // Filtered list
  const list = useMemo(() => {
    return baseTickets
      .filter((t) => {
        // Building filter
        if (buildingFilter !== 'all') {
          const lm = landmarkForText(t.location);
          const bName = lm ? lm.name : String(t.location || '').split(/\s+[—–-]\s+|,/)[0].trim();
          if (bName !== buildingFilter) return false;
        }

        // Time / Date filter
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

        // Status / LostFound filter
        if (statusFilter !== 'all') {
          const s = (t?.status || '').toLowerCase().trim();
          const resolved = ['resolved', 'fixed', 'done'].includes(s);
          if (tab === 'LostFound') {
            if (statusFilter === 'lost' && (resolved || !isLostPost(t))) return false;
            if (statusFilter === 'found' && (resolved || isLostPost(t))) return false;
            if (statusFilter === 'resolved' && !resolved) return false;
          } else {
            if (statusFilter === 'waiting' && !['pending', 'submitted', 'waiting'].includes(s)) return false;
            if (
              statusFilter === 'progress' &&
              !['in progress', 'in_progress', 'being fixed', 'assigned'].includes(s)
            )
              return false;
            if (statusFilter === 'resolved' && !resolved) return false;
          }
        }

        // Search query
        if (q.trim()) {
          const sq = q.toLowerCase();
          const corpus = `${t.id || ''} ${t.categoryDisplay || ''} ${t.category || ''} ${
            t.subCategory || ''
          } ${t.description || ''} ${t.location || ''} ${t.title || ''}`.toLowerCase();
          if (!corpus.includes(sq)) return false;
        }

        return true;
      })
      .sort((a, b) =>
        sortBy === 'oldest'
          ? createdMs(a) - createdMs(b)
          : sortBy === 'updated'
          ? updatedMs(b) - updatedMs(a)
          : createdMs(b) - createdMs(a)
      );
  }, [baseTickets, buildingFilter, timeFilter, startDate, endDate, statusFilter, tab, q, sortBy]);

  const isTimeFiltered = timeFilter !== 'all' || startDate !== '' || endDate !== '';
  const activeFilterCount =
    (buildingFilter !== 'all' ? 1 : 0) + (isTimeFiltered ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);

  const resetAllFilters = () => {
    setBuildingFilter('all');
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

  const meInfo = TABS.find((t) => t.key === tab) || TABS[0];
  const activeStatusOpts = tab === 'LostFound' ? LF_STATUS_OPTS : STATUS_OPTS;

  async function meToo(t) {
    try {
      const r = await api.joinTicket(t.id);
      showToast(`Added you. ${r.count} people affected.`, 'success');
    } catch (e) {
      showToast(e.message, 'warning');
    }
  }

  return (
    <div className="app-container px-4 sm:px-6 lg:px-8 pt-2.5 sm:pt-3 pb-2 space-y-2.5 lg:space-y-0 lg:gap-2.5 lg:flex lg:flex-col lg:h-[calc(100dvh-66px)]">
      {/* ── Merged Single-Row Header: Title (Left) + Segmented Tabs (Center) + CTA (Right) ── */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2.5">
        <div className="min-w-0 flex items-baseline gap-2.5">
          <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white leading-none">
            {meInfo.title}
          </h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate hidden md:inline">
            {meInfo.sub}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap max-w-full">
          {/* Segmented Navigation Bar */}
          <div className="p-1 rounded-2xl bg-[#e3ebe9]/95 dark:bg-[#121417] border border-[#d6ded7] dark:border-[#2a2e35] inline-flex gap-1 overflow-x-auto no-scrollbar max-w-full shadow-2xs">
            {TABS.map((t) => {
              const Icon = t.Icon;
              const isActive = tab === t.key;
              const cnt = tabCounts[t.key] || 0;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setTab(t.key);
                    resetAllFilters();
                    setShowFilterMenu(false);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#2f4e56] text-white shadow-xs dark:bg-indigo-600'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-[#d6ded7]/60 dark:hover:bg-[#1d2024]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                  {t.key !== 'Map' && (
                    <span
                      className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-white/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {cnt}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Contextual Primary Action Button */}
          <button
            type="button"
            onClick={() => (tab === 'LostFound' ? setLf(true) : setReport(true))}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-extrabold rounded-xl shadow-sm transition-all cursor-pointer active:scale-95 ${
              tab === 'LostFound'
                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                : 'bg-[#262262] hover:bg-[#1d1a4e] text-white'
            }`}
          >
            <Plus className="w-4 h-4 text-amber-300" />
            <span>{tab === 'LostFound' ? 'Post Lost / Found' : 'Report Issue'}</span>
          </button>
        </div>
      </div>

      {/* ── Main Content Area: Full-Viewport Campus Map OR Compact Filter + Ticket Grid ── */}
      {tab === 'Map' ? (
        <div key="map" className="cc-page-in lg:flex-1 lg:min-h-0">
          <CampusMapView
            tickets={mapTickets}
            onSelectTicket={setOpen}
            fill
          />
        </div>
      ) : (
        <div key={tab} className="cc-page-in rounded-2xl p-3 sm:p-4 bg-[#d3dfdc]/80 backdrop-blur-xs dark:bg-[#101214]/90 border border-[#c3d2ce] dark:border-[#2a2e35] shadow-xs space-y-3 lg:space-y-0 lg:gap-3 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
          {/* ── Compact Single-Surface Filter Bar ── */}
          {(() => {
            const customLabel =
              timeFilter === 'custom_range' || timeFilter === 'custom_date'
                ? startDate && endDate && startDate === endDate
                  ? formatDateLabel(startDate)
                  : `${formatDateLabel(startDate) || 'Start'} → ${formatDateLabel(endDate) || 'Today'}`
                : null;
            const setCustom = (from, to) => {
              setStartDate(from);
              setEndDate(to);
              setTimeFilter(from || to ? 'custom_range' : 'all');
            };

            return (
              <div className="shrink-0 space-y-2">
                {/* Row 1: Search + Status Chips + Building Dropdown + Sort */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Search input */}
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder={
                        tab === 'LostFound'
                          ? 'Search lost or found items by name, place, or ID…'
                          : 'Search by ID, issue, room, or building…'
                      }
                      className="w-full pl-8 pr-8 py-1.5 text-xs sm:text-sm bg-white dark:bg-[#121417] border border-[#d6ded7] dark:border-[#2a2e35] rounded-xl shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#2f4e56]/20 focus:border-[#2f4e56] text-[#1e2f33] dark:text-white placeholder-[#7f999f]"
                    />
                    {q && (
                      <button
                        onClick={() => setQ('')}
                        aria-label="Clear search"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Status / LostFound quick pills (desktop/tablet) */}
                  <div className="hidden sm:flex items-center gap-1 flex-wrap">
                    {activeStatusOpts.map((o) => (
                      <Chip
                        key={o.key}
                        active={statusFilter === o.key}
                        onClick={() => setStatusFilter(o.key)}
                        count={o.count ? filterCounts[o.count] : undefined}
                      >
                        {o.label}
                      </Chip>
                    ))}
                  </div>

                  {/* Building filter dropdown */}
                  {buildingOpts.length > 1 && (
                    <select
                      value={buildingFilter}
                      onChange={(e) => setBuildingFilter(e.target.value)}
                      aria-label="Filter by building"
                      className="hidden md:block text-xs font-bold px-2.5 py-1.5 rounded-xl border border-[#c3d2ce] dark:border-[#2a2e35] bg-white dark:bg-[#121417] text-slate-700 dark:text-slate-200 focus:outline-none"
                    >
                      <option value="all">All buildings</option>
                      {buildingOpts.map((b) => (
                        <option key={b.name} value={b.name}>
                          {b.name} ({b.count})
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Date filter dropdown / custom trigger */}
                  <div className="hidden lg:flex items-center gap-1">
                    {TIME_OPTS.map((o) => (
                      <Chip
                        key={o.key}
                        active={timeFilter === o.key}
                        onClick={() => {
                          handlePresetTime(o.key);
                          setShowCustomDate(false);
                        }}
                      >
                        {o.label}
                      </Chip>
                    ))}
                    <div className="relative">
                      <Chip active={!!customLabel} onClick={() => setShowCustomDate((v) => !v)}>
                        <Calendar className="w-3 h-3" /> {customLabel || 'Custom'}
                      </Chip>
                      {showCustomDate && (
                        <div className="absolute right-0 top-full mt-2 z-30 w-72 rounded-xl border border-[#c3d2ce] dark:border-[#2a2e35] bg-white dark:bg-[#15171a] shadow-xl p-3 space-y-2.5">
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Select a date range to filter tickets.
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                              From
                              <input
                                type="date"
                                value={startDate}
                                max={endDate || undefined}
                                onChange={(e) => setCustom(e.target.value, endDate)}
                                className="mt-1 w-full px-2 py-1.5 text-xs border border-slate-300 dark:border-[#2a2e35] rounded-lg bg-white dark:bg-[#101214] dark:text-white"
                              />
                            </label>
                            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                              To
                              <input
                                type="date"
                                value={endDate}
                                min={startDate || undefined}
                                onChange={(e) => setCustom(startDate, e.target.value)}
                                className="mt-1 w-full px-2 py-1.5 text-xs border border-slate-300 dark:border-[#2a2e35] rounded-lg bg-white dark:bg-[#101214] dark:text-white"
                              />
                            </label>
                          </div>
                          <div className="flex justify-between">
                            <button
                              type="button"
                              onClick={() => setCustom('', '')}
                              className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                            >
                              Clear
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowCustomDate(false)}
                              className="text-xs font-bold px-3 py-1 rounded-lg bg-[#2f4e56] dark:bg-[#6366f1] text-white"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sort selector */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    aria-label="Sort tickets"
                    className="hidden sm:block shrink-0 text-xs font-bold px-2.5 py-1.5 rounded-xl border border-[#c3d2ce] dark:border-[#2a2e35] bg-white dark:bg-[#121417] text-slate-700 dark:text-slate-200 focus:outline-none"
                  >
                    {SORT_OPTS.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>

                  {/* Mobile Filter Sheet Trigger */}
                  <button
                    type="button"
                    onClick={() => setShowFilterMenu(true)}
                    className={`sm:hidden shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
                      activeFilterCount
                        ? 'bg-[#2f4e56] text-white border-[#2f4e56]'
                        : 'bg-white text-[#2f4e56] border-[#d6ded7] dark:bg-[#121417] dark:text-slate-200 dark:border-[#2a2e35]'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Filters</span>
                    {activeFilterCount > 0 && (
                      <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black flex items-center justify-center">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Active filter summary strip */}
                {activeFilterCount > 0 && (
                  <div className="flex items-center justify-between gap-2 text-xs px-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-600 dark:text-slate-300 font-semibold">
                        Showing <strong>{list.length}</strong> of {baseTickets.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          resetAllFilters();
                          setShowCustomDate(false);
                        }}
                        className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" /> Reset filters
                      </button>
                    </div>
                  </div>
                )}

                {/* Mobile bottom sheet */}
                {showFilterMenu &&
                  createPortal(
                    <div
                      className="sm:hidden fixed inset-0 z-[95] flex items-end bg-slate-900/60 backdrop-blur-xs"
                      onClick={() => setShowFilterMenu(false)}
                    >
                      <div
                        className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white dark:bg-[#101214] p-5 pb-6 space-y-4 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="mx-auto w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                            Filter &amp; sort
                          </h3>
                          <button
                            onClick={() => {
                              resetAllFilters();
                              setShowCustomDate(false);
                            }}
                            className="text-xs font-bold text-rose-600 dark:text-rose-400"
                          >
                            Reset
                          </button>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                            Status
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {activeStatusOpts.map((o) => (
                              <Chip
                                key={o.key}
                                active={statusFilter === o.key}
                                onClick={() => setStatusFilter(o.key)}
                                count={o.count ? filterCounts[o.count] : undefined}
                              >
                                {o.label}
                              </Chip>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                            Date
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {TIME_OPTS.map((o) => (
                              <Chip
                                key={o.key}
                                active={timeFilter === o.key}
                                onClick={() => handlePresetTime(o.key)}
                              >
                                {o.label}
                              </Chip>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => setShowFilterMenu(false)}
                          className="w-full py-2.5 rounded-xl bg-[#2f4e56] text-white text-sm font-bold"
                        >
                          Show {list.length} item{list.length === 1 ? '' : 's'}
                        </button>
                      </div>
                    </div>,
                    document.body
                  )}
              </div>
            );
          })()}

          {/* ── Ticket Cards Grid ── */}
          {loading ? (
            <p className="text-center text-sm text-slate-400 py-14">Loading…</p>
          ) : list.length === 0 ? (
            <div className="text-center py-12 px-6 bg-white/85 dark:bg-[#15171a] rounded-2xl border border-[#c3d2ce] dark:border-[#2a2e35] border-dashed my-auto">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-[#eef3f1] dark:bg-white/10 flex items-center justify-center mb-3">
                <Inbox className="w-6 h-6 text-[#7f999f] dark:text-slate-300" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                {activeFilterCount > 0 || q ? 'No matching items found' : 'Nothing here yet'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                {activeFilterCount > 0 || q
                  ? 'Try adjusting your search or clearing the active filters.'
                  : tab === 'Mine'
                  ? 'Report a maintenance issue and track live technician updates here.'
                  : tab === 'LostFound'
                  ? 'Lost or found something on campus? Post it here so everyone can see it.'
                  : 'Shared public issues reported across campus will appear here.'}
              </p>
              {activeFilterCount > 0 || q ? (
                <button
                  onClick={() => {
                    resetAllFilters();
                    setShowCustomDate(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2f4e56] hover:bg-[#243d43] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Clear filters
                </button>
              ) : (
                <button
                  onClick={() => (tab === 'LostFound' ? setLf(true) : setReport(true))}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2f4e56] hover:bg-[#243d43] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{tab === 'LostFound' ? 'Post Lost / Found Item' : 'Report an Issue'}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto -mx-1 px-1 custom-ticket-scrollbar lg:overscroll-contain">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pb-2">
                {list.map((t) => {
                  const isMyTicket =
                    (myUid && (t.userId === myUid || t.owner_id === myUid || t.clerk_id === myUid)) ||
                    (myEmail && (t.userEmail || '').toLowerCase() === myEmail);
                  const hasJoined =
                    Array.isArray(t.upvotedBy) && myUid && t.upvotedBy.includes(myUid);

                  let actionBtn = null;
                  if (isLostFound(t)) {
                    const lost = isLostPost(t);
                    actionBtn = (
                      <span className="inline-flex items-center gap-1.5 pl-1 text-xs font-semibold text-[#2f4e56] dark:text-[#c1c6cf]">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>
                          {isMyTicket
                            ? 'Your post · replies appear in chat'
                            : lost
                            ? 'Seen this item? Message the owner in chat'
                            : 'Is this yours? Claim it in chat'}
                        </span>
                      </span>
                    );
                  } else if (tab === 'Community' || t.isPublic) {
                    if (isMyTicket) {
                      actionBtn = (
                        <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold text-[#2f4e56] dark:text-[#c1c6cf] bg-[#eaf1ef] dark:bg-[#1d2024] border border-[#d3dfdc] dark:border-[#2a2e35] rounded-full">
                          Your report
                        </span>
                      );
                    } else if (hasJoined) {
                      actionBtn = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-full">
                          ✓ Affected ({t.upvotes || 1})
                        </span>
                      );
                    } else {
                      actionBtn = (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            meToo(t);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-bold text-white bg-[#2f4e56] hover:bg-[#1e353b] dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded-full transition-all shadow-xs cursor-pointer active:scale-95"
                          title="Also facing this issue? Upvote instead of filing a duplicate ticket"
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
                      unassignedLabel="Awaiting Technician"
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
            const isMyTicket =
              (myUid && (open.userId === myUid || open.owner_id === myUid || open.clerk_id === myUid)) ||
              (myEmail && (open.userEmail || '').toLowerCase() === myEmail);
            const hasJoined =
              Array.isArray(open.upvotedBy) && myUid && open.upvotedBy.includes(myUid);
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
                  ✓ Affected ({open.upvotes || 1})
                </span>
              );
            }
            return (
              <button
                type="button"
                onClick={async () => {
                  await meToo(open);
                  setOpen((o) =>
                    o
                      ? {
                          ...o,
                          upvotes: (o.upvotes || 1) + 1,
                          upvotedBy: [...(o.upvotedBy || []), myUid],
                        }
                      : o
                  );
                }}
                className="px-3 py-1.5 bg-[#2f4e56] hover:bg-[#1e353b] text-white text-xs font-bold rounded-xl transition-colors"
              >
                👍 Me too ({open.upvotes || 1})
              </button>
            );
          })()}
        />
      )}

      {report && (
        <ReportModal
          initial={typeof report === 'object' ? report : null}
          sharedOnly={tab === 'Community'}
          onClose={() => setReport(false)}
          onCreated={(created) => setTab(tab === 'Community' && created?.isPublic !== false ? 'Community' : 'Mine')}
        />
      )}
      {lf && (
        <LostFoundModal
          onClose={() => setLf(false)}
          onCreated={() => setTab('LostFound')}
        />
      )}
    </div>
  );
}
