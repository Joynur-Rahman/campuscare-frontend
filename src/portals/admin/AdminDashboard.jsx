import { useState } from 'react';
import {
  Ticket, Clock, CheckCircle2, AlertTriangle, Flame, Star,
  HardHat, ShieldCheck, ArrowRight, Radio, ChevronRight, MessageSquareText
} from 'lucide-react';
import { summary } from '../../lib/adminMetrics.js';
import { statusLabel, statusStyle, ticketLabel, createdMs, fmtDate } from '../../lib/ticketUtils.js';



export default function AdminDashboard({ tickets = [], techs = [], onNavigate, onOpen }) {
  const s = summary(tickets);
  
  

  const onDutyCount = (techs || []).filter(t => !t.status || t.status === 'On Duty').length;
  const offDutyCount = (techs || []).length - onDutyCount;
  const slaResolutionRate = s.reported > 0 ? Math.round((s.fixed / s.reported) * 100) : 100;

  // Recent operational activity
  const recentTickets = [...tickets]
    .sort((a, b) => createdMs(b) - createdMs(a))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      {/* ── 1. Executive Fleet Readiness & Operational SLA Banner ── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-iiitg-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Operations Fleet
            </span>
            <span className="text-xs font-semibold text-slate-300">
              · {onDutyCount} Staff On Duty {offDutyCount > 0 && `(${offDutyCount} Off Duty)`}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-200">
            Current Resolution SLA Health: <strong className="text-emerald-300 font-extrabold">{slaResolutionRate}%</strong> across all campus sectors.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {s.unassigned > 0 ? (
            <button
              onClick={() => onNavigate && onNavigate('tickets', 'unassigned')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md transition active:scale-95 cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-950" />
              <span>Assign {s.unassigned} Waiting {s.unassigned === 1 ? 'Ticket' : 'Tickets'}</span>
              <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          ) : (
            <button
              onClick={() => onNavigate && onNavigate('tickets', 'all')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-xs transition active:scale-95 cursor-pointer"
            >
              <span>View All Tickets</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── 2. Interactive Executive KPI Tiles (Clickable to Filter) ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Reported */}
        <div
          onClick={() => onNavigate && onNavigate('tickets', 'all')}
          className="panel p-4 flex flex-col justify-between transition-all hover:shadow-md hover:border-indigo-400/60 dark:hover:border-indigo-500/50 cursor-pointer group active:scale-[0.98]"
          title="Click to view all reported tickets"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Reported</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
              {s.reported}
            </div>
            <div className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 flex items-center justify-between">
              <span>Total volume</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold group-hover:translate-x-0.5 transition-transform">→</span>
            </div>
          </div>
        </div>

        {/* Open Now */}
        <div
          onClick={() => onNavigate && onNavigate('tickets', 'open')}
          className="panel p-4 flex flex-col justify-between transition-all hover:shadow-md hover:border-blue-400/60 dark:hover:border-blue-500/50 cursor-pointer group active:scale-[0.98]"
          title="Click to view open tickets"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Open Now</span>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl sm:text-3xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">
              {s.open}
            </div>
            <div className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 flex items-center justify-between">
              <span>Active queue</span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold group-hover:translate-x-0.5 transition-transform">→</span>
            </div>
          </div>
        </div>

        {/* Not Assigned */}
        <div
          onClick={() => onNavigate && onNavigate('tickets', 'unassigned')}
          className={`panel p-4 flex flex-col justify-between transition-all hover:shadow-md cursor-pointer group active:scale-[0.98] ${
            s.unassigned > 0
              ? 'border-amber-300 dark:border-amber-600/70 bg-amber-50/20 dark:bg-amber-950/20 hover:border-amber-500'
              : 'hover:border-slate-400 dark:hover:border-slate-600'
          }`}
          title="Click to review unassigned tickets"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Not Assigned</span>
            <div className={`p-1.5 rounded-lg transition-transform group-hover:scale-110 ${
              s.unassigned > 0
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className={`text-2xl sm:text-3xl font-extrabold font-mono ${s.unassigned > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-200'}`}>
              {s.unassigned}
            </div>
            <div className="text-[10.5px] font-medium mt-0.5 flex items-center justify-between">
              <span className={s.unassigned > 0 ? 'text-amber-700 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400'}>
                {s.unassigned > 0 ? 'Action needed' : 'All dispatched'}
              </span>
              <span className="text-amber-600 dark:text-amber-400 font-semibold group-hover:translate-x-0.5 transition-transform">→</span>
            </div>
          </div>
        </div>

        {/* Urgent */}
        <div
          onClick={() => onNavigate && onNavigate('tickets', 'urgent')}
          className={`panel p-4 flex flex-col justify-between transition-all hover:shadow-md cursor-pointer group active:scale-[0.98] ${
            s.urgent > 0
              ? 'border-rose-400 dark:border-rose-700 bg-rose-50/30 dark:bg-rose-950/20 hover:border-rose-500'
              : 'hover:border-slate-400 dark:hover:border-slate-600'
          }`}
          title="Click to view urgent tickets"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Urgent</span>
            <div className={`p-1.5 rounded-lg transition-transform group-hover:scale-110 ${
              s.urgent > 0
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/70 dark:text-rose-300'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}>
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className={`text-2xl sm:text-3xl font-extrabold font-mono ${s.urgent > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>
              {s.urgent}
            </div>
            <div className="text-[10.5px] font-medium mt-0.5 flex items-center justify-between">
              <span className={s.urgent > 0 ? 'text-rose-700 dark:text-rose-400 font-bold' : 'text-slate-500 dark:text-slate-400'}>
                {s.urgent > 0 ? 'High priority' : 'Zero urgent'}
              </span>
              <span className="text-rose-600 dark:text-rose-400 font-semibold group-hover:translate-x-0.5 transition-transform">→</span>
            </div>
          </div>
        </div>

        {/* Resolved */}
        <div
          onClick={() => onNavigate && onNavigate('tickets', 'resolved')}
          className="panel p-4 flex flex-col justify-between transition-all hover:shadow-md hover:border-emerald-400/60 dark:hover:border-emerald-500/50 cursor-pointer group active:scale-[0.98]"
          title="Click to view resolved tickets"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Resolved</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              {s.fixed}
            </div>
            <div className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 flex items-center justify-between">
              <span>Closed fixes</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold group-hover:translate-x-0.5 transition-transform">→</span>
            </div>
          </div>
        </div>

        {/* Avg Rating */}
        <div
          onClick={() => onNavigate && onNavigate('reports', 'all')}
          className="panel p-4 flex flex-col justify-between transition-all hover:shadow-md hover:border-amber-400/60 dark:hover:border-amber-500/50 cursor-pointer group active:scale-[0.98]"
          title="Click to view feedback and audit reports"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Avg Rating</span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-500 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <Star className="w-4 h-4 fill-amber-400" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-500 dark:text-amber-400 font-mono flex items-center gap-1">
              <span>{s.avgRating ? Number(s.avgRating).toFixed(1) : '4.5'}</span>
              <span className="text-sm font-normal text-slate-400 dark:text-slate-500">/5</span>
            </div>
            <div className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 flex items-center justify-between">
              <span>Student score</span>
              <span className="text-amber-500 dark:text-amber-400 font-semibold group-hover:translate-x-0.5 transition-transform">→</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Live Operational Activity Stream ── */}
      <div className="panel p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Campus Operations Activity
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Real-time feed of logged tickets, technician dispatches, and fixes.
            </p>
          </div>
          <button
            onClick={() => onNavigate && onNavigate('tickets', 'all')}
            className="text-xs font-bold text-indigo-700 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Full Ticket Audit</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {recentTickets.map((t) => (
            <div
              key={t.id}
              onClick={() => onOpen && onOpen(t)}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 rounded-xl px-2.5 -mx-2.5 transition cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                {/* Fixed-width Status Pill to keep all rows and ticket titles perfectly aligned vertically */}
                <div className="w-24 shrink-0 flex items-center justify-center">
                  <span className={`w-full py-1 text-[10.5px] font-bold rounded-lg border text-center shadow-2xs tracking-wide truncate ${statusStyle(t)}`}>
                    {statusLabel(t)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-300">
                      #{t.id}
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {ticketLabel(t)}
                    </span>
                    {t.priority === 'High' && (
                      <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800 uppercase tracking-wider">
                        Urgent
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">
                    {t.description || 'No description provided.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center text-xs">
                <div className="text-right">
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {t.location || 'Campus'}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">
                    {t.date || fmtDate(createdMs(t))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onOpen && onOpen(t); }}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                  title="Open ticket details & messages"
                >
                  <MessageSquareText className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {recentTickets.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-400">
              No recent campus activity recorded.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
