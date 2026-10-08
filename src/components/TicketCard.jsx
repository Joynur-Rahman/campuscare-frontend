import { MapPin, Calendar, Wrench, Users, MessageSquareText } from 'lucide-react';
import { statusLabel, statusStyle, ticketLabel, createdMs, fmtDate } from '../lib/ticketUtils.js';

export default function TicketCard({ t, onOpen, action }) {
  return (
    <div className="panel p-4 sm:p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-xs font-bold text-iiitg-700 px-2 py-0.5 rounded-lg bg-iiitg-50 border border-iiitg-100">{t.id}</span>
        <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${statusStyle(t)}`}>{statusLabel(t)}</span>
        {t.priority === 'High' && <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-700 border border-rose-200 uppercase tracking-wider">Urgent</span>}
        {(t.upvotes || 0) > 1 && <span className="ml-auto flex items-center gap-1 text-xs text-blue-600 font-bold"><Users className="w-3.5 h-3.5" />{t.upvotes}</span>}
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-900">{ticketLabel(t)}</h3>
        {t.description && <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{t.description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 mt-0.5">
        {t.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{t.location}</span>}
        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{t.date || fmtDate(createdMs(t))}</span>
        {t.assignedToName && <span className="flex items-center gap-1"><Wrench className="w-3 h-3" />{t.assignedToName}</span>}
      </div>
      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 mt-1">
        {action}
        {onOpen && (
          <button onClick={() => onOpen(t)} className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-iiitg-700 bg-iiitg-50 hover:bg-iiitg-100 border border-iiitg-100 rounded-lg">
            <MessageSquareText className="w-3.5 h-3.5" /> Details &amp; chat
          </button>
        )}
      </div>
    </div>
  );
}
