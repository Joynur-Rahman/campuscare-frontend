import { Ticket, Clock, CircleCheck, UserCog, Flame, Star } from 'lucide-react';
import { StatTile, Section, BarList } from '../../components/admin/Bits.jsx';
import { summary, byCategory, byPlace } from '../../lib/adminMetrics.js';

const STATUS_COLORS = { Pending: '#f59e0b', 'In Progress': '#3b82f6', Resolved: '#10b981' };

export default function AdminDashboard({ tickets }) {
  const s = summary(tickets);
  const cats = byCategory(tickets).slice(0, 6).map(c => ({ label: c.label, value: c.reported, color: '#4f46e5' }));
  const isResolved = t => ['resolved', 'done'].includes((t?.status || '').toLowerCase().trim());
  const isInProgress = t => ['in progress', 'in_progress'].includes((t?.status || '').toLowerCase().trim());
  const isWaiting = t => !isResolved(t) && !isInProgress(t);
  const byStatus = [
    { label: 'Waiting', value: tickets.filter(isWaiting).length, color: '#f59e0b' },
    { label: 'Being fixed', value: tickets.filter(isInProgress).length, color: '#3b82f6' },
    { label: 'Fixed', value: tickets.filter(isResolved).length, color: '#10b981' },
  ];
  const places = byPlace(tickets).slice(0, 6).map(p => ({ label: p.place, value: p.count, color: '#0ea5e9' }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatTile icon={Ticket} label="Reported" value={s.reported} />
        <StatTile icon={Clock} label="Open now" value={s.open} color="text-blue-700" />
        <StatTile icon={UserCog} label="Not assigned" value={s.unassigned} color="text-amber-700" />
        <StatTile icon={Flame} label="Urgent" value={s.urgent} color="text-rose-700" />
        <StatTile icon={CircleCheck} label="Resolved" value={s.fixed} color="text-emerald-700" />
        <StatTile icon={Star} label="Avg. rating" value={s.avgRating ? '★ ' + s.avgRating.toFixed(1) : '–'} color="text-amber-600" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Tickets by status" sub="Live breakdown of where every ticket stands">
          <BarList items={byStatus} />
        </Section>
        <Section title="Tickets by problem type" sub="Which teams get the most work">
          <BarList items={cats} />
        </Section>
      </div>
      <Section title="Hot-spots — places with the most reports" sub="Where problems cluster, so repairs can be planned">
        <BarList items={places} />
      </Section>
    </div>
  );
}
