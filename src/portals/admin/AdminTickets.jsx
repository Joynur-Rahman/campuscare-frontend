import { useState } from 'react';
import {
  CircleCheck, Wrench, Search, Kanban, Grid3x3, Clock,
  AlertTriangle, Flame, UserCheck, ShieldAlert
} from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import TicketCard from '../../components/TicketCard.jsx';
import { createdMs, ticketLabel } from '../../lib/ticketUtils.js';

const isResolved = t => ['resolved', 'done'].includes((t?.status || '').toLowerCase().trim());
const isInProgress = t => ['in progress', 'in_progress'].includes((t?.status || '').toLowerCase().trim());
const isPending = t => (t?.assignedTo || t?.assigned_to) && ['pending', 'assigned', 'submitted'].includes((t?.status || '').toLowerCase().trim());
const isUnassigned = t => !t?.assignedTo && !t?.assigned_to && !isResolved(t);
const isUrgent = t => !isResolved(t) && (t?.priority === 'High' || t?.status === 'escalated');

const FILTERS = [
  { key: 'all', label: 'All Reported', test: () => true },
  { key: 'open', label: 'Open Now', test: t => !isResolved(t) },
  { key: 'unassigned', label: 'Not assigned', test: isUnassigned },
  { key: 'progress', label: 'Being fixed', test: isInProgress },
  { key: 'started', label: 'Assigned / Waiting', test: isPending },
  { key: 'urgent', label: 'Urgent', test: isUrgent },
  { key: 'resolved', label: 'Fixed / Done', test: isResolved },
];

export default function AdminTickets({
  tickets = [],
  techs = [],
  onOpen,
  activeFilter = 'all',
  onFilterChange
}) {
  const { api, showToast } = useApp();
  const [internalFilter, setInternalFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'kanban'

  const currentFilterKey = onFilterChange ? activeFilter : internalFilter;
  const setFilter = onFilterChange || setInternalFilter;

  const onDuty = techs.filter(t => !t.status || t.status === 'On Duty');
  const f = FILTERS.find(x => x.key === currentFilterKey) || (currentFilterKey === 'reported' ? FILTERS.find(x => x.key === 'all') : null) || FILTERS[0];

  // Search filtering
  const q = query.trim().toLowerCase();
  const matchesQuery = t => {
    if (!q) return true;
    return (
      (t.id && String(t.id).toLowerCase().includes(q)) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.location && t.location.toLowerCase().includes(q)) ||
      (ticketLabel(t) && ticketLabel(t).toLowerCase().includes(q))
    );
  };

  const filteredList = tickets
    .filter(f.test)
    .filter(matchesQuery)
    .sort((a, b) => createdMs(b) - createdMs(a));

  async function assign(ticket, techId) {
    const tech = techs.find(t => (t.firebaseId || t.clerk_id || t.id) === techId);
    try {
      await api.assignTicket(ticket.id, techId, tech?.name || tech?.full_name);
      showToast(`Assigned ticket #${ticket.id} to ${tech?.name || tech?.full_name || 'technician'}.`, 'success');
    } catch (e) {
      showToast(e.message || 'Assignment failed', 'error');
    }
  }

  // Render action control for each ticket
  const renderAction = (t) => {
    if (isResolved(t)) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-lg">
          <CircleCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Fixed
        </span>
      );
    }
    if (isInProgress(t)) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 rounded-lg">
          <Wrench className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Working ({t.acknowledged_name || t.assignedToName || 'Staff'})
        </span>
      );
    }
    return (
      <select
        defaultValue=""
        onChange={e => e.target.value && assign(t, e.target.value)}
        className="assign-select text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <option value="">
          {t.assignedTo || t.assigned_to ? `↻ Reassign (${t.assignedToName || 'Assigned'})` : '⚡ Assign technician…'}
        </option>
        {onDuty.map(tech => {
          const tid = tech.firebaseId || tech.clerk_id || tech.id;
          const tname = tech.name || tech.full_name || 'Staff';
          const tdept = tech.dept || tech.department || 'Staff';
          return <option key={tid} value={tid}>🟢 {tname} ({tdept})</option>;
        })}
      </select>
    );
  };

  // Kanban column buckets
  const unassignedTickets = tickets.filter(isUnassigned).filter(matchesQuery);
  const inProgressTickets = tickets.filter(isInProgress).filter(matchesQuery);
  const resolvedTickets = tickets.filter(isResolved).filter(matchesQuery);

  return (
    <div className="space-y-4">
      {/* ── Command Bar: Filters, Search & View Mode Switcher ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0">
          {FILTERS.map(x => {
            const count = tickets.filter(x.test).length;
            const isActive = currentFilterKey === x.key || (x.key === 'all' && currentFilterKey === 'reported');

            return (
              <button
                key={x.key}
                onClick={() => setFilter(x.key)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-iiitg-800 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <span>{x.label}</span>
                <span
                  className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 leading-none transition-colors ${
                    isActive
                      ? 'bg-white/25 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & View Mode Toggle */}
        <div className="flex items-center gap-2 self-stretch md:self-auto shrink-0">
          <div className="relative flex-1 md:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search ID, room, issue…"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Grid View"
            >
              <Grid3x3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                viewMode === 'kanban'
                  ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Kanban Board View"
            >
              <Kanban className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── View 1: Kanban Board Mode ── */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Column 1: Unassigned */}
          <div className="flex flex-col rounded-2xl bg-slate-100/70 dark:bg-slate-900/40 p-3.5 border border-amber-300/60 dark:border-amber-700/50">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-amber-200/80 dark:border-amber-800/50">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Needs Assignment
                </h4>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                {unassignedTickets.length}
              </span>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-260px)] pr-1">
              {unassignedTickets.map(t => (
                <TicketCard key={t.id} t={t} onOpen={onOpen} action={renderAction(t)} techs={techs} />
              ))}
              {unassignedTickets.length === 0 && (
                <div className="text-center py-10 text-xs text-slate-400 font-medium">
                  Zero tickets awaiting dispatch 🎉
                </div>
              )}
            </div>
          </div>

          {/* Column 2: In Progress */}
          <div className="flex flex-col rounded-2xl bg-slate-100/70 dark:bg-slate-900/40 p-3.5 border border-blue-300/60 dark:border-blue-700/50">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-blue-200/80 dark:border-blue-800/50">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Being Fixed
                </h4>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                {inProgressTickets.length}
              </span>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-260px)] pr-1">
              {inProgressTickets.map(t => (
                <TicketCard key={t.id} t={t} onOpen={onOpen} action={renderAction(t)} techs={techs} />
              ))}
              {inProgressTickets.length === 0 && (
                <div className="text-center py-10 text-xs text-slate-400 font-medium">
                  No tickets currently in progress
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Resolved */}
          <div className="flex flex-col rounded-2xl bg-slate-100/70 dark:bg-slate-900/40 p-3.5 border border-emerald-300/60 dark:border-emerald-700/50">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-emerald-200/80 dark:border-emerald-800/50">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Fixed / Done
                </h4>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                {resolvedTickets.length}
              </span>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-260px)] pr-1">
              {resolvedTickets.map(t => (
                <TicketCard key={t.id} t={t} onOpen={onOpen} action={renderAction(t)} techs={techs} />
              ))}
              {resolvedTickets.length === 0 && (
                <div className="text-center py-10 text-xs text-slate-400 font-medium">
                  No resolved tickets yet
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── View 2: Grid View Mode ── */}
      {viewMode === 'grid' && (
        <>
          {filteredList.length === 0 ? (
            <div className="text-center py-14 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed panel">
              <CircleCheck className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">All clear</p>
              <p className="text-xs text-slate-400 mt-1">No tickets match the selected filter or search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              {filteredList.map(t => (
                <TicketCard key={t.id} t={t} onOpen={onOpen} action={renderAction(t)} techs={techs} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
