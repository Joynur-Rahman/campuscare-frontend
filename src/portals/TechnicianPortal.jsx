import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Inbox, Wrench, CheckCircle2, Loader2, Coffee, AlertCircle, X, Power,
  Search, MapPin, SlidersHorizontal, Flame, Sparkles, Camera, Package,
  Building, Layers, RotateCcw, ImageIcon, Trash2, ArrowUpDown
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { useSubscription } from '../hooks/useSubscription.js';
import TicketCard from '../components/TicketCard.jsx';
import TicketDetailModal from '../components/TicketDetailModal.jsx';

const TABS = [
  {
    key: 'New',
    label: 'New',
    status: 'Pending',
    Icon: Inbox,
    color: 'text-amber-500 dark:text-amber-400',
    activeClass: 'bg-amber-500 text-slate-950 dark:bg-amber-400 dark:text-slate-950 shadow-md shadow-amber-500/25 ring-1 ring-amber-300 dark:ring-amber-500/60 font-extrabold',
    activeBadge: 'bg-slate-950 text-amber-300',
    inactiveBadge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/35',
  },
  {
    key: 'Working',
    label: 'Working on',
    status: 'In Progress',
    Icon: Wrench,
    color: 'text-blue-500 dark:text-blue-400',
    activeClass: 'bg-blue-600 text-white dark:bg-blue-500 dark:text-white shadow-md shadow-blue-500/30 ring-1 ring-blue-400/50 font-extrabold',
    activeBadge: 'bg-white text-blue-700',
    inactiveBadge: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/35',
  },
  {
    key: 'Done',
    label: 'Done',
    status: 'Resolved',
    Icon: CheckCircle2,
    color: 'text-emerald-500 dark:text-emerald-400',
    activeClass: 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white shadow-md shadow-emerald-500/30 ring-1 ring-emerald-400/50 font-extrabold',
    activeBadge: 'bg-white text-emerald-700',
    inactiveBadge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/35',
  },
];

// Campus building parser for smart location route clustering
function parseBuilding(loc) {
  if (!loc) return 'Other Campus Locations';
  const clean = String(loc).trim();
  const lower = clean.toLowerCase();
  if (lower.includes('boys hostel')) return 'Boys Hostel';
  if (lower.includes('girls hostel')) return 'Girls Hostel';
  if (lower.includes('library')) return 'Central Library';
  if (lower.includes('lecture hall')) return 'Lecture Hall Complex';
  if (lower.includes('academic')) return 'Academic Complex';
  if (lower.includes('canteen') || lower.includes('cafeteria') || lower.includes('mess')) return 'Mess & Canteen';
  if (lower.includes('admin block') || lower.includes('director')) return 'Admin Block';
  const parts = clean.split(/[—\-]/);
  return parts[0].trim() || 'Campus General';
}

// Preset resolution templates for 1-click logging
const PRESET_REMARKS = [
  'Swapped faulty component and verified operation under load.',
  'Replaced cable, network signal and latency tested normal.',
  'Recalibrated mechanism, lubricated fittings, tested with student.',
  'Tightened connections, isolated fault, verified safe.',
  'Temporary fix applied, full replacement part requested from store.',
];

// Common campus maintenance spare parts
const COMMON_PARTS = [
  'Anchor Fan Regulator',
  'Cat6 Patch Cable (2m)',
  '10A Modular Switch',
  'RJ45 Keystone Jack',
  'Teflon Tape / Washer',
  'Drawer Lock & Key',
];


export default function TechnicianPortal() {
  const { api, user, showToast } = useApp();
  const [tab, setTab] = useState('New');
  const [open, setOpen] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // Search, Location & Sort Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('all');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [urgentFirst, setUrgentFirst] = useState(true);
  const [groupByBuilding, setGroupByBuilding] = useState(false);

  // Duty status state
  const [dutyStatus, setDutyStatus] = useState(user?.status || 'On Duty');
  const [togglingDuty, setTogglingDuty] = useState(false);

  useEffect(() => {
    if (user?.status) {
      setDutyStatus(user.status);
    }
  }, [user?.status]);

  // Enhanced Resolution Modal state
  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolutionRemarks, setResolutionRemarks] = useState('');
  const [selectedParts, setSelectedParts] = useState([]);
  const [customPartInput, setCustomPartInput] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [resolving, setResolving] = useState(false);
  const fileInputRef = useRef(null);

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

  // Urgent pending count
  const urgentCount = useMemo(() => {
    return mine.filter(t => !isDone(t) && (t.priority === 'High' || t.priority === 'Urgent')).length;
  }, [mine]);

  // Alert on incoming urgent tickets
  const prevUrgentCountRef = useRef(urgentCount);
  useEffect(() => {
    if (urgentCount > prevUrgentCountRef.current && dutyStatus === 'On Duty') {
      showToast('⚠️ New High Priority complaint assigned to your work desk!', 'warning');
    }
    prevUrgentCountRef.current = urgentCount;
  }, [urgentCount, dutyStatus, showToast]);

  // Today's completion rate calculation
  const totalShiftTickets = counts.New + counts.Working + counts.Done;
  const completionRate = totalShiftTickets > 0 ? Math.round((counts.Done / totalShiftTickets) * 100) : 0;

  // Base list for active tab
  const tabList = useMemo(() => {
    return mine.filter(t => tab === 'New' ? isNew(t) : tab === 'Working' ? isWorking(t) : isDone(t));
  }, [mine, tab]);

  // Extract unique buildings for quick cluster pills
  const availableBuildings = useMemo(() => {
    const map = {};
    tabList.forEach(t => {
      const b = parseBuilding(t.location);
      map[b] = (map[b] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [tabList]);

  // Filter and sort tickets
  const filteredList = useMemo(() => {
    let result = [...tabList];

    // 1. Search Query filter (ID, location/room, issue text)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(t => 
        (t.id && t.id.toLowerCase().includes(q)) ||
        (t.location && t.location.toLowerCase().includes(q)) ||
        (t.categoryDisplay && t.categoryDisplay.toLowerCase().includes(q)) ||
        (t.category && t.category.toLowerCase().includes(q)) ||
        (t.subCategory && t.subCategory.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q))
      );
    }

    // 2. Building Filter
    if (buildingFilter !== 'all') {
      result = result.filter(t => parseBuilding(t.location) === buildingFilter);
    }

    // 3. Urgent Only filter
    if (urgentOnly) {
      result = result.filter(t => t.priority === 'High' || t.priority === 'Urgent');
    }

    // 4. Sorting: Urgent First
    if (urgentFirst) {
      result.sort((a, b) => {
        const aUrgent = a.priority === 'High' || a.priority === 'Urgent' ? 1 : 0;
        const bUrgent = b.priority === 'High' || b.priority === 'Urgent' ? 1 : 0;
        return bUrgent - aUrgent;
      });
    }

    return result;
  }, [tabList, searchQuery, buildingFilter, urgentOnly, urgentFirst]);

  // Grouped by building map for Route View
  const groupedTickets = useMemo(() => {
    if (!groupByBuilding) return null;
    const groups = {};
    filteredList.forEach(t => {
      const b = parseBuilding(t.location);
      if (!groups[b]) groups[b] = [];
      groups[b].push(t);
    });
    return groups;
  }, [filteredList, groupByBuilding]);

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

  const handleStartWork = async (t) => {
    setBusyId(t.id);
    try {
      await api.acknowledgeTicket(t.id, uid, user?.name || user?.full_name);
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
    setResolutionRemarks('Swapped faulty component and verified operation under load.');
    setSelectedParts([]);
    setCustomPartInput('');
    setPhotoPreview(null);
  };

  const handleAddPart = (part) => {
    if (!selectedParts.includes(part)) {
      setSelectedParts(p => [...p, part]);
    }
  };

  const handleRemovePart = (part) => {
    setSelectedParts(p => p.filter(x => x !== part));
  };

  const handleAddCustomPart = (e) => {
    e.preventDefault();
    const p = customPartInput.trim();
    if (p && !selectedParts.includes(p)) {
      setSelectedParts(parts => [...parts, p]);
      setCustomPartInput('');
    }
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoPreview(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmResolve = async (e) => {
    e?.preventDefault();
    if (!resolveTarget) return;
    setResolving(true);
    try {
      let finalRemarks = resolutionRemarks.trim() || 'Resolved by technician';
      if (selectedParts.length > 0) {
        finalRemarks += ` | Materials/Parts Used: ${selectedParts.join(', ')}`;
      }
      await api.resolveTicket(resolveTarget.id, finalRemarks, photoPreview || null, selectedParts);
      setOptimisticStatus(prev => ({ ...prev, [resolveTarget.id]: 'resolved' }));
      showToast('Ticket marked as fixed and resolved!', 'success');
      setTab('Done');
      if (open && open.id === resolveTarget.id) {
        setOpen(prev => ({ ...prev, status: 'resolved' }));
      }
      setResolveTarget(null);
      setResolutionRemarks('');
      setSelectedParts([]);
      setPhotoPreview(null);
    } catch (e) {
      showToast(e.message || 'Failed to resolve ticket', 'error');
    } finally {
      setResolving(false);
    }
  };

  const renderAction = (t, inModal = false) => {
    const btnCls = inModal
      ? "inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-white rounded-lg disabled:opacity-60 transition-all shadow-2xs active:scale-95 cursor-pointer shrink-0"
      : "inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:py-2 text-xs font-bold text-white rounded-xl disabled:opacity-60 transition-all shadow-sm active:scale-95 cursor-pointer shrink-0";

    if (isNew(t)) {
      return (
        <button
          disabled={busyId === t.id}
          onClick={(e) => { e.stopPropagation(); handleStartWork(t); }}
          className={`${btnCls} bg-iiitg-800 hover:bg-iiitg-900`}
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
          className={`${btnCls} bg-emerald-600 hover:bg-emerald-700`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" /> Mark as fixed
        </button>
      );
    }
    return null;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* ── Top Header Bar (Sleek & Clean) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-white dark:bg-[#141f33] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Work Desk</h1>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border transition-colors ${
              dutyStatus === 'On Duty'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${dutyStatus === 'On Duty' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            {dutyStatus}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden md:inline">
            • Shift: <strong className="text-slate-900 dark:text-slate-200">{counts.Done}/{totalShiftTickets}</strong> resolved ({completionRate}%)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {urgentCount > 0 && (
            <button
              onClick={() => { setUrgentOnly(u => !u); setTab('New'); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer ${
                urgentOnly
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100'
              }`}
              title="Toggle Urgent Only"
            >
              <Flame className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
              <span>{urgentCount} Urgent</span>
            </button>
          )}

          <button
            disabled={togglingDuty}
            onClick={handleToggleDuty}
            className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs disabled:opacity-60 shrink-0 cursor-pointer ${
              dutyStatus === 'On Duty'
                ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
            }`}
          >
            {togglingDuty ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
            {dutyStatus === 'On Duty' ? 'Go Off Duty' : 'Go On Duty'}
          </button>
        </div>
      </div>

      {/* ── Unified Tab Navigation & Filter Toolbar ── */}
      <div className="bg-white dark:bg-[#141f33] p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          {/* Segmented Pill Tabs with High-Contrast Active Colors */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900/90 rounded-xl overflow-x-auto border border-slate-200/80 dark:border-slate-800">
            {TABS.map(t => {
              const active = tab === t.key;
              const count = counts[t.key];
              const hasUrgent = t.key === 'New' && urgentCount > 0;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    active
                      ? t.activeClass
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <t.Icon className={`w-3.5 h-3.5 ${active ? '' : t.color}`} />
                  <span>{t.label}</span>
                  <span className={`w-5 h-5 min-w-[20px] rounded-full text-[11px] font-black flex items-center justify-center shrink-0 shadow-2xs transition-colors ${
                    active
                      ? t.activeBadge
                      : t.inactiveBadge
                  }`}>
                    {count}
                  </span>
                  {hasUrgent && (
                    <span className={`w-2 h-2 rounded-full ${active ? 'bg-rose-600 ring-2 ring-white/60' : 'bg-rose-500'} animate-pulse`} title={`${urgentCount} urgent`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Filter Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Building Location Filter Dropdown */}
            <div className="relative">
              <select
                value={buildingFilter}
                onChange={e => setBuildingFilter(e.target.value)}
                className="appearance-none pl-7 pr-8 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-iiitg-800 cursor-pointer"
              >
                <option value="all">📍 All Locations ({tabList.length})</option>
                {availableBuildings.map(b => (
                  <option key={b.name} value={b.name}>{b.name} ({b.count})</option>
                ))}
              </select>
              <Building className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Route View Toggle */}
            <button
              type="button"
              onClick={() => setGroupByBuilding(g => !g)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                groupByBuilding
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm dark:bg-indigo-500 dark:text-white dark:border-indigo-500'
                  : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Organize by Campus Building Routes"
            >
              <Layers className={`w-3.5 h-3.5 ${groupByBuilding ? 'text-white' : 'text-indigo-500'}`} />
              <span>Route View</span>
            </button>

            {/* Urgent First Toggle */}
            <button
              type="button"
              onClick={() => setUrgentFirst(u => !u)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                urgentFirst
                  ? 'bg-amber-500 text-slate-950 font-extrabold border-amber-500 shadow-sm dark:bg-amber-400 dark:text-slate-950 dark:border-amber-400'
                  : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Sort urgent complaints to the top"
            >
              <ArrowUpDown className={`w-3.5 h-3.5 ${urgentFirst ? 'text-slate-950' : 'text-amber-500'}`} />
              <span>Urgent First</span>
            </button>

            {(buildingFilter !== 'all' || urgentOnly || searchQuery) && (
              <button
                onClick={() => { setBuildingFilter('all'); setUrgentOnly(false); setSearchQuery(''); }}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1 px-1 transition-colors cursor-pointer"
                title="Reset filters"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by ticket ID, room number, or issue keyword…"
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-iiitg-800 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Tickets Feed ── */}
      {loading ? (
        <div className="text-center py-16">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-iiitg-800 dark:text-indigo-400" />
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-2">Syncing campus complaints…</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="text-center py-14 px-6 bg-white dark:bg-[#141f33] rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-3">
            <Coffee className="w-7 h-7 text-slate-300 dark:text-slate-600" />
          </div>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No tickets found in this view</p>
          <p className="text-xs text-slate-400 mt-1">
            {searchQuery || buildingFilter !== 'all' || urgentOnly
              ? 'Try adjusting your search query or building filters.'
              : tab === 'New'
                ? 'New tickets assigned to you will appear here.'
                : tab === 'Working'
                  ? 'Tickets you have started will appear here.'
                  : 'Completed tickets will appear here.'}
          </p>
        </div>
      ) : groupByBuilding && groupedTickets ? (
        // ── Group by Building Route View ──
        <div className="space-y-6">
          {Object.entries(groupedTickets).map(([bld, tickets]) => (
            <div key={bld} className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-200 dark:border-slate-800">
                <MapPin className="w-4 h-4 text-iiitg-700 dark:text-indigo-400" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                  {bld}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 ml-1">
                  {tickets.length} task{tickets.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                {tickets.map(t => (
                  <TicketCard key={t.id} t={t} onOpen={setOpen} action={renderAction(t)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // ── Standard Grid View ──
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {filteredList.map(t => (
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

      {/* ── Enhanced Resolution & Proof of Work Modal ── */}
      {resolveTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm" onClick={() => setResolveTarget(null)}>
          <div className="bg-white dark:bg-[#141f33] rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[92vh] overflow-y-auto filter-scrollbar border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Mark Work as Finished</h3>
              </div>
              <button onClick={() => setResolveTarget(null)} className="modal-x"><X className="w-5 h-5" /></button>
            </div>

            {/* Target Ticket Context */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-bold text-iiitg-700 dark:text-indigo-400">{resolveTarget.id}</span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">({resolveTarget.location})</span>
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{resolveTarget.title || resolveTarget.categoryDisplay}</p>
            </div>

            <form onSubmit={handleConfirmResolve} className="space-y-4">
              {/* 1. Preset Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  1-Click Resolution Templates:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_REMARKS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setResolutionRemarks(preset)}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-700 dark:hover:text-emerald-300 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors text-left"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Textarea */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Resolution Summary / Remarks:
                </label>
                <textarea
                  rows={3}
                  value={resolutionRemarks}
                  onChange={e => setResolutionRemarks(e.target.value)}
                  placeholder="Describe the action taken (e.g. replaced parts, verified working)..."
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none font-normal"
                />
              </div>

              {/* 3. Spare Parts & Materials Consumed */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-slate-400" /> Spare Parts / Materials Used:
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {COMMON_PARTS.map(part => {
                    const isPicked = selectedParts.includes(part);
                    return (
                      <button
                        key={part}
                        type="button"
                        onClick={() => isPicked ? handleRemovePart(part) : handleAddPart(part)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                          isPicked
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 shadow-2xs'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {isPicked ? '✓ ' : '+ '}
                        {part}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Part Input */}
                <div className="flex items-center gap-2">
                  <input
                    value={customPartInput}
                    onChange={e => setCustomPartInput(e.target.value)}
                    placeholder="Other part name (e.g. 1x Ball Bearing)..."
                    className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomPart}
                    disabled={!customPartInput.trim()}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 disabled:opacity-50 transition"
                  >
                    Add
                  </button>
                </div>

                {selectedParts.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedParts.map(p => (
                      <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        {p}
                        <button type="button" onClick={() => handleRemovePart(p)} className="hover:text-rose-600"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. Proof of Fix / Photo Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-slate-400" /> Proof of Fix (Optional Photo):
                </label>
                {photoPreview ? (
                  <div className="relative inline-block rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700">
                    <img src={photoPreview} alt="Work Proof" className="w-32 h-24 object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotoPreview(null)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-slate-900/80 text-white hover:bg-rose-600 transition"
                      title="Remove Photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition cursor-pointer"
                    >
                      <ImageIcon className="w-4 h-4 text-emerald-600" />
                      Attach / Snap Completion Photo
                    </button>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setResolveTarget(null)}
                  disabled={resolving}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-60 shadow-sm transition active:scale-95 cursor-pointer"
                >
                  {resolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Confirm & Resolve Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
