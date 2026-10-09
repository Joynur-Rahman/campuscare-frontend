import { useState } from 'react';
import { Power, KeyRound, Trash2, Star } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { Section } from '../../components/admin/Bits.jsx';
import { techStats } from '../../lib/adminMetrics.js';

export default function AdminTechnicians({ tickets, techs }) {
  const { api, showToast } = useApp();
  const [busy, setBusy] = useState(null);
  const [optimisticDuty, setOptimisticDuty] = useState({});

  const enrichedTechs = (techs || []).map(t => {
    const tid = t.clerk_id || t.id || t.firebaseId;
    return optimisticDuty[tid] ? { ...t, status: optimisticDuty[tid] } : t;
  });
  const rows = techStats(tickets, enrichedTechs);

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
    try { const r = await api.resetTechnicianPassword(id); showToast(`Temp password for ${tech.name || tech.full_name}: ${r?.tempPassword || 'sent'}`, 'success'); }
    catch (e) { showToast(e.message, 'error'); } finally { setBusy(null); }
  }
  async function remove(tech) {
    const id = tech.firebaseId || tech.clerk_id || tech.id;
    setBusy(id);
    try { await api.deleteTechnician(id); showToast(`${tech.name || tech.full_name} removed.`, 'success'); }
    catch (e) { showToast(e.message, 'error'); } finally { setBusy(null); }
  }


  return (
    <Section title="Technician performance" sub="Audit each technician's workload, speed and quality — computed live from tickets.">
      <div className="overflow-x-auto">
        <table className="w-full text-xs report-table">
          <thead>
            <tr>
              <th className="text-left">Technician</th>
              <th className="text-left">Team</th>
              <th className="text-center">Status</th>
              <th className="text-center">Given</th>
              <th className="text-center">Fixed</th>
              <th className="text-center">Active</th>
              <th className="text-center">Reopened</th>
              <th className="text-center">Rating</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.firebaseId || r.id}>
                <td className="text-left font-semibold text-slate-900 dark:text-slate-100">{r.name}</td>
                <td className="text-left">{r.dept || '—'}</td>
                <td className="text-center">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-block ${r.status === 'On Duty' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>{r.status || 'Off Duty'}</span>
                </td>
                <td className="text-center font-medium">{r.given}</td>
                <td className="text-center font-bold text-emerald-600 dark:text-emerald-400">{r.fixed}</td>
                <td className="text-center font-medium">{r.active}</td>
                <td className="text-center text-slate-400">{r.reopened || '–'}</td>
                <td className="text-center">
                  {r.avgRating ? (
                    <span className="text-amber-500 font-bold inline-flex items-center justify-center gap-0.5">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      {r.avgRating.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-slate-400">–</span>
                  )}
                </td>
                <td className="text-center whitespace-nowrap">
                  <button disabled={busy === (r.firebaseId || r.id)} onClick={() => toggle(r)} title="Toggle duty" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"><Power className="w-3.5 h-3.5" /></button>
                  <button disabled={busy === (r.firebaseId || r.id)} onClick={() => reset(r)} title="Reset password" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition ml-1"><KeyRound className="w-3.5 h-3.5" /></button>
                  <button disabled={busy === (r.firebaseId || r.id)} onClick={() => remove(r)} title="Remove" className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-400 hover:text-rose-500 transition ml-1"><Trash2 className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9} className="text-center text-slate-400 py-6">No technicians yet. Add them from the Manage tab.</td></tr>}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
