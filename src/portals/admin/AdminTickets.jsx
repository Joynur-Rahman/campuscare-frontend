import { useState } from 'react';
import { CircleCheck, Wrench } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import TicketCard from '../../components/TicketCard.jsx';
import { createdMs } from '../../lib/ticketUtils.js';

const isResolved = t => ['resolved', 'done'].includes((t?.status || '').toLowerCase().trim());
const isInProgress = t => ['in progress', 'in_progress'].includes((t?.status || '').toLowerCase().trim());
const isPending = t => (t?.assignedTo || t?.assigned_to) && ['pending', 'assigned', 'submitted'].includes((t?.status || '').toLowerCase().trim());
const isUnassigned = t => !t?.assignedTo && !t?.assigned_to && !isResolved(t);
const isUrgent = t => !isResolved(t) && (t?.priority === 'High' || t?.status === 'escalated');

const FILTERS = [
  { key: 'all', label: 'All open', test: t => !isResolved(t) },
  { key: 'progress', label: 'Being fixed', test: isInProgress },
  { key: 'started', label: 'Not started', test: isPending },
  { key: 'unassigned', label: 'Not assigned', test: isUnassigned },
  { key: 'urgent', label: 'Urgent', test: isUrgent },
  { key: 'resolved', label: 'Fixed / Done', test: isResolved },
];

export default function AdminTickets({ tickets, techs, onOpen }) {
  const { api, showToast } = useApp();
  const [filter, setFilter] = useState('all');
  const onDuty = techs.filter(t => !t.status || t.status === 'On Duty');
  const f = FILTERS.find(x => x.key === filter) || FILTERS[0];
  const list = tickets.filter(f.test).sort((a, b) => createdMs(a) - createdMs(b));

  async function assign(ticket, techId) {
    const tech = techs.find(t => (t.firebaseId || t.clerk_id || t.id) === techId);
    try {
      await api.assignTicket(ticket.id, techId, tech?.name || tech?.full_name);
      showToast(`Assigned to ${tech?.name || tech?.full_name || 'technician'}.`, 'success');
    }
    catch (e) { showToast(e.message || 'Assign failed', 'error'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {FILTERS.map(x => (
          <button key={x.key} onClick={() => setFilter(x.key)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${filter === x.key ? 'bg-iiitg-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            {x.label}<span className="px-1.5 py-0.5 rounded-full bg-black/10 text-[10px]">{tickets.filter(x.test).length}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-2xl border border-slate-200 border-dashed panel">
          <CircleCheck className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">All clear</p>
          <p className="text-xs text-slate-400 mt-1">No tickets in this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {list.map(t => (
            <TicketCard key={t.id} t={t} onOpen={onOpen} action={
              isResolved(t) ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <CircleCheck className="w-3.5 h-3.5" /> Fixed
                </span>
              ) : isInProgress(t) ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg">
                  <Wrench className="w-3.5 h-3.5" /> Working ({t.acknowledged_name || t.assignedToName || 'Staff'})
                </span>
              ) : (
                <select defaultValue="" onChange={e => e.target.value && assign(t, e.target.value)}
                  className="assign-select text-xs px-2.5 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-700">
                  <option value="">{t.assignedTo || t.assigned_to ? `↻ Reassign (${t.assignedToName || 'Assigned'})` : 'Assign technician…'}</option>
                  {onDuty.map(tech => {
                    const tid = tech.firebaseId || tech.clerk_id || tech.id;
                    const tname = tech.name || tech.full_name || 'Staff';
                    const tdept = tech.dept || tech.department || 'Staff';
                    return <option key={tid} value={tid}>{tname} ({tdept})</option>;
                  })}
                </select>
              )
            } />
          ))}
        </div>
      )}
    </div>
  );
}
