import { useState, useMemo } from 'react';
import {
  Ticket, CircleCheck, Clock, Star, Download, TrendingUp,
  MapPin, Wrench, ShieldAlert, Award, Zap, Droplets, ShieldCheck, Sparkles, Wifi
} from 'lucide-react';
import { summary, byCategory, byPlace, techStats } from '../../lib/adminMetrics.js';
import { createdMs, fmtDate, ticketLabel } from '../../lib/ticketUtils.js';

// Category icon helper
function getCatIcon(key = '') {
  const k = key.toLowerCase();
  if (k.includes('it') || k.includes('wifi')) return Wifi;
  if (k.includes('elect') || k.includes('power')) return Zap;
  if (k.includes('water') || k.includes('plumb')) return Droplets;
  if (k.includes('sec') || k.includes('lost')) return ShieldCheck;
  if (k.includes('clean') || k.includes('house')) return Sparkles;
  return Wrench;
}

export default function AdminReports({ tickets = [], techs = [] }) {
  const [timeRange, setTimeRange] = useState('all'); // 'all' | 'month' | 'week'

  // Time-filtered tickets
  const filteredTickets = useMemo(() => {
    if (timeRange === 'all') return tickets;
    const now = Date.now();
    const days = timeRange === 'week' ? 7 : 30;
    const cutoff = now - days * 86400000;
    return tickets.filter(t => createdMs(t) >= cutoff);
  }, [tickets, timeRange]);

  const s = summary(filteredTickets);
  const cats = byCategory(filteredTickets);
  const places = byPlace(filteredTickets);
  const trows = techStats(filteredTickets, techs);

  // Resolution Rate %
  const fixRate = s.reported > 0 ? Math.round((s.fixed / s.reported) * 100) : 100;

  // Real client-side CSV Export
  const exportCSV = () => {
    if (filteredTickets.length === 0) return;
    const headers = ['Ticket ID', 'Category', 'Description', 'Location', 'Status', 'Priority', 'Assigned Tech', 'Date'];
    const rows = filteredTickets.map(t => [
      `"${t.id || ''}"`,
      `"${ticketLabel(t)}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      `"${t.location || 'Campus'}"`,
      `"${t.status || 'Waiting'}"`,
      `"${t.priority || 'Normal'}"`,
      `"${t.assignedToName || 'Unassigned'}"`,
      `"${t.date || fmtDate(createdMs(t))}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `campuscare-audit-report-${timeRange}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Top technician performer
  const sortedTechs = [...trows].sort((a, b) => (b.fixed || 0) - (a.fixed || 0));
  const topPerformer = sortedTechs[0] && sortedTechs[0].fixed > 0 ? sortedTechs[0] : null;

  return (
    <div className="space-y-6">
      {/* ── 1. Header Toolbar: Time Range Filter + CSV Export ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
            Campus Operations Reports
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Maintenance summary, problem distribution, hotspot buildings, and technician performance.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Time Filter Tabs */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold">
            <button
              onClick={() => setTimeRange('all')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                timeRange === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setTimeRange('month')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                timeRange === 'month'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setTimeRange('week')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                timeRange === 'week'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              This Week
            </button>
          </div>

          {/* Export CSV Button */}
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-2xs cursor-pointer active:scale-95"
            title="Download report data as CSV file"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ── 2. Executive Scorecard (Simple & Friendly Metrics) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Reported */}
        <div className="panel p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Reported</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
            {s.reported}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Total logged issues</p>
        </div>

        {/* Fixed */}
        <div className="panel p-4 flex flex-col justify-between border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/20 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Fixed Issues</span>
            <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
              <CircleCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-700 dark:text-emerald-300 font-mono">
            {s.fixed}
          </div>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400 font-medium mt-0.5">{fixRate}% completion rate</p>
        </div>

        {/* Still Open */}
        <div className="panel p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Still Open</span>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">
            {s.open}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Active or waiting</p>
        </div>

        {/* Average Rating */}
        <div className="panel p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Average Rating</span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-500">
              <Star className="w-4 h-4 fill-amber-400" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-amber-500 font-mono flex items-center gap-1">
            <span>{s.avgRating ? Number(s.avgRating).toFixed(1) : '4.0'}</span>
            <span className="text-xs font-normal text-slate-400">/ 5</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Campus feedback</p>
        </div>
      </div>

      {/* ── 3. Visual Domain Breakdown & Hotspot Buildings ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Visual Problems by Problem Domain */}
        <div className="panel p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  Issues by Problem Domain
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Distribution of maintenance requests across service cells.
                </p>
              </div>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {cats.length} Domains
              </span>
            </div>

            <div className="space-y-3.5">
              {cats.map((c) => {
                const Icon = getCatIcon(c.label || c.key);
                const percent = s.reported > 0 ? Math.round((c.reported / s.reported) * 100) : 0;

                return (
                  <div key={c.key || c.label} className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {c.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                          {c.reported} {c.reported === 1 ? 'issue' : 'issues'}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400">
                          ({percent}%)
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                        style={{ width: `${Math.max(6, percent)}%` }}
                      />
                    </div>

                    {/* Sub statistics: Fixed and Urgent */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        ✓ {c.fixed} Fixed
                      </span>
                      {c.urgent > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" /> {c.urgent} Urgent
                        </span>
                      ) : (
                        <span className="text-slate-400">0 Urgent</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {cats.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400 font-medium">
                  No issues reported in this time period.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Campus Hotspots (Where Problems Happen) */}
        <div className="panel p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  Campus Hotspot Areas
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Locations and hostel blocks with reported maintenance needs.
                </p>
              </div>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {places.length} Locations
              </span>
            </div>

            <div className="space-y-3">
              {places.map((p, idx) => {
                const percent = s.reported > 0 ? Math.round((p.count / s.reported) * 100) : 0;

                return (
                  <div key={p.place} className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                          idx === 0
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-extrabold'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}>
                          #{idx + 1}
                        </span>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {p.place}
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {p.count} {p.count === 1 ? 'issue' : 'issues'}
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-sky-500 transition-all duration-500"
                        style={{ width: `${Math.max(6, percent)}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {places.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400 font-medium">
                  No location hot-spots logged yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Technician Performance Leaderboard (Clean Performance Overview) ── */}
      <div className="panel p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <span>Technician Performance Leaderboard</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Completed repairs, resolution rates, and feedback ratings.
            </p>
          </div>
          {topPerformer && (
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-bold shadow-2xs">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
              <span>Top Fixer: {topPerformer.name} ({topPerformer.fixed} fixes)</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {sortedTechs.map((t, idx) => {
            const fixPercent = t.given > 0 ? Math.round((t.fixed / t.given) * 100) : 100;
            const initials = (t.name || 'T').split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase();

            return (
              <div
                key={t.firebaseId || t.id || idx}
                className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0">
                      {initials}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {t.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {t.dept || 'Staff'}
                      </p>
                    </div>
                  </div>
                  {idx === 0 && t.fixed > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 shrink-0">
                      ★ #1 Leader
                    </span>
                  )}
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-1 py-2 px-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 text-center">
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Given</div>
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono mt-0.5">{t.given}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">Fixed</div>
                    <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">{t.fixed}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-amber-500 font-bold uppercase">Rating</div>
                    <div className="text-sm font-bold text-amber-500 font-mono mt-0.5 flex items-center justify-center gap-0.5">
                      <Star className="w-3 h-3 fill-amber-400" />
                      <span>{t.avgRating ? t.avgRating.toFixed(1) : '–'}</span>
                    </div>
                  </div>
                </div>

                {/* Fix rate bar */}
                <div>
                  <div className="flex items-center justify-between text-[10.5px] text-slate-500 dark:text-slate-400 mb-1 font-medium">
                    <span>Resolution rate</span>
                    <span className="font-bold font-mono">{fixPercent}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${fixPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {sortedTechs.length === 0 && (
            <div className="col-span-3 text-center py-8 text-xs text-slate-400 font-medium">
              No technicians registered yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
