import { useState, useCallback, useEffect } from 'react';
import { LayoutDashboard, Ticket, HardHat, BarChart3, UserCog } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { useSubscription } from '../hooks/useSubscription.js';
import TicketDetailModal from '../components/TicketDetailModal.jsx';
import AssignMenu from '../components/admin/AssignMenu.jsx';
import AdminDashboard from './admin/AdminDashboard.jsx';
import AdminTickets from './admin/AdminTickets.jsx';
import AdminTechnicians from './admin/AdminTechnicians.jsx';
import AdminReports from './admin/AdminReports.jsx';
import AdminManage from './admin/AdminManage.jsx';

const TABS = [
  { key: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard, title: 'Dashboard', sub: 'Campus issues at a glance.' },
  { key: 'tickets', label: 'Tickets', Icon: Ticket, title: 'Tickets', sub: 'Assign each problem to the right department.' },
  { key: 'technicians', label: 'Staff', Icon: HardHat, title: 'Staff', sub: 'Technicians, offices, committees and counsellors.' },
  { key: 'reports', label: 'Reports', Icon: BarChart3, title: 'Reports', sub: 'Summary, problem types, hotspots and staff performance.' },
  { key: 'manage', label: 'Manage Users', Icon: UserCog, title: 'Manage Users', sub: 'Create and manage accounts across campus departments.' },
];

export default function AdminPortal() {
  const { api, ticketModal, closeTicket } = useApp();
  const [tab, setTab] = useState('dashboard');
  const [open, setOpen] = useState(null);
  const [ticketFilter, setTicketFilter] = useState('all');
  const go = (t, f) => { if (f) setTicketFilter(f); setTab(t); };

  const ticketsSub = useCallback((cb, e, s) => api.subscribeToTickets({ role: 'admin' }, cb, e, s), [api]);
  const techsSub = useCallback((cb, e, s) => api.subscribeToTechnicians(null, cb, e, s), [api]);
  const membersSub = useCallback((cb, e, s) => api.subscribeToCampusMembers(cb, e, s), [api]);
  const { data: tickets, loading } = useSubscription(ticketsSub, []);
  const { data: techs } = useSubscription(techsSub, []);
  const { data: members } = useSubscription(membersSub, []);

  // Listen to global open ticket triggers from TopNav messages / notifications
  useEffect(() => {
    if (ticketModal) {
      const full = (tickets || []).find(t => String(t.id) === String(ticketModal.id)) || ticketModal;
      setOpen(full);
      closeTicket();
    }
  }, [ticketModal, closeTicket, tickets]);

  const meta = TABS.find(t => t.key === tab) || TABS[0];

  return (
    <div className="app-container px-4 sm:px-6 lg:px-8 pt-2.5 sm:pt-3 pb-2 space-y-2.5 lg:space-y-0 lg:gap-2.5 lg:flex lg:flex-col lg:h-[calc(100dvh-66px)]">
      {/* ── Merged Single-Row Header: Title (left) + Segmented Tabs (right) ── */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex items-baseline gap-2.5">
          <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white leading-none">
            {meta.title}
          </h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate hidden sm:inline">
            {meta.sub}
          </p>
        </div>

        <div className="p-1 rounded-2xl bg-[#e3ebe9]/95 dark:bg-[#121417] border border-[#d6ded7] dark:border-[#2a2e35] inline-flex gap-1 overflow-x-auto no-scrollbar max-w-full shadow-2xs">
          {TABS.map(t => {
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => { setTab(t.key); setTicketFilter('all'); }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#2f4e56] text-white shadow-xs dark:bg-indigo-600'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-[#d6ded7]/60 dark:hover:bg-[#1d2024]'
                }`}
              >
                <t.Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <p className="text-center text-sm text-slate-400 py-14">Loading…</p>
      ) : (
        <>
          {tab === 'dashboard' && <div className="cc-page-in lg:flex-1 lg:min-h-0"><AdminDashboard tickets={tickets} techs={techs} onOpen={setOpen} onGo={go} /></div>}
          {tab === 'tickets' && <div className="cc-page-in lg:flex-1 lg:min-h-0"><AdminTickets key={ticketFilter} tickets={tickets} techs={techs} onOpen={setOpen} initialFilter={ticketFilter} /></div>}
          {tab === 'technicians' && <div className="cc-page-in lg:flex-1 lg:min-h-0"><AdminTechnicians tickets={tickets} techs={techs} /></div>}
          {tab === 'reports' && <div className="cc-page-in lg:flex-1 lg:min-h-0"><AdminReports tickets={tickets} techs={techs} /></div>}
          {tab === 'manage' && <div className="cc-page-in lg:flex-1 lg:min-h-0"><AdminManage techs={techs} members={members} /></div>}
        </>
      )}

      {open && (
        <TicketDetailModal
          ticket={open}
          onClose={() => setOpen(null)}
          action={<AssignMenu ticket={open} techs={techs} onAssigned={patch => setOpen(prev => prev ? { ...prev, ...patch, status: prev.status } : prev)} />}
        />
      )}
    </div>
  );
}
