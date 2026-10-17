import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, UserPlus } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { deptForTicket, staffMatchesTicket, roleTitleFor } from '../../lib/departments.js';

const st = t => (t?.status || '').toLowerCase().trim();
const isResolved = t => ['resolved', 'done', 'fixed'].includes(st(t));

/**
 * Admin "Assign" / "Reassign" button with a floating staff list.
 * Used on ticket cards and inside the ticket details drawer.
 */
export default function AssignMenu({ ticket: t, techs = [], onAssigned }) {
  const { api, showToast } = useApp();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => { window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true); };
  }, [open]);

  if (!t || isResolved(t)) return null;

  const assigned = Boolean(t.assignedTo || t.assigned_to);
  const current = t.assignedTo || t.assigned_to;
  const onDuty = techs.filter(x => !x.status || x.status === 'On Duty');
  const want = deptForTicket(t);
  const best = onDuty.filter(x => staffMatchesTicket(x, t));
  const rest = onDuty.filter(x => !staffMatchesTicket(x, t));

  async function assign(tech) {
    const tid = tech.firebaseId || tech.clerk_id || tech.id;
    const name = tech.name || tech.full_name || 'staff';
    setOpen(false);
    try {
      await api.assignTicket(t.id, tid, name);
      showToast(`Assigned to ${name}.`, 'success');
      onAssigned?.({ assignedTo: tid, assigned_to: tid, assignedToName: name, assignedToEmail: tech.email });
    } catch (e) { showToast(e.message || 'Assign failed', 'error'); }
  }

  const row = tech => {
    const tid = tech.firebaseId || tech.clerk_id || tech.id;
    const isNow = tid === current;
    return (
      <button key={tid} type="button" disabled={isNow} onClick={e => { e.stopPropagation(); assign(tech); }}
        className={`w-full text-left px-2.5 py-1.5 rounded-lg flex flex-col ${isNow ? 'opacity-50 cursor-default' : 'hover:bg-[#eef3f1] dark:hover:bg-[#1b1d21]'}`}>
        <span className="text-[12.5px] font-bold text-slate-800 dark:text-slate-100 truncate">{tech.name || tech.full_name || 'Staff'}{isNow ? ' · current' : ''}</span>
        <span className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">{roleTitleFor(tech.dept)} · {tech.dept || 'Staff'}</span>
      </button>
    );
  };
  const label = txt => <p className="px-2.5 pt-1.5 pb-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 truncate">{txt}</p>;

  return (
    <div className="relative shrink-0">
      <button type="button" aria-expanded={open}
        onClick={e => { e.stopPropagation(); setAnchor(e.currentTarget.getBoundingClientRect()); setOpen(o => !o); }}
        title={assigned ? `Reassign (now: ${t.assignedToName || 'assigned'})` : 'Assign to staff'}
        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border shrink-0 ${open ? 'bg-[#2f4e56] text-white border-[#2f4e56]'
          : assigned ? 'border-[#c3d2ce] bg-white text-[#2f4e56] hover:bg-[#eef3f1] dark:bg-[#1d2024] dark:text-[#b9bec9] dark:border-[#2a2e35]'
          : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:bg-amber-400/15 dark:text-amber-200 dark:border-amber-400/30'}`}>
        {assigned ? <><RefreshCw className="w-3.5 h-3.5" /> Reassign</> : <><UserPlus className="w-3.5 h-3.5" /> Assign</>}
      </button>
      {open && anchor && createPortal(
        <>
          <div className="fixed inset-0 z-[1400]" onClick={() => setOpen(false)} />
          <div className="fixed z-[1401] w-64 p-2 rounded-xl border border-slate-200 dark:border-[#2a2e35] bg-white dark:bg-[#15171a] shadow-xl"
            style={{ top: Math.min(anchor.bottom + 6, window.innerHeight - 280), right: Math.max(8, window.innerWidth - anchor.right) }}>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-1 pb-1.5">{assigned ? `Now: ${t.assignedToName || 'assigned'}` : 'Not assigned yet'}</p>
            <div className="max-h-56 overflow-y-auto custom-ticket-scrollbar -mx-1 px-1">
              {best.length > 0 && <>{label(`Handles this · ${want}`)}{best.map(row)}</>}
              {best.length === 0 && want && <p className="px-2.5 py-1 text-[11px] text-amber-700 dark:text-amber-300">No one on duty in {want}</p>}
              {rest.length > 0 && <>{label(best.length ? 'Other staff' : 'On-duty staff')}{rest.map(row)}</>}
              {onDuty.length === 0 && <p className="px-2.5 py-2 text-xs text-slate-500">No staff on duty.</p>}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
