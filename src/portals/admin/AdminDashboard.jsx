import { useState, useMemo } from 'react';
import { Ticket, Clock, CircleCheck, UserCog, Flame, Star, ArrowUpRight, RotateCcw } from 'lucide-react';
import { StatTile } from '../../components/admin/Bits.jsx';
import { summary } from '../../lib/adminMetrics.js';
import CampusMapView from '../../components/CampusMapView.jsx';

const isResolved = t => ['resolved', 'done', 'fixed'].includes((t?.status || '').toLowerCase().trim());
const isUnassigned = t => !t?.assignedTo && !t?.assigned_to && !isResolved(t);
const isUrgent = t => !isResolved(t) && (t?.priority === 'High' || t?.urgent || t?.status === 'escalated');

export default function AdminDashboard({ tickets = [], techs = [], onOpen, onGo }) {
  const s = summary(tickets);
  const [kpiFilter, setKpiFilter] = useState('everything'); // 'everything' | 'all' | 'unassigned' | 'urgent' | 'resolved'

  const onDutyCount = useMemo(
    () => (techs || []).filter(t => !t.status || t.status === 'On Duty').length,
    [techs]
  );

  const filteredByKpi = useMemo(() => {
    if (kpiFilter === 'all') return tickets.filter(t => !isResolved(t));
    if (kpiFilter === 'unassigned') return tickets.filter(isUnassigned);
    if (kpiFilter === 'urgent') return tickets.filter(isUrgent);
    if (kpiFilter === 'resolved') return tickets.filter(isResolved);
    return tickets;
  }, [tickets, kpiFilter]);

  const toggleKpi = (key) => {
    setKpiFilter(prev => (prev === key ? 'everything' : key));
  };

  return (
    <div className="space-y-2.5 lg:space-y-0 lg:gap-2.5 lg:flex lg:flex-col lg:h-full lg:min-h-0">
      {/* ── Compact Interactive KPI Triage Strip ── */}
      <div className="shrink-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <button
          type="button"
          onClick={() => toggleKpi('everything')}
          className="cc-tile-btn text-left rounded-2xl transition cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2f4e56]"
          title="Show all reported tickets on the map"
        >
          <StatTile
            icon={Ticket}
            label="Reported"
            value={s.reported}
            sub={`${onDutyCount}/${techs.length || 0} staff on duty`}
            active={kpiFilter === 'everything'}
          />
        </button>

        <button
          type="button"
          onClick={() => toggleKpi('all')}
          className="cc-tile-btn text-left rounded-2xl transition cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2f4e56]"
          title="Filter map & queue to open tickets"
        >
          <StatTile
            icon={Clock}
            label="Open now"
            value={s.open}
            color="text-blue-700 dark:text-blue-400"
            sub={s.open > 0 ? 'Active queue' : 'All clear'}
            active={kpiFilter === 'all'}
          />
        </button>

        <button
          type="button"
          onClick={() => toggleKpi('unassigned')}
          className="cc-tile-btn text-left rounded-2xl transition cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2f4e56]"
          title="Filter map & queue to unassigned tickets needing dispatch"
        >
          <StatTile
            icon={UserCog}
            label="Not assigned"
            value={s.unassigned}
            color="text-amber-700 dark:text-amber-400"
            sub={s.unassigned > 0 ? 'Needs dispatch' : 'All assigned'}
            highlight={s.unassigned > 0 ? 'amber' : ''}
            active={kpiFilter === 'unassigned'}
          />
        </button>

        <button
          type="button"
          onClick={() => toggleKpi('urgent')}
          className="cc-tile-btn text-left rounded-2xl transition cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2f4e56]"
          title="Filter map & queue to urgent priority tickets"
        >
          <StatTile
            icon={Flame}
            label="Urgent"
            value={s.urgent}
            color="text-rose-600 dark:text-rose-400"
            sub={s.urgent > 0 ? 'Priority attention' : 'No urgent risk'}
            highlight={s.urgent > 0 ? 'rose' : ''}
            active={kpiFilter === 'urgent'}
          />
        </button>

        <button
          type="button"
          onClick={() => toggleKpi('resolved')}
          className="cc-tile-btn text-left rounded-2xl transition cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2f4e56]"
          title="Filter map & queue to resolved tickets"
        >
          <StatTile
            icon={CircleCheck}
            label="Resolved"
            value={s.fixed}
            color="text-emerald-700 dark:text-emerald-400"
            sub={s.reported ? `${Math.round((s.fixed / s.reported) * 100)}% resolution rate` : 'Completed'}
            active={kpiFilter === 'resolved'}
          />
        </button>

        <button
          type="button"
          onClick={() => onGo?.('reports')}
          className="cc-tile-btn text-left rounded-2xl transition cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2f4e56]"
          title="Open detailed analytics & staff ratings in Reports"
        >
          <StatTile
            icon={Star}
            label="Rating"
            value={s.avgRating ? '★ ' + s.avgRating.toFixed(1) : '–'}
            color="text-amber-600 dark:text-amber-400"
            sub="View analytics →"
          />
        </button>
      </div>

      {/* Active KPI Filter Callout Strip (only shown when filtered) */}
      {kpiFilter !== 'everything' && (
        <div className="shrink-0 flex items-center justify-between gap-2 px-3.5 py-1.5 rounded-xl bg-amber-50/90 dark:bg-slate-800/90 border border-amber-200/80 dark:border-slate-700 text-xs">
          <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
            <span>
              Showing <strong>{filteredByKpi.length}</strong>{' '}
              {kpiFilter === 'unassigned'
                ? 'unassigned tickets needing dispatch'
                : kpiFilter === 'urgent'
                  ? 'urgent tickets'
                  : kpiFilter === 'resolved'
                    ? 'resolved tickets'
                    : 'open tickets'}
            </span>
            <button
              type="button"
              onClick={() => setKpiFilter('everything')}
              className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>
          <button
            type="button"
            onClick={() => onGo?.('tickets', kpiFilter)}
            className="inline-flex items-center gap-1 font-bold text-[#2f4e56] dark:text-indigo-300 hover:underline cursor-pointer"
          >
            <span>Open full list in Tickets</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Live Campus Map + Actionable Triage Queue ── */}
      <div className="lg:flex-1 lg:min-h-0">
        <CampusMapView
          tickets={filteredByKpi}
          techs={techs}
          onSelectTicket={onOpen}
          fill
        />
      </div>
    </div>
  );
}
