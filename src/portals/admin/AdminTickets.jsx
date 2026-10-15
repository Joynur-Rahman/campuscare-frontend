import { useMemo, useState } from 'react';
import { CircleCheck, Wrench, Search, X, Inbox, UserX, Siren, ListChecks, Hourglass, Archive, Filter } from 'lucide-react';
import TicketCard from '../../components/TicketCard.jsx';
import CallMenu from '../../components/CallMenu.jsx';
import AssignMenu from '../../components/admin/AssignMenu.jsx';
import { createdMs, isLostFound } from '../../lib/ticketUtils.js';
import { roleTitleFor } from '../../lib/departments.js';

const norm = s => (s?.status || '').toLowerCase().trim();
const isResolved = t => ['resolved', 'done', 'fixed'].includes(norm(t));
const isInProgress = t => ['in progress', 'in_progress'].includes(norm(t));
const isPending = t => (t?.assignedTo || t?.assigned_to) && ['pending', 'assigned', 'submitted'].includes(norm(t));
const isUnassigned = t => !t?.assignedTo && !t?.assigned_to && !isResolved(t) && !isLostFound(t);
const isUrgent = t => !isResolved(t) && (t?.priority === 'High' || t?.urgent || t?.status === 'escalated');

const FILTERS = [
  { key: 'all', label: 'All open', test: t => !isResolved(t), Icon: ListChecks, tone: 'text-slate-600 bg-slate-100 dark:text-slate-200 dark:bg-white/10' },
  { key: 'unassigned', label: 'Not assigned', test: isUnassigned, Icon: UserX, tone: 'text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-400/15' },
  { key: 'started', label: 'Not started', test: isPending, Icon: Hourglass, tone: 'text-violet-600 bg-violet-50 dark:text-violet-300 dark:bg-violet-400/15' },
  { key: 'progress', label: 'Being fixed', test: isInProgress, Icon: Wrench, tone: 'text-sky-600 bg-sky-50 dark:text-sky-300 dark:bg-sky-400/15' },
  { key: 'urgent', label: 'Urgent', test: isUrgent, Icon: Siren, tone: 'text-rose-600 bg-rose-50 dark:text-rose-300 dark:bg-rose-400/15' },
  { key: 'resolved', label: 'Fixed', test: isResolved, Icon: CircleCheck, tone: 'text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-400/15' },
];

const CATEGORIES = [
  { key: 'all', label: 'All categories' },
  { key: 'water', label: '💧 Water & Plumbing' },
  { key: 'it', label: '💻 IT & Network' },
  { key: 'electrical', label: '⚡ Electrical' },
  { key: 'security', label: '🛡️ Security & Safety' },
  { key: 'lost', label: '🔍 Lost & Found' },
];

const SORTS = [
  { key: 'urgent', label: 'Urgent first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'newest', label: 'Newest first' },
];

export default function AdminTickets({ tickets, techs, onOpen, initialFilter = 'all' }) {
  const [filter, setFilter] = useState(initialFilter);
  const [catFilter, setCatFilter] = useState('all');
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState('urgent');
  const EVERYTHING = { key: 'everything', label: 'All tickets', test: () => true };
  const f = filter === 'everything' ? EVERYTHING : (FILTERS.find(x => x.key === filter) || FILTERS[0]);

  const techOf = (t) => {
    const id = t.assignedTo || t.assigned_to;
    return techs.find(x => [x.firebaseId, x.clerk_id, x.id, x.uid].includes(id))
      || techs.find(x => x.email && x.email.toLowerCase() === (t.assignedToEmail || '').toLowerCase());
  };

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const out = tickets
      .filter(f.test)
      .filter(t => {
        if (catFilter === 'all') return true;
        if (catFilter === 'lost') return isLostFound(t);
        const hay = `${t.category || ''} ${t.categoryDisplay || ''} ${t.title || ''} ${t.subCategory || ''}`.toLowerCase();
        return hay.includes(catFilter);
      })
      .filter(t => !s || `${t.id} ${t.categoryDisplay || ''} ${t.title || ''} ${t.description || ''} ${t.location || ''} ${t.assignedToName || ''} ${t.userName || ''}`.toLowerCase().includes(s));

    out.sort((a, b) => {
      if (sortBy === 'urgent' && isUrgent(a) !== isUrgent(b)) return isUrgent(b) - isUrgent(a);
      return sortBy === 'newest' ? createdMs(b) - createdMs(a) : createdMs(a) - createdMs(b);
    });
    return out;
  }, [tickets, f, catFilter, q, sortBy]);

  const reassignFor = (t) => {
    if (isLostFound(t)) return null;
    return <AssignMenu ticket={t} techs={techs} />;
  };

  const callFor = (t) => {
    const tech = techOf(t);
    return (
      <CallMenu contacts={[
        ...(isLostFound(t) ? [] : [
          tech || t.assignedToName
            ? { who: roleTitleFor(tech?.dept) === 'Staff' ? 'Assigned staff' : roleTitleFor(tech?.dept), name: tech?.name || t.assignedToName, phone: tech?.phone || t.assignedToPhone || '' }
            : { who: 'Assigned staff', name: '', phone: '', missing: 'Not assigned yet' }
        ]),
        { who: 'Reporter', name: t.userName || 'Campus User', phone: t.userPhone || t.phone || '' },
      ]} />
    );
  };

  const actionFor = (t) => {
    if (!isLostFound(t)) return null;
    const isLost = /\[lost\]/i.test(`${t.title || ''} ${t.description || ''}`);
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100/70 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 text-xs font-bold border border-amber-200/80 dark:border-amber-800/60">
        <Archive className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        <span>{isLost ? 'Community Lost Notice · Security Desk' : 'Community Found Item · Security Desk'}</span>
      </span>
    );
  };

  return (
    <div className="space-y-2.5 lg:space-y-0 lg:gap-2.5 lg:flex lg:flex-col lg:h-full lg:min-h-0">
      {/* Compact Status Filter Cards */}
      <div className="shrink-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {FILTERS.map(x => {
          const on = filter === x.key;
          const n = tickets.filter(x.test).length;
          return (
            <button key={x.key} type="button" onClick={() => setFilter(x.key)} aria-pressed={on}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition cursor-pointer ${on ? 'bg-[#2f4e56] border-[#2f4e56] text-white shadow-sm dark:bg-[#2a2e35] dark:border-[#6366f1]' : 'bg-white/90 border-[#d3dfdc] hover:bg-white hover:border-[#9fbcbf] dark:bg-[#15171a] dark:border-[#2a2e35] dark:hover:bg-[#1b1d21]'}`}>
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${on ? 'bg-white/15 text-white' : x.tone}`}><x.Icon className="w-3.5 h-3.5" /></span>
              <span className={`flex-1 min-w-0 text-xs font-bold truncate ${on ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>{x.label}</span>
              <span className={`text-base font-extrabold leading-none ${on ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* List Panel */}
      <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-2.5 rounded-2xl sm:rounded-3xl p-2.5 sm:p-4 bg-[#d3dfdc]/80 backdrop-blur-sm dark:bg-[#101214]/90 border border-[#c3d2ce] dark:border-[#2a2e35]">
        <div className="shrink-0 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[12rem]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search ID, problem, place, student or technician…"
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl border border-[#d6ded7] dark:border-[#2a2e35] bg-white dark:bg-[#121417] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2f4e56]/20" />
            {q && <button onClick={() => setQ('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>}
          </div>

          {/* Category / Department Filter Dropdown */}
          <div className="relative flex items-center">
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)} aria-label="Filter by category"
              className="pl-8 pr-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-[#d6ded7] dark:border-[#2a2e35] bg-white dark:bg-[#121417] text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer">
              {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>

          <select value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort tickets"
            className="text-xs sm:text-sm font-semibold px-3 py-2 rounded-xl border border-[#d6ded7] dark:border-[#2a2e35] bg-white dark:bg-[#121417] text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer">
            {SORTS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>

          {filter === 'everything' && (
            <button type="button" onClick={() => setFilter('all')} className="inline-flex items-center gap-1 text-xs font-bold text-[#2f4e56] dark:text-slate-100 bg-[#2f4e56]/10 dark:bg-white/10 rounded-full pl-2.5 pr-1.5 py-1">
              All tickets incl. fixed <X className="w-3 h-3" />
            </button>
          )}
          <span className="text-xs font-bold text-slate-600 dark:text-slate-200 bg-white/80 dark:bg-white/10 border border-[#c3d2ce] dark:border-[#2a2e35] rounded-full px-3 py-1">
            {list.length} shown
          </span>
        </div>

        {list.length === 0 ? (
          <div className="lg:flex-1 flex flex-col items-center justify-center text-center py-14 px-6 bg-white/80 dark:bg-[#15171a] rounded-2xl border border-[#c3d2ce] dark:border-[#2a2e35] border-dashed">
            {q || catFilter !== 'all' ? <Inbox className="w-10 h-10 text-[#7f999f] mb-2" /> : <CircleCheck className="w-10 h-10 text-emerald-400 mb-2" />}
            <p className="text-sm font-bold text-slate-700 dark:text-slate-100">{q || catFilter !== 'all' ? 'No tickets match your filters' : 'All clear'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{q || catFilter !== 'all' ? 'Try resetting your category or search query.' : 'No tickets in this filter.'}</p>
          </div>
        ) : (
          <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto -mx-2 px-2 -mt-1 pt-1 pb-6 custom-ticket-scrollbar lg:overscroll-contain">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pb-1.5">
              {list.map(t => (
                <TicketCard
                  key={t.id}
                  t={t}
                  onOpen={onOpen}
                  canRate={false}
                  action={actionFor(t)}
                  headerAction={<div className="flex flex-nowrap items-center gap-1.5">{reassignFor(t)}{callFor(t)}</div>}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
