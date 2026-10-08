import { useState } from 'react';
import { Power, KeyRound, Trash2, Star } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { Section } from '../../components/admin/Bits.jsx';
import { techStats } from '../../lib/adminMetrics.js';

export default function AdminTechnicians({ tickets, techs }) {
  const { api, showToast } = useApp();
  const [busy, setBusy] = useState(null);
  const rows = techStats(tickets, techs);

  async function toggle(tech) {
    const id = tech.firebaseId || tech.clerk_id || tech.id;
    setBusy(id);
    const next = tech.status === 'On Duty' ? 'Off Duty' : 'On Duty';
    try { await api.updateTechnicianStatus(id, next); showToast(`${tech.name || tech.full_name} is now ${next}.`, 'success'); }
    catch (e) { showToast(e.message, 'error'); } finally { setBusy(null); }
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
        <table className="w-full text-left text-xs report-table">
          <thead>
            <tr>
              <th>Technician</th><th>Team</th><th>Status</th>
              <th className="text-right">Given</th><th className="text-right">Fixed</th>
              <th className="text-right">Active</th><th className="text-right">Reopened</th>
              <th className="text-right">Rating</th><th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.firebaseId}>
                <td className="font-semibold text-slate-900">{r.name}</td>
                <td>{r.dept || '—'}</td>
                <td>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${r.status === 'On Duty' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{r.status || 'Off Duty'}</span>
                </td>
                <td className="text-right">{r.given}</td>
                <td className="text-right font-bold text-emerald-700">{r.fixed}</td>
                <td className="text-right">{r.active}</td>
                <td className="text-right">{r.reopened || '–'}</td>
                <td className="text-right">{r.avgRating ? <span className="text-amber-600 font-bold inline-flex items-center gap-0.5"><Star className="w-3 h-3 fill-amber-500 text-amber-500" />{r.avgRating.toFixed(1)}</span> : '–'}</td>
                <td className="text-right whitespace-nowrap">
                  <button disabled={busy === r.firebaseId} onClick={() => toggle(r)} title="Toggle duty" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Power className="w-3.5 h-3.5" /></button>
                  <button disabled={busy === r.firebaseId} onClick={() => reset(r)} title="Reset password" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><KeyRound className="w-3.5 h-3.5" /></button>
                  <button disabled={busy === r.firebaseId} onClick={() => remove(r)} title="Remove" className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
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
