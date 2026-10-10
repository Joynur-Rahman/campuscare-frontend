import { useState } from 'react';
import { MapPin, Calendar, Wrench, Users, MessageSquareText } from 'lucide-react';
import { statusLabel, statusStyle, ticketLabel, createdMs, fmtDate, getTicketCoords, cleanDescription } from '../lib/ticketUtils.js';
import LocationModal from './LocationModal.jsx';

export default function TicketCard({ t, onOpen, action }) {
  const [showLocation, setShowLocation] = useState(false);
  const coords = getTicketCoords(t);
  const hasLocation = Boolean(t.location || coords);
  const desc = cleanDescription(t.description);
  return (
    <div className="panel p-4 sm:p-5 h-full flex flex-col justify-between transition-all hover:shadow-md dark:hover:border-slate-700/80">
      {/* Top Header Badge Row */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2.5">
          <span className="font-mono text-xs font-bold text-iiitg-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-lg bg-iiitg-50 dark:bg-indigo-950/60 border border-iiitg-100 dark:border-indigo-800/50">
            {t.id}
          </span>
          <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${statusStyle(t)}`}>
            {statusLabel(t)}
          </span>
          {t.priority === 'High' && (
            <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 uppercase tracking-wider">
              Urgent
            </span>
          )}
          {(t.upvotes || 0) > 1 && (
            <span className="ml-auto flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-900/50">
              <Users className="w-3.5 h-3.5" />
              <span>{t.upvotes}</span>
            </span>
          )}
        </div>

        {/* Title & Description */}
        <div className="mb-3">
          <h3 className="text-sm sm:text-[15px] font-bold text-slate-900 dark:text-slate-100 leading-snug">
            {ticketLabel(t)}
          </h3>
          {desc && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
              {desc}
            </p>
          )}
        </div>

        {/* Metadata info */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-400 dark:text-slate-400 mb-3">
          {hasLocation && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowLocation(true);
              }}
              title={coords ? `GPS: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} — Click to view Map` : 'Click to view on Map'}
              className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400 hover:text-rose-700 bg-rose-50/80 hover:bg-rose-100/90 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 px-2 py-0.5 rounded-lg border border-rose-200/60 dark:border-rose-900/40 transition-all cursor-pointer group"
            >
              <MapPin className="w-3.5 h-3.5 shrink-0 text-rose-500 group-hover:scale-110 transition-transform" />
              <span className="truncate max-w-[170px] font-medium">{t.location || 'Campus Location'}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500/90 underline decoration-rose-300 ml-0.5">Map</span>
            </button>
          )}
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
            <span>{t.date || fmtDate(createdMs(t))}</span>
          </span>
          {t.assignedToName && (
            <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
              <Wrench className="w-3.5 h-3.5 shrink-0" />
              <span>{t.assignedToName}</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Bottom Action Footer (Cleanly Pinned to Bottom) ── */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 mt-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-h-[34px]">
          {action}
        </div>
        {onOpen && (
          <button
            onClick={() => onOpen(t)}
            className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-100 dark:border-indigo-800/60 rounded-xl transition-all active:scale-95 shadow-sm shrink-0 cursor-pointer"
          >
            <MessageSquareText className="w-3.5 h-3.5" />
            <span>Details &amp; chat</span>
          </button>
        )}
      </div>

      {/* Interactive MapmyIndia / Leaflet Pin Modal */}
      {showLocation && (
        <LocationModal
          ticket={coords ? { ...t, latitude: coords.lat, longitude: coords.lng } : t}
          onClose={() => setShowLocation(false)}
        />
      )}
    </div>
  );
}
