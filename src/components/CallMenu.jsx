import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Phone, ChevronDown, X } from 'lucide-react';

const telHref = (p) => 'tel:' + String(p || '').replace(/[^\d+]/g, '');

/**
 * Green "Call ▾" button with a small menu of people to ring.
 * contacts: [{ who, name, phone }]
 */
export default function CallMenu({ contacts = [] }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClose = (e) => {
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

  const getPopoverStyle = () => {
    if (!anchor) return {};
    const winW = typeof window !== 'undefined' ? window.innerWidth : 360;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 640;
    const menuW = Math.min(270, winW - 24);

    let left;
    if (anchor.left + menuW <= winW - 12) {
      left = anchor.left;
    } else if (anchor.right - menuW >= 12) {
      left = anchor.right - menuW;
    } else {
      left = (winW - menuW) / 2;
    }
    left = Math.max(12, Math.min(left, winW - menuW - 12));

    const spaceBelow = winH - anchor.bottom;
    const spaceAbove = anchor.top;
    const preferBelow = spaceBelow >= 180 || spaceBelow >= spaceAbove;

    if (preferBelow) {
      const top = Math.max(12, anchor.bottom + 6);
      const maxHeight = Math.max(140, Math.min(340, winH - top - 12));
      return { position: 'fixed', top, left, width: menuW, maxHeight };
    } else {
      const bottom = Math.max(12, winH - anchor.top + 6);
      const maxHeight = Math.max(140, Math.min(340, anchor.top - 18));
      return { position: 'fixed', bottom, left, width: menuW, maxHeight };
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          setAnchor(e.currentTarget.getBoundingClientRect());
          setOpen(o => !o);
        }}
        aria-expanded={open}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm shadow-emerald-700/25 ring-1 ring-emerald-500/50 transition cursor-pointer"
      >
        <Phone className="w-3.5 h-3.5" /> Call <ChevronDown className="w-3 h-3" />
      </button>
      {open && anchor && createPortal(
        <>
          <div className="fixed inset-0 z-[1400] bg-black/20 sm:bg-transparent" onClick={() => setOpen(false)} />
          <div
            ref={menuRef}
            onClick={e => e.stopPropagation()}
            className="fixed z-[1401] rounded-2xl border border-slate-200 dark:border-[#2a2e35] bg-white dark:bg-[#15171a] shadow-2xl p-2 text-sm flex flex-col"
            style={getPopoverStyle()}
          >
            <div className="flex items-center justify-between px-1.5 pb-1 border-b border-slate-100 dark:border-[#24272c] mb-1 shrink-0">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Direct Call</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 -mr-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-ticket-scrollbar space-y-1">
              {contacts.map(c => c.phone ? (
                <a key={c.who} href={telHref(c.phone)} onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#1b1d21] transition">
                  <span className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-400/15 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0"><Phone className="w-3.5 h-3.5" /></span>
                  <span className="min-w-0">
                    <span className="block font-bold text-xs text-slate-800 dark:text-slate-100 truncate">{c.who}</span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">{c.name} · {c.phone}</span>
                  </span>
                </a>
              ) : (
                <div key={c.who} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl opacity-60 cursor-not-allowed" title="No phone number available">
                  <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-400 flex items-center justify-center shrink-0"><Phone className="w-3.5 h-3.5" /></span>
                  <span className="min-w-0">
                    <span className="block font-bold text-xs text-slate-700 dark:text-slate-200 truncate">{c.who}{c.name ? ` · ${c.name}` : ''}</span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">{c.missing || 'No number shared'}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
