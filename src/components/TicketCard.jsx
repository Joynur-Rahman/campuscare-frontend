import { useState, useEffect } from 'react';
import {
  MapPin, Calendar, Wrench, Users, MessageSquareText, Clock,
  Droplets, Zap, Wifi, Shield, Archive, Star, Compass, Search, CheckCircle2,
  Camera
} from 'lucide-react';
import { statusLabel, ticketLabel, shortTicketId, createdMs, fmtDate, getTicketCoords, cleanDescription, isLostFound } from '../lib/ticketUtils.js';
import LocationModal from './LocationModal.jsx';
import TicketTimelineStepper from './TicketTimelineStepper.jsx';
import RatingModal from './RatingModal.jsx';

function getCategoryTheme(cat, subCat) {
  const c = `${cat || ''} ${subCat || ''}`.toLowerCase();
  if (c.includes('lost') || c.includes('found')) {
    return { Icon: Archive, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800' };
  }
  if (c.includes('water') || c.includes('plumb') || c.includes('tap') || c.includes('pipe') || c.includes('drain')) {
    return { Icon: Droplets, color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800' };
  }
  if (c.includes('elec') || c.includes('fan') || c.includes('light') || c.includes('switch') || c.includes('power')) {
    return { Icon: Zap, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800' };
  }
  if (/\bit\b/.test(c) || c.includes('wifi') || c.includes('wi-fi') || c.includes('net') || c.includes('lan')) {
    return { Icon: Wifi, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800' };
  }
  if (c.includes('sec') || c.includes('gate') || c.includes('guard')) {
    return { Icon: Shield, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800' };
  }
  return { Icon: Wrench, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800' };
}

export default function TicketCard({
  t: tProp,
  ticket: ticketProp,
  onOpen,
  action,
  footerAction,
  headerAction,
  canRate = true,
  unassignedLabel = 'Awaiting Technician',
}) {
  const t = tProp || ticketProp;
  if (!t) return null;
  const [showLocation, setShowLocation] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [currentRating, setCurrentRating] = useState(t.rating);

  useEffect(() => {
    if (t.rating !== undefined) setCurrentRating(t.rating);
  }, [t.rating]);

  const coords = getTicketCoords(t);
  const hasLocation = !t.confidential && Boolean(t.location || coords);

  const desc = cleanDescription(t.description);
  const catTheme = getCategoryTheme(t.category || t.categoryDisplay, t.subCategory);
  const CatIcon = catTheme.Icon;
  const msgCount = Array.isArray(t.messages) ? t.messages.length : 0;
  const mediaCount = (
    (Array.isArray(t.media) ? t.media.length : 0) ||
    (Array.isArray(t.attachments) ? t.attachments.length : 0) ||
    (t.photoUrl ? 1 : 0)
  );

  const s = String(t.status || '').toLowerCase();
  const isResolved = s === 'resolved' || s === 'fixed' || s === 'done';
  const lf = isLostFound(t);
  const isLostItem = lf && /\[lost\]|\blost\b/i.test(`${t.subCategory || ''} ${t.title || ''} ${t.description || ''}`) && !/\[found\]|\bfound item\b/i.test(`${t.subCategory || ''} ${t.title || ''} ${t.description || ''}`);

  const tone = {
    bar: lf
      ? isLostItem
        ? 'bg-rose-500'
        : 'bg-emerald-500'
      : 'bg-[#2f4e56] dark:bg-[#6366f1]',
    foot: 'bg-[#fffaeb] dark:bg-[#101214]/80 border-amber-200/70 dark:border-[#2a2e35]',
  };

  return (
    <div className="cc-ticket-card group relative overflow-hidden rounded-2xl flex flex-col justify-between h-full bg-[#fcfdfd] dark:bg-[#121417] border border-[#bfd0cc] dark:border-[#2a2e35] shadow-[0_1px_2px_rgba(30,47,51,0.06),0_3px_8px_rgba(30,47,51,0.07)] hover:shadow-[0_2px_4px_rgba(30,47,51,0.08),0_6px_14px_rgba(30,47,51,0.10)] hover:border-[#b3cacf] dark:hover:border-[#40444c] transition-all duration-200">
      <span aria-hidden="true" className={`absolute left-0 top-0 bottom-0 w-1 ${tone.bar}`} />

      {/* ── Card Content Body ── */}
      <div className="p-3 sm:p-3.5 flex-1 flex flex-col">
        {/* Top Header Badge Row */}
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              title={`Full ID: ${t.id} (Click to copy)`}
              onClick={(e) => {
                e.stopPropagation();
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(t.id);
                }
              }}
              className="font-mono text-xs font-black text-[#2f4e56] dark:text-[#b9bec9] px-2 py-0.5 rounded-lg bg-[#eaf1ef] dark:bg-[#1d2024] border border-[#d3dfdc] dark:border-[#2a2e35] tracking-tight cursor-pointer hover:border-[#2f4e56] dark:hover:border-slate-500 transition-colors"
            >
              {shortTicketId(t)}
            </span>

            {lf ? (
              isResolved ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold border bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Claimed / Returned</span>
                </span>
              ) : isLostItem ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold border bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300">
                  <Search className="w-3.5 h-3.5" />
                  <span>Lost item</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold border bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-300">
                  <Archive className="w-3.5 h-3.5" />
                  <span>Found item</span>
                </span>
              )
            ) : !t.assignedToName && isResolved ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                <span>✓ Fixed</span>
              </span>
            ) : t.assignedToName ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#eaf1ef] dark:bg-[#1d2024] border border-[#d3dfdc] dark:border-[#2a2e35] text-[#2f4e56] dark:text-[#b9bec9] text-xs font-bold shadow-2xs">
                <Wrench className="w-3.5 h-3.5 text-[#2f4e56] dark:text-[#b9bec9]" />
                <span className="truncate max-w-[160px]">{t.assignedToName}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>{unassignedLabel}</span>
              </span>
            )}

            {!lf && (t.priority === 'High' || t.urgent) && (
              <span className="px-2 py-0.5 text-[10px] font-black rounded-lg bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 uppercase tracking-wider">
                Urgent
              </span>
            )}

            {mediaCount > 0 && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-lg bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800/60 text-teal-700 dark:text-teal-300 shadow-2xs"
                title={`${mediaCount} attached photo${mediaCount > 1 ? 's' : ''}`}
              >
                <Camera className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                <span>{mediaCount} {mediaCount === 1 ? 'photo' : 'photos'}</span>
              </span>
            )}
          </div>

          {headerAction ? (
            <div className="shrink-0">{headerAction}</div>
          ) : action && !lf ? (
            <div className="shrink-0">{action}</div>
          ) : (
            (t.upvotes || 0) > 1 && (
              <span className="inline-flex items-center gap-1 text-xs text-[#2f4e56] dark:text-[#b9bec9] font-bold bg-[#e3ebe9] dark:bg-[#1d2024] px-2.5 py-0.5 rounded-full border border-[#d6ded7] dark:border-[#2a2e35] shrink-0">
                <Users className="w-3.5 h-3.5 text-[#2f4e56] dark:text-[#b9bec9]" />
                <span>{t.upvotes} affected</span>
              </span>
            )
          )}
        </div>

        {/* Title & Description with Category Icon Accent */}
        <div className="flex-1 flex flex-col justify-center py-1.5">
          <div className="flex items-start gap-2">
            <span
              className={`p-1.5 rounded-xl border shrink-0 mt-0.5 shadow-2xs ${catTheme.bg} ${catTheme.color}`}
              title={t.category || t.categoryDisplay || 'Category'}
            >
              <CatIcon className="w-3.5 h-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-[15px] font-extrabold text-slate-900 dark:text-slate-100 leading-snug line-clamp-1 tracking-tight">
                {ticketLabel(t)}
              </h3>
              {desc ? (
                <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5 leading-snug">
                  {desc}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Metadata Strip: Location + Date */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300 pt-2.5 mt-1 border-t border-[#e6eeeb] dark:border-slate-800/60">
          {hasLocation && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowLocation(true);
              }}
              title={
                coords
                  ? `GPS: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} — Click to view Map`
                  : 'Click to view on Map'
              }
              className="cc-loc-row flex-1 min-w-0 inline-flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg bg-[#f2f7f5] hover:bg-[#e8f0ed] dark:bg-[#15171a] dark:hover:bg-[#1b1d21] border border-[#dbe5e2] hover:border-[#b3cacf] dark:border-[#2c3037] dark:hover:border-[#3c648f] transition-all cursor-pointer group text-left shadow-2xs active:scale-[0.99]"
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="w-5 h-5 rounded-lg bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <MapPin className="w-3.5 h-3.5" />
                </span>
                <span className="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate">
                  {t.location || 'Campus Location'}
                </span>
              </div>

              <span className="cc-map-chip inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shadow-2xs transition-all shrink-0">
                <Compass className="w-3 h-3 group-hover:rotate-45 transition-transform duration-300" />
                <span>Map</span>
              </span>
            </button>
          )}

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#f2f7f5] dark:bg-[#15171a] border border-[#dbe5e2] dark:border-[#2c3037] font-semibold text-xs text-slate-700 dark:text-slate-300 shrink-0 shadow-2xs self-start sm:self-auto">
            <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-500 dark:text-slate-400" />
            <span>{t.date || fmtDate(createdMs(t))}</span>
          </span>
        </div>
      </div>

      {/* ── Footer with Status Timeline & Right-Aligned Actions ── */}
      <div className={`${tone.foot} px-3 py-2 border-t flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2`}>
        <div className="flex-1 min-w-0 pr-1 sm:pr-2">
          {action && lf ? action : <TicketTimelineStepper ticket={t} />}
        </div>

        <div className="flex items-center justify-end gap-1.5 shrink-0 ml-auto">
          {footerAction}

          {!canRate && Number(t.rating) > 0 && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl border bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-200 shrink-0"
              title={`Rated ${t.rating}/5 by the reporter`}
            >
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" /> {t.rating}/5
            </span>
          )}

          {isResolved && canRate && !lf && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowRateModal(true);
              }}
              className={`inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl border transition-all active:scale-95 shadow-2xs shrink-0 cursor-pointer ${
                currentRating || t.rating
                  ? 'bg-amber-100/90 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 hover:bg-amber-200/80'
                  : 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-xs'
              }`}
              title={
                currentRating || t.rating
                  ? `Rated ${currentRating || t.rating}/5 stars · Click to edit`
                  : 'Work completed! Rate resolution & service'
              }
            >
              <Star
                className={`w-3.5 h-3.5 ${
                  currentRating || t.rating ? 'fill-amber-400 text-amber-500' : 'fill-white text-white'
                }`}
              />
              <span>{currentRating || t.rating ? `${currentRating || t.rating}★` : 'Rate'}</span>
            </button>
          )}

          {onOpen && (
            <button
              onClick={() => onOpen(t)}
              className="cc-secondary-btn inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all active:scale-95 shadow-xs shrink-0 cursor-pointer"
            >
              <MessageSquareText className="w-3.5 h-3.5" />
              <span>{lf ? 'Claim / Chat' : 'Details & chat'}</span>
              {msgCount > 0 && (
                <span
                  className="ml-0.5 px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[10px] font-black shadow-xs"
                  title={`${msgCount} message${msgCount > 1 ? 's' : ''}`}
                >
                  {msgCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {showLocation && (
        <LocationModal
          ticket={coords ? { ...t, latitude: coords.lat, longitude: coords.lng } : t}
          onClose={() => setShowLocation(false)}
        />
      )}

      {showRateModal && (
        <RatingModal
          ticket={t}
          onClose={() => setShowRateModal(false)}
          onRated={(r) => {
            setCurrentRating(r);
            t.rating = r;
          }}
        />
      )}
    </div>
  );
}
