import { useState, useCallback } from 'react';
import { ClipboardList, Users, Search, Plus, Inbox } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { useSubscription } from '../hooks/useSubscription.js';
import TicketCard from '../components/TicketCard.jsx';
import TicketDetailModal from '../components/TicketDetailModal.jsx';
import ReportModal from '../components/ReportModal.jsx';
import LostFoundModal from '../components/LostFoundModal.jsx';
import { isLostFound, createdMs } from '../lib/ticketUtils.js';

const TABS = [
  { key: 'Mine', label: 'My Tickets', title: 'My Tickets', sub: "Problems you reported, and how they're going." },
  { key: 'Community', label: 'Shared Issues', title: 'Shared Issues', sub: 'Public issues affecting many people. Press "Me too" instead of reporting again.' },
  { key: 'LostFound', label: 'Lost & Found', title: 'Lost & Found', sub: 'Lost or found something on campus? Posted here for everyone.' },
];

export default function StudentPortal() {
  const { api, user, showToast } = useApp();
  const [tab, setTab] = useState('Mine');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [report, setReport] = useState(false);
  const [lf, setLf] = useState(false);

  const subscribe = useCallback(
    (cb, onErr, onSync) => api.subscribeToTickets({ role: 'student', uid: user?.uid, email: user?.email }, cb, onErr, onSync),
    [api, user?.uid, user?.email]
  );
  const { data: all, loading } = useSubscription(subscribe, [user?.uid]);

  const myUid = user?.id || user?.uid;
  const myEmail = (user?.email || '').toLowerCase();
  const mineIds = new Set(
    all.filter(t =>
      (myUid && (t.userId === myUid || t.owner_id === myUid)) ||
      (myEmail && (t.userEmail || '').toLowerCase() === myEmail)
    ).map(t => t.id)
  );
  let list = all.filter(t => {
    if (tab === 'Mine') return mineIds.has(t.id);
    if (tab === 'LostFound') return t.isPublic && isLostFound(t);
    return t.isPublic && !isLostFound(t);
  });
  if (q.trim()) {
    const s = q.toLowerCase();
    list = list.filter(t => `${t.id} ${t.categoryDisplay} ${t.description} ${t.location}`.toLowerCase().includes(s));
  }
  list = [...list].sort((a, b) => createdMs(b) - createdMs(a));

  const meInfo = TABS.find(t => t.key === tab);

  async function meToo(t) {
    try { const r = await api.joinTicket(t.id); showToast(`Added you. ${r.count} people affected.`, 'success'); }
    catch (e) { showToast(e.message, 'warning'); }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">{meInfo.title}</h1>
          <p className="page-sub">{meInfo.sub}</p>
        </div>
        <button onClick={() => (tab === 'LostFound' ? setLf(true) : setReport(true))} className="inline-flex items-center gap-2 px-4 py-2.5 bg-iiitg-800 hover:bg-iiitg-900 text-white text-sm font-bold rounded-xl shadow-md">
          <Plus className="w-4 h-4 text-iiitg-gold" /> {tab === 'LostFound' ? 'Post item' : 'Report Issue'}
        </button>
      </div>

      {/* tabs */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {TABS.map(t => {
          const Icon = t.key === 'Mine' ? ClipboardList : t.key === 'Community' ? Users : Search;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${tab === t.key ? 'bg-iiitg-800 text-white shadow' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'LostFound' && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0"><Search className="w-5 h-5 text-amber-700" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900">Lost or found something on campus?</p>
            <p className="text-xs text-slate-500">Post it here so everyone can see it — the fastest way to reunite an item with its owner.</p>
          </div>
          <button onClick={() => setLf(true)} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl shrink-0">
            <Plus className="w-4 h-4" /> Post item
          </button>
        </div>
      )}

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by ID, issue or location…"
          className="w-full pl-10 pr-4 py-3 text-sm bg-white border border-slate-200 rounded-xl shadow-sm input-enhanced focus:outline-none" />
      </div>

      {loading ? (
        <p className="text-center text-sm text-slate-400 py-14">Loading…</p>
      ) : list.length === 0 ? (
        <div className="text-center py-14 px-6 bg-white rounded-2xl border border-slate-200 border-dashed">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-50 flex items-center justify-center mb-3"><Inbox className="w-7 h-7 text-slate-300" /></div>
          <h3 className="text-sm font-bold text-slate-900 mb-1">Nothing here yet</h3>
          <p className="text-xs text-slate-500">{tab === 'Mine' ? 'Report an issue and track the fix here.' : 'Items will appear here.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {list.map(t => (
            <TicketCard key={t.id} t={t} onOpen={setOpen}
              action={tab === 'Community' && t.userId !== user?.uid
                ? <button onClick={() => meToo(t)} className="px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg">Me too</button>
                : null} />
          ))}
        </div>
      )}

      {open && <TicketDetailModal ticket={open} onClose={() => setOpen(null)} />}
      {report && <ReportModal onClose={() => setReport(false)} onCreated={() => setTab('Mine')} />}
      {lf && <LostFoundModal onClose={() => setLf(false)} onCreated={() => setTab('LostFound')} />}
    </div>
  );
}
