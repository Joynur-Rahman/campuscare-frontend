import { Ticket, CircleCheck, Clock, Star, Siren, MapPin, Tag, Users, Download } from 'lucide-react';
import { summary, byCategory, byPlace, techStats } from '../../lib/adminMetrics.js';
import { deptInfo } from '../../lib/departments.js';

function Card({ title, sub, Icon, right, children, className = '' }) {
  return (
    <section className={`rounded-2xl bg-[#fcfdfd] dark:bg-[#121417] border border-[#bfd0cc] dark:border-[#2a2e35] shadow-xs p-4 flex flex-col min-h-0 ${className}`}>
      <div className="flex items-center justify-between gap-2.5 mb-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-[#e3ebe9] dark:bg-white/10 text-[#2f4e56] dark:text-[#b9bec9] flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></span>
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{title}</h3>
            {sub && <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{sub}</p>}
          </div>
        </div>
        {right}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto custom-ticket-scrollbar -mr-1 pr-1">{children}</div>
    </section>
  );
}

function Meter({ value, max, color }) {
  return (
    <div className="h-2.5 rounded-full bg-[#e3ebe9] dark:bg-white/10 overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${max ? Math.max(6, (value / max) * 100) : 0}%`, background: color }} />
    </div>
  );
}

export default function AdminReports({ tickets = [], techs = [] }) {
  const s = summary(tickets);
  const cats = byCategory(tickets);
  const places = byPlace(tickets);
  const trows = techStats(tickets, techs);
  const maxCat = Math.max(1, ...cats.map(c => c.reported));
  const maxPlace = Math.max(1, ...places.map(p => p.count));
  const fixRate = s.reported ? Math.round((s.fixed / s.reported) * 100) : 0;

  const exportCsv = () => {
    const headers = ['Ticket ID', 'Title', 'Category', 'Location', 'Status', 'Priority', 'Assigned Staff', 'Rating'];
    const rows = tickets.map(t => [
      t.id || '',
      `"${String(t.title || t.categoryDisplay || '').replace(/"/g, '""')}"`,
      `"${String(t.category || '').replace(/"/g, '""')}"`,
      `"${String(t.location || '').replace(/"/g, '""')}"`,
      t.status || '',
      t.priority || 'Normal',
      `"${String(t.assignedToName || 'Unassigned').replace(/"/g, '""')}"`,
      t.rating || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campuscare-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tiles = [
    { Icon: Ticket, label: 'Reported', value: s.reported, tone: 'text-slate-900 dark:text-white' },
    { Icon: CircleCheck, label: 'Fixed', value: s.fixed, sub: `${fixRate}% resolution rate`, tone: 'text-emerald-600 dark:text-emerald-300' },
    { Icon: Clock, label: 'Still open', value: s.open, tone: 'text-sky-600 dark:text-sky-300' },
    { Icon: Siren, label: 'Urgent open', value: s.urgent, tone: 'text-rose-600 dark:text-rose-300' },
    { Icon: Star, label: 'Rating', value: s.avgRating ? `★ ${s.avgRating.toFixed(1)}` : '–', tone: 'text-amber-600 dark:text-amber-300' },
  ];

  return (
    <div className="space-y-2.5 lg:space-y-0 lg:gap-2.5 lg:flex lg:flex-col lg:h-full lg:min-h-0">
      {/* Top KPI + Export Strip */}
      <div className="shrink-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {tiles.map(t => (
          <div key={t.label} className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-[#15171a] border border-slate-200/90 dark:border-[#2a2e35] shadow-2xs">
            <span className="w-8 h-8 rounded-lg bg-[#e3ebe9] dark:bg-white/10 text-[#2f4e56] dark:text-[#b9bec9] flex items-center justify-center shrink-0"><t.Icon className="w-4 h-4" /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">{t.label}</span>
              {t.sub && <span className="block text-[10.5px] font-medium text-slate-500 dark:text-slate-400 truncate">{t.sub}</span>}
            </span>
            <span className={`text-xl font-black leading-none ${t.tone}`}>{t.value}</span>
          </div>
        ))}
      </div>

      {/* Balanced 2-Row Analytics Workspace (No empty right-column void) */}
      <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3 rounded-2xl sm:rounded-3xl p-2.5 sm:p-4 bg-[#d3dfdc]/80 dark:bg-[#101214]/90 border border-[#c3d2ce] dark:border-[#2a2e35] overflow-y-auto custom-ticket-scrollbar">
        {/* Row 1: Side-by-Side Problem Types (6 cols) + Building Hotspots (6 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 shrink-0">
          <Card title="By problem type" sub="Reported, fixed and urgent per category" Icon={Tag} className="lg:col-span-6">
            {cats.length === 0 ? <p className="text-xs text-slate-400 py-3">No tickets yet.</p> : (
              <div className="space-y-3">
                {cats.map(c => (
                  <div key={c.key} className="grid grid-cols-[minmax(0,9.5rem)_1fr_auto] items-center gap-3">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{c.label}</span>
                    <Meter value={c.reported} max={maxCat} color="#2f4e56" />
                    <span className="flex items-center gap-2 text-xs whitespace-nowrap font-semibold">
                      <b className="text-slate-900 dark:text-white">{c.reported}</b>
                      <span className="text-emerald-600 dark:text-emerald-300">✓ {c.fixed}</span>
                      {c.urgent > 0 && <span className="text-rose-600 dark:text-rose-300 font-bold">! {c.urgent}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="By building / place" sub="Campus hotspots with the most reports" Icon={MapPin} className="lg:col-span-6">
            {places.length === 0 ? <p className="text-xs text-slate-400 py-3">No tickets yet.</p> : (
              <div className="space-y-3">
                {places.map(p => (
                  <div key={p.place} className="grid grid-cols-[minmax(0,9.5rem)_1fr_auto] items-center gap-3">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{p.place}</span>
                    <Meter value={p.count} max={maxPlace} color="#0284c7" />
                    <b className="text-xs font-extrabold text-slate-900 dark:text-white w-6 text-right">{p.count}</b>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Row 2: Full-Width Staff Performance Table with Progress Bars & CSV Export */}
        <Card
          title="Staff performance"
          sub="Workload distribution, resolution rate, reopened tickets and student ratings"
          Icon={Users}
          className="flex-1 min-h-[220px]"
          right={
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 bg-[#2f4e56] hover:bg-[#243d43] text-white shadow-2xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          }
        >
          {trows.length === 0 ? <p className="text-xs text-slate-400 py-3">No staff yet.</p> : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#fcfdfd] dark:bg-[#121417]">
                <tr className="text-[10.5px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="text-left py-2 font-extrabold">Name</th>
                  <th className="text-left py-2 font-extrabold hidden sm:table-cell">Role · Department</th>
                  <th className="text-center py-2 font-extrabold">Given</th>
                  <th className="text-center py-2 font-extrabold">Fixed</th>
                  <th className="text-left py-2 px-3 font-extrabold hidden md:table-cell w-44">Completion</th>
                  <th className="text-center py-2 font-extrabold">Reopened</th>
                  <th className="text-center py-2 font-extrabold">Rating</th>
                </tr>
              </thead>
              <tbody>
                {trows.map(r => {
                  const pct = r.given ? Math.round((r.fixed / r.given) * 100) : 0;
                  return (
                    <tr key={r.firebaseId || r.id} className="border-t border-[#e6eeeb] dark:border-[#2a2e35] hover:bg-slate-50/70 dark:hover:bg-white/5">
                      <td className="py-2.5 font-bold text-slate-900 dark:text-white">{r.name}</td>
                      <td className="py-2.5 text-slate-600 dark:text-slate-300 hidden sm:table-cell truncate max-w-[16rem]">{deptInfo(r.dept).role} · {r.dept || '—'}</td>
                      <td className="py-2.5 text-center font-bold text-slate-800 dark:text-slate-100">{r.given}</td>
                      <td className="py-2.5 text-center font-bold text-emerald-600 dark:text-emerald-300">{r.fixed}</td>
                      <td className="py-2.5 px-3 hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${r.given ? Math.max(8, pct) : 0}%` }} />
                          </div>
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 w-9 text-right">{r.given ? `${pct}%` : '—'}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-center text-slate-500">{r.reopened || '–'}</td>
                      <td className="py-2.5 text-center">{r.avgRating ? <span className="font-bold text-amber-600 dark:text-amber-300">★ {r.avgRating.toFixed(1)}</span> : <span className="text-slate-400">–</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
