import { useState } from 'react';
import { X, GitMerge, ArrowRight, CheckCheck, Loader2, Users, AlertTriangle } from 'lucide-react';
import { shortTicketId, ticketLabel } from '../../lib/ticketUtils.js';

export default function MergeModal({ primaryTicket, duplicateTicket, onClose, onMerged, api, showToast }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [selectedPrimary, setSelectedPrimary] = useState(primaryTicket?.id);

  if (!primaryTicket || !duplicateTicket) return null;

  const target = selectedPrimary === primaryTicket.id ? primaryTicket : duplicateTicket;
  const source = selectedPrimary === primaryTicket.id ? duplicateTicket : primaryTicket;

  async function handleMerge() {
    setBusy(true);
    try {
      await api.mergeTickets(target.id, {
        duplicate_ticket_ids: [source.id],
        resolution_note: note.trim() || undefined,
      });
      showToast(`Merged ${shortTicketId(source)} into ${shortTicketId(target)}!`, 'success');
      onMerged?.(target.id, source.id);
      onClose();
    } catch (err) {
      showToast(err.message || 'Failed to merge tickets', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs overflow-y-auto" onClick={onClose}>
      <div className="bg-white dark:bg-[#121417] rounded-3xl max-w-lg w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:p-6 space-y-4 border border-slate-200 dark:border-[#2a2e35] shadow-2xl text-slate-900 dark:text-white" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold leading-tight">Merge Duplicate Tickets</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Combine duplicate reports into a single primary issue</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-5 h-5" /></button>
        </div>

        {/* Swap / Selection instruction */}
        <div className="p-3 rounded-2xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Choose which ticket remains active as the <strong>Primary</strong>. The duplicate ticket will be resolved and its supporters linked.
          </p>
        </div>

        {/* Tickets Comparison */}
        <div className="space-y-2">
          {/* Option 1: primaryTicket */}
          <div
            onClick={() => setSelectedPrimary(primaryTicket.id)}
            className={`p-3 rounded-2xl border transition-all cursor-pointer ${
              selectedPrimary === primaryTicket.id
                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-500'
                : 'border-slate-200 dark:border-[#2a2e35] bg-slate-50/60 dark:bg-white/5 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-mono text-xs font-black text-slate-900 dark:text-white">
                {shortTicketId(primaryTicket)}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                selectedPrimary === primaryTicket.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400'
              }`}>
                {selectedPrimary === primaryTicket.id ? 'Primary (Kept Active)' : 'Duplicate (Will Resolve)'}
              </span>
            </div>
            <p className="text-xs font-extrabold truncate text-slate-800 dark:text-slate-100">{ticketLabel(primaryTicket)}</p>
            <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              <span>📍 {primaryTicket.location || 'Campus'}</span>
              <span>👥 {primaryTicket.upvotes || 1} supporter{(primaryTicket.upvotes || 1) > 1 ? 's' : ''}</span>
            </div>
          </div>

          <div className="flex justify-center text-slate-400">
            <ArrowRight className="w-4 h-4 rotate-90" />
          </div>

          {/* Option 2: duplicateTicket */}
          <div
            onClick={() => setSelectedPrimary(duplicateTicket.id)}
            className={`p-3 rounded-2xl border transition-all cursor-pointer ${
              selectedPrimary === duplicateTicket.id
                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-500'
                : 'border-slate-200 dark:border-[#2a2e35] bg-slate-50/60 dark:bg-white/5 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-mono text-xs font-black text-slate-900 dark:text-white">
                {shortTicketId(duplicateTicket)}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                selectedPrimary === duplicateTicket.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400'
              }`}>
                {selectedPrimary === duplicateTicket.id ? 'Primary (Kept Active)' : 'Duplicate (Will Resolve)'}
              </span>
            </div>
            <p className="text-xs font-extrabold truncate text-slate-800 dark:text-slate-100">{ticketLabel(duplicateTicket)}</p>
            <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              <span>📍 {duplicateTicket.location || 'Campus'}</span>
              <span>👥 {duplicateTicket.upvotes || 1} supporter{(duplicateTicket.upvotes || 1) > 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        {/* Note input */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Resolution Remark <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={`e.g. Duplicate of ${shortTicketId(target)}`}
            className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-[#2a2e35] bg-slate-50 dark:bg-[#16181c] text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#2f4e56]/20"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-[#25282e]">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-[#2a2e35] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleMerge}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-[#2f4e56] hover:bg-[#253e45] text-white flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />}
            <span>Confirm & Merge Tickets</span>
          </button>
        </div>
      </div>
    </div>
  );
}
