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
          <Table heads={['Type', { label: 'Reported', right: true }, { label: 'Fixed', right: true }, { label: 'Urgent', right: true }]}
            rows={cats.map(c => [c.label, c.reported, c.fixed, c.urgent])} empty="No tickets yet." />
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
          heads={['Technician', 'Team', { label: 'Given', right: true }, { label: 'Fixed', right: true }, { label: 'Reopened', right: true }, { label: 'Rating', right: true }]}
          rows={trows.map(r => [r.name, r.dept || '—', r.given, r.fixed, r.reopened || '–', r.avgRating ? '★ ' + r.avgRating.toFixed(1) : '–'])}
          empty="No technicians yet." />
      </Section>
    </div>
  );
}
