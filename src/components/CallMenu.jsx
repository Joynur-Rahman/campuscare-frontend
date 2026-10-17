import { useState } from 'react';
import { Phone, ChevronDown } from 'lucide-react';

const telHref = (p) => 'tel:' + String(p || '').replace(/[^\d+]/g, '');

/**
 * Green "Call ▾" button with a small menu of people to ring.
 * contacts: [{ who: 'Student', name: 'Priya', phone: '+91…' }]
 */
export default function CallMenu({ contacts = [] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm shadow-emerald-700/25 ring-1 ring-emerald-500/50 transition"
      >
        <Phone className="w-3.5 h-3.5" /> Call <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1.5 z-20 w-60 rounded-xl border border-slate-200 dark:border-[#2a2e35] bg-white dark:bg-[#15171a] shadow-xl py-1 text-sm">
            {contacts.map(c => c.phone ? (
              <a key={c.who} href={telHref(c.phone)} onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 dark:hover:bg-[#1b1d21]">
                <span className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-400/15 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0"><Phone className="w-3.5 h-3.5" /></span>
                <span className="min-w-0">
                  <span className="block font-bold text-slate-800 dark:text-slate-100 truncate">{c.who}</span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">{c.name} · {c.phone}</span>
                </span>
              </a>
            ) : (
              <div key={c.who} className="flex items-center gap-2.5 px-3 py-2 opacity-60 cursor-not-allowed" title="No phone number available">
                <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-400 flex items-center justify-center shrink-0"><Phone className="w-3.5 h-3.5" /></span>
                <span className="min-w-0">
                  <span className="block font-bold text-slate-700 dark:text-slate-200 truncate">{c.who}{c.name ? ` · ${c.name}` : ''}</span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">{c.missing || 'No number shared'}</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
