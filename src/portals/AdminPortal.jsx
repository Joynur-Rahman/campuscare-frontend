import { useState, useCallback } from 'react';
import { LayoutDashboard, Ticket, HardHat, BarChart3, UserCog } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { useSubscription } from '../hooks/useSubscription.js';
import TicketDetailModal from '../components/TicketDetailModal.jsx';
import AdminDashboard from './admin/AdminDashboard.jsx';
import AdminTickets from './admin/AdminTickets.jsx';
import AdminTechnicians from './admin/AdminTechnicians.jsx';
import AdminReports from './admin/AdminReports.jsx';
import AdminManage from './admin/AdminManage.jsx';

const TABS = [
  { key: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard, title: 'Dashboard', sub: 'Live overview of campus issues.' },
  { key: 'tickets', label: 'Tickets', Icon: Ticket, title: 'Tickets', sub: 'Every open problem. Give each one to a technician.' },
  { key: 'technicians', label: 'Technicians', Icon: HardHat, title: 'Technicians', sub: 'Audit each technician\'s performance.' },
  { key: 'reports', label: 'Reports', Icon: BarChart3, title: 'Reports', sub: 'Summary, problem types, places and technician performance.' },
  { key: 'manage', label: 'Manage Users', Icon: UserCog, title: 'Manage Users', sub: 'Create and manage staff accounts.' },
];

export default function AdminPortal() {
  const { api } = useApp();
  const [tab, setTab] = useState('dashboard');
  const [ticketFilter, setTicketFilter] = useState('all');
  const [open, setOpen] = useState(null);

  const ticketsSub = useCallback((cb, e, s) => api.subscribeToTickets({ role: 'admin' }, cb, e, s), [api]);
  const techsSub = useCallback((cb, e, s) => api.subscribeToTechnicians(null, cb, e, s), [api]);
  const membersSub = useCallback((cb, e, s) => api.subscribeToCampusMembers(cb, e, s), [api]);
  const { data: tickets, loading } = useSubscription(ticketsSub, []);
  const { data: techs } = useSubscription(techsSub, []);
  const { data: members } = useSubscription(membersSub, []);

  const meta = TABS.find(t => t.key === tab);

  const handleNavigate = (targetTab, filterKey = 'all') => {
    setTab(targetTab);
    if (filterKey) setTicketFilter(filterKey);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div>
        <h1 className="page-title">{meta.title}</h1>
        <p className="page-sub">{meta.sub}</p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors cursor-pointer ${
              tab === t.key
                ? 'bg-iiitg-800 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <t.Icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-sm text-slate-400 py-14">Loading…</p>
      ) : (
        <>
          {tab === 'dashboard' && (
            <AdminDashboard
              tickets={tickets || []}
              techs={techs || []}
              onNavigate={handleNavigate}
              onOpen={setOpen}
            />
          )}
          {tab === 'tickets' && (
            <AdminTickets
              tickets={tickets || []}
              techs={techs || []}
              onOpen={setOpen}
              activeFilter={ticketFilter}
              onFilterChange={setTicketFilter}
            />
          )}
          {tab === 'technicians' && (
            <AdminTechnicians
              tickets={tickets || []}
              techs={techs || []}
            />
          )}
          {tab === 'reports' && (
            <AdminReports
              tickets={tickets || []}
              techs={techs || []}
            />
          )}
          {tab === 'manage' && (
            <AdminManage
              techs={techs || []}
              members={members || []}
            />
          )}
        </>
      )}

      {open && <TicketDetailModal ticket={open} onClose={() => setOpen(null)} techs={techs || []} />}
    </div>
  );
}
