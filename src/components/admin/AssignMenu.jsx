import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, UserPlus, X } from 'lucide-react';
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
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClose = (e) => {
      // Don't close when scrolling inside the dropdown list itself
      if (e?.type === 'scroll' && menuRef.current && menuRef.current.contains(e.target)) {
        return;
      }
      setOpen(false);
    };
    window.addEventListener('resize', handleClose);
    window.addEventListener('scroll', handleClose, true);
    return () => {
      window.removeEventListener('resize', handleClose);
      window.removeEventListener('scroll', handleClose, true);
    };
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

  const getPopoverStyle = () => {
    if (!anchor) return {};
    const winW = typeof window !== 'undefined' ? window.innerWidth : 360;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 640;
    const menuW = Math.min(288, winW - 24);

    let left;
    // On mobile or when button is on the left half, align to button left
    if (anchor.left + menuW <= winW - 12) {
      left = anchor.left;
    } else if (anchor.right - menuW >= 12) {
      // If button is on the right, align menu's right edge to button's right edge
      left = anchor.right - menuW;
    } else {
      left = (winW - menuW) / 2;
    }
    // Hard clamp to ensure the container is never pushed off-screen
    left = Math.max(12, Math.min(left, winW - menuW - 12));

    const spaceBelow = winH - anchor.bottom;
    const spaceAbove = anchor.top;
    const preferBelow = spaceBelow >= 220 || spaceBelow >= spaceAbove;

    if (preferBelow) {
      const top = Math.max(12, anchor.bottom + 6);
      const maxHeight = Math.max(160, Math.min(380, winH - top - 12));
      return { position: 'fixed', top, left, width: menuW, maxHeight };
    } else {
      const bottom = Math.max(12, winH - anchor.top + 6);
      const maxHeight = Math.max(160, Math.min(380, anchor.top - 18));
      return { position: 'fixed', bottom, left, width: menuW, maxHeight };
    }
  };

  return (
    <div className="relative shrink-0">
      <button type="button" aria-expanded={open}
        onClick={e => {
          e.stopPropagation();
          setAnchor(e.currentTarget.getBoundingClientRect());
          setOpen(o => !o);
        }}
        title={assigned ? `Reassign (now: ${t.assignedToName || 'assigned'})` : 'Assign to staff'}
        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border shrink-0 transition-colors ${open ? 'bg-[#2f4e56] text-white border-[#2f4e56]'
          : assigned ? 'border-[#c3d2ce] bg-white text-[#2f4e56] hover:bg-[#eef3f1] dark:bg-[#1d2024] dark:text-[#b9bec9] dark:border-[#2a2e35]'
          : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:bg-amber-400/15 dark:text-amber-200 dark:border-amber-400/30'}`}>
        {assigned ? <><RefreshCw className="w-3.5 h-3.5" /> Reassign</> : <><UserPlus className="w-3.5 h-3.5" /> Assign</>}
      </button>
      {open && anchor && createPortal(
        <>
          <div className="fixed inset-0 z-[1400] bg-black/20 sm:bg-transparent" onClick={() => setOpen(false)} />
          <div
            ref={menuRef}
            onClick={e => e.stopPropagation()}
            className="fixed z-[1401] p-2.5 rounded-2xl border border-slate-200 dark:border-[#2a2e35] bg-white dark:bg-[#15171a] shadow-2xl flex flex-col"
            style={getPopoverStyle()}
          >
            <div className="flex items-center justify-between px-1 pb-1.5 border-b border-slate-100 dark:border-[#24272c] mb-1 shrink-0">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">
                {assigned ? `Assigned: ${t.assignedToName || 'staff'}` : 'Assign Technician'}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 -mr-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-ticket-scrollbar -mx-1 px-1">
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
