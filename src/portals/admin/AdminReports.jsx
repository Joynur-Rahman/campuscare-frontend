import { Ticket, CircleCheck, Clock, Star } from 'lucide-react';
import { StatTile, Section, Table } from '../../components/admin/Bits.jsx';
import { summary, byCategory, byPlace, techStats } from '../../lib/adminMetrics.js';

export default function AdminReports({ tickets, techs }) {
  const s = summary(tickets);
  const cats = byCategory(tickets);
  const places = byPlace(tickets);
  const trows = techStats(tickets, techs);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile icon={Ticket} label="Reported" value={s.reported} />
        <StatTile icon={CircleCheck} label="Fixed" value={s.fixed} color="text-emerald-700" />
        <StatTile icon={Clock} label="Still open" value={s.open} color="text-blue-700" />
        <StatTile icon={Star} label="Avg. rating" value={s.avgRating ? '★ ' + s.avgRating.toFixed(1) : '–'} color="text-amber-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="By problem type">
          <Table
            heads={['Type', { label: 'Reported', center: true }, { label: 'Fixed', center: true }, { label: 'Urgent', center: true }]}
            rows={cats.map(c => [
              <span className="font-semibold text-slate-800 dark:text-slate-100">{c.label}</span>,
              <span className="font-bold text-slate-700 dark:text-slate-200">{c.reported}</span>,
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{c.fixed}</span>,
              <span className={`font-bold ${c.urgent > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400'}`}>{c.urgent}</span>
            ])}
            empty="No tickets yet."
          />
        </Section>
        <Section title="By building / place" sub="Where problems were reported">
          <div className="place-compact">
            {places.map((p, i) => <div key={i} className="place-row"><span className="truncate">{p.place}</span><b>{p.count}</b></div>)}
            {places.length === 0 && <p className="text-xs text-slate-400 py-2">No tickets yet.</p>}
          </div>
        </Section>
      </div>

      <Section title="Technician performance" sub="Given, fixed, reopened and average rating per technician">
        <Table
          heads={['Technician', 'Team', { label: 'Given', center: true }, { label: 'Fixed', center: true }, { label: 'Reopened', center: true }, { label: 'Rating', center: true }]}
          rows={trows.map(r => [
            <span className="font-semibold text-slate-800 dark:text-slate-100">{r.name}</span>,
            <span className="text-slate-600 dark:text-slate-300">{r.dept || '—'}</span>,
            <span className="font-medium text-slate-700 dark:text-slate-200">{r.given}</span>,
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{r.fixed}</span>,
            <span className="text-slate-400">{r.reopened || '–'}</span>,
            r.avgRating ? (
              <span className="text-amber-500 font-bold inline-flex items-center justify-center gap-1">
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                {r.avgRating.toFixed(1)}
              </span>
            ) : (
              <span className="text-slate-400">–</span>
            )
          ])}
          empty="No technicians yet."
        />
      </Section>
    </div>
  );
}
