import { useState, useMemo } from 'react';
import {
  Users, HardHat, Power, KeyRound, Trash2, Star, Search,
  Phone, CheckCircle2, Clock, Wrench, ShieldCheck, AlertCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { techStats } from '../../lib/adminMetrics.js';
import { fmtPhone } from '../../lib/ticketUtils.js';

export default function AdminTechnicians({ tickets = [], techs = [] }) {
  const { api, showToast } = useApp();
  const [busy, setBusy] = useState(null);
  const [optimisticDuty, setOptimisticDuty] = useState({});
  const [statusTab, setStatusTab] = useState('all'); // 'all' | 'on_duty' | 'off_duty'
  const [query, setQuery] = useState('');

  const enrichedTechs = useMemo(() => {
    return (techs || []).map(t => {
      const tid = t.clerk_id || t.id || t.firebaseId;
      return optimisticDuty[tid] ? { ...t, status: optimisticDuty[tid] } : t;
    });
  }, [techs, optimisticDuty]);

  const rows = useMemo(() => {
    return techStats(tickets, enrichedTechs);
  }, [tickets, enrichedTechs]);

  // Overall fleet stats (simple, friendly terms)
  const totalTechs = enrichedTechs.length;
  const onDutyCount = enrichedTechs.filter(t => !t.status || t.status === 'On Duty').length;
  const offDutyCount = totalTechs - onDutyCount;
  const totalFixed = rows.reduce((acc, r) => acc + (r.fixed || 0), 0);
  const ratedRows = rows.filter(r => r.avgRating > 0);
  const avgRating = ratedRows.length > 0
    ? (ratedRows.reduce((acc, r) => acc + r.avgRating, 0) / ratedRows.length).toFixed(1)
    : '4.0';

  // Filtered rows
  const q = query.trim().toLowerCase();
  const filteredRows = rows.filter(r => {
    // 1. Status Tab filter
    const isOnDuty = !r.status || r.status === 'On Duty';
    if (statusTab === 'on_duty' && !isOnDuty) return false;
    if (statusTab === 'off_duty' && isOnDuty) return false;

    // 2. Search query filter
    if (q) {
      const name = (r.name || '').toLowerCase();
      const dept = (r.dept || '').toLowerCase();
      const phone = (r.phone || '').toLowerCase();
      if (!name.includes(q) && !dept.includes(q) && !phone.includes(q)) return false;
    }

    return true;
  });

  async function toggle(tech) {
    const id = tech.clerk_id || tech.id || tech.firebaseId;
    setBusy(id);
    const next = tech.status === 'On Duty' ? 'Off Duty' : 'On Duty';
    setOptimisticDuty(prev => ({ ...prev, [id]: next }));
    try {
      await api.updateTechnicianStatus(id, next);
      showToast(`${tech.name || tech.full_name} is now ${next}.`, 'success');
    } catch (e) {
      setOptimisticDuty(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      showToast(e.message || 'Failed to update duty status', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function reset(tech) {
    const id = tech.firebaseId || tech.clerk_id || tech.id;
    setBusy(id);
    try {
      const r = await api.resetTechnicianPassword(id);
      showToast(`Temporary password for ${tech.name || tech.full_name}: ${r?.tempPassword || 'sent'}`, 'success');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  }

  async function remove(tech) {
    const id = tech.firebaseId || tech.clerk_id || tech.id;
    if (!window.confirm(`Are you sure you want to remove technician ${tech.name || tech.full_name}?`)) return;
    setBusy(id);
    try {
      await api.deleteTechnician(id);
      showToast(`${tech.name || tech.full_name} removed.`, 'success');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* ── 1. Top Technician Overview Cards (Simple & Clear) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="panel p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Technicians</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
            {totalTechs}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Registered staff</p>
        </div>

        <div className="panel p-4 flex flex-col justify-between border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/20 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">On Duty Now</span>
            <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-700 dark:text-emerald-300 font-mono">
            {onDutyCount}
          </div>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400 font-medium mt-0.5">Ready for work</p>
        </div>

        <div className="panel p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Off Duty</span>
            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-700 dark:text-slate-300 font-mono">
            {offDutyCount}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Currently inactive</p>
        </div>

        <div className="panel p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Average Rating</span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-500">
              <Star className="w-4 h-4 fill-amber-400" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-amber-500 font-mono flex items-center gap-1">
            <span>{avgRating}</span>
            <span className="text-xs font-normal text-slate-400">/ 5</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Based on ratings</p>
        </div>
      </div>

      {/* ── 2. Search & Status Filter Controls ── */}
      <div className="panel p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              Technician Workload &amp; Performance
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live status, assigned tasks, fixes, and duty controls.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick status tabs */}
            <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold">
              <button
                onClick={() => setStatusTab('all')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  statusTab === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                All ({totalTechs})
              </button>
              <button
                onClick={() => setStatusTab('on_duty')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  statusTab === 'on_duty'
                    ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                On Duty ({onDutyCount})
              </button>
              <button
                onClick={() => setStatusTab('off_duty')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  statusTab === 'off_duty'
                    ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Off Duty ({offDutyCount})
              </button>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by name, team, phone…"
                className="w-48 sm:w-56 pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* ── 3. High-Contrast Technician Roster Table ── */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10.5px]">
                <th className="text-left py-3 px-3">Technician</th>
                <th className="text-left py-3 px-3">Team</th>
                <th className="text-center py-3 px-3">Duty Status</th>
                <th className="text-center py-3 px-3">Given</th>
                <th className="text-center py-3 px-3">Fixed</th>
                <th className="text-center py-3 px-3">Active</th>
                <th className="text-center py-3 px-3">Progress</th>
                <th className="text-center py-3 px-3">Rating</th>
                <th className="text-right py-3 px-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredRows.map(r => {
                const isOnDuty = !r.status || r.status === 'On Duty';
                const fixRate = r.given > 0 ? Math.round((r.fixed / r.given) * 100) : 100;
                const initials = (r.name || 'T').split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase();

                return (
                  <tr key={r.firebaseId || r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    {/* Technician Name & Avatar */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center">
                            {initials}
                          </div>
                          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                            isOnDuty ? 'bg-emerald-500' : 'bg-slate-400'
                          }`} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                            {r.name}
                          </div>
                          {r.phone && (
                            <a
                              href={`tel:${r.phone}`}
                              className="text-[11px] font-mono text-slate-500 dark:text-slate-400 hover:text-indigo-600 flex items-center gap-1 mt-0.5"
                            >
                              <Phone className="w-2.5 h-2.5" />
                              <span>{fmtPhone(r.phone)}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Team */}
                    <td className="py-3.5 px-3">
                      <span className="inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {r.dept || 'General Staff'}
                      </span>
                    </td>

                    {/* Duty Status */}
                    <td className="py-3.5 px-3 text-center">
                      <button
                        disabled={busy === (r.firebaseId || r.id)}
                        onClick={() => toggle(r)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold border transition-all cursor-pointer active:scale-95 shadow-2xs ${
                          isOnDuty
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                            : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                        }`}
                        title="Click to toggle On/Off duty"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isOnDuty ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                        <span>{isOnDuty ? 'On Duty' : 'Off Duty'}</span>
                      </button>
                    </td>

                    {/* Given */}
                    <td className="py-3.5 px-3 text-center font-bold text-slate-700 dark:text-slate-300 font-mono">
                      {r.given}
                    </td>

                    {/* Fixed */}
                    <td className="py-3.5 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {r.fixed}
                    </td>

                    {/* Active */}
                    <td className="py-3.5 px-3 text-center font-bold text-blue-600 dark:text-blue-400 font-mono">
                      {r.active}
                    </td>

                    {/* Progress Bar */}
                    <td className="py-3.5 px-3 text-center min-w-[100px]">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                            style={{ width: `${fixRate}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
                          {fixRate}%
                        </span>
                      </div>
                    </td>

                    {/* Rating */}
                    <td className="py-3.5 px-3 text-center">
                      {r.avgRating ? (
                        <span className="inline-flex items-center justify-center gap-1 font-bold text-amber-500 text-xs">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{r.avgRating.toFixed(1)}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">–</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <button
                          disabled={busy === (r.firebaseId || r.id)}
                          onClick={() => reset(r)}
                          title="Reset technician login password"
                          className="px-2 py-1 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                        >
                          <KeyRound className="w-3 h-3 inline mr-1" />
                          <span>Reset</span>
                        </button>
                        <button
                          disabled={busy === (r.firebaseId || r.id)}
                          onClick={() => remove(r)}
                          title="Remove technician"
                          className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400 text-xs font-medium">
                    No technicians match your search or filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
