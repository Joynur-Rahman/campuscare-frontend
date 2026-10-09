import { useState } from 'react';
import { Wrench, UserPlus, Loader2, Trash2, Users, KeyRound } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { Section } from '../../components/admin/Bits.jsx';
import { CATEGORIES } from '../../data/catalog.js';

const TEAMS = [...new Set(CATEGORIES.map(c => c.team).filter(Boolean))];

export default function AdminManage({ techs, members }) {
  const { api, showToast } = useApp();
  const [kind, setKind] = useState('technician'); // technician | member
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [team, setTeam] = useState('');
  const [busy, setBusy] = useState(false);

  async function create(e) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return showToast('Name and email are required.', 'warning');
    setBusy(true);
    try {
      if (kind === 'technician') {
        if (!team) return showToast('Pick a team for the technician.', 'warning');
        const r = await api.createTechnician({ name: name.trim(), phone: phone.trim(), email: email.trim().toLowerCase(), dept: team });
        showToast(`Technician created.${r?.tempPassword ? ' Temp password: ' + r.tempPassword : ''}`, 'success');
      } else {
        const r = await api.createCampusMember({ name: name.trim(), phone: phone.trim(), email: email.trim().toLowerCase(), section: team });
        showToast(`Non-teaching staff created.${r?.tempPassword ? ' Temp password: ' + r.tempPassword : ''}`, 'success');
      }
      setName(''); setPhone(''); setEmail(''); setTeam('');
    } catch (err) { showToast(err.message || 'Could not create account', 'error'); }
    finally { setBusy(false); }
  }

  async function removeMember(m) {
    const id = m.clerk_id || m.id || m.uid;
    if (!id) return showToast('User ID missing', 'warning');
    try { await api.deleteCampusMember(id); showToast('Removed.', 'success'); }
    catch (e) { showToast(e.message, 'error'); }
  }

  return (
    <div className="space-y-5">
      <Section title="Create an account" sub="Register a technician (fixes problems) or non-teaching staff (reports problems).">
        <div className="grid grid-cols-2 gap-2 mb-4 max-w-md">
          <button type="button" onClick={() => setKind('technician')} className={`seg-btn flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-bold transition-colors ${kind === 'technician' ? 'border-iiitg-500 bg-iiitg-50 text-iiitg-800' : 'border-slate-200 text-slate-500'}`}><Wrench className="w-4 h-4" /> Technician</button>
          <button type="button" onClick={() => setKind('member')} className={`seg-btn flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-bold transition-colors ${kind === 'member' ? 'border-iiitg-500 bg-iiitg-50 text-iiitg-800' : 'border-slate-200 text-slate-500'}`}><Users className="w-4 h-4" /> Non-teaching staff</button>
        </div>
        <form onSubmit={create} className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          <Field label="Full name *"><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ramesh Kumar" className="in" /></Field>
          <Field label="Phone number"><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 9876543210" className="in" /></Field>
          <Field label="Email (login) *"><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="their email" className="in" /></Field>
          <Field label={kind === 'technician' ? 'Team *' : 'Section / Office'}>
            <select value={team} onChange={e => setTeam(e.target.value)} className="in login-select">
              <option value="">{kind === 'technician' ? 'Select team…' : 'e.g. Library, Accounts…'}</option>
              {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy} className="inline-flex items-center gap-2 px-5 py-2.5 bg-iiitg-800 hover:bg-iiitg-900 text-white text-sm font-bold rounded-xl disabled:opacity-60">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Create account
            </button>
          </div>
        </form>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title={`Technicians (${techs.length})`} sub="Audit & manage status in the Technicians tab.">
          <ul className="divide-y divide-slate-100">
            {techs.map(t => (
              <li key={t.firebaseId || t.clerk_id || t.id} className="flex items-center gap-3 py-2.5">
                <div className="w-8 h-8 rounded-lg bg-iiitg-50 text-iiitg-700 flex items-center justify-center"><Wrench className="w-4 h-4" /></div>
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900 truncate">{t.name || t.full_name}</p><p className="text-[11px] text-slate-500 truncate">{t.dept || 'Staff'} · {t.email}{t.phone ? ` · ${fmtPhone(t.phone)}` : ''}</p></div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${t.status === 'On Duty' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{t.status || 'On Duty'}</span>
              </li>
            ))}
            {techs.length === 0 && <li className="text-xs text-slate-400 py-4 text-center">No technicians yet.</li>}
          </ul>
        </Section>

        <Section title={`Non-teaching staff (${members.length})`} sub="Campus users who report problems.">
          <ul className="divide-y divide-slate-100">
            {members.map(m => (
              <li key={m.uid || m.clerk_id || m.id} className="flex items-center gap-3 py-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center"><Users className="w-4 h-4" /></div>
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900 truncate">{m.name || m.full_name}</p><p className="text-[11px] text-slate-500 truncate">{m.section || 'Non-teaching'} · {m.email}</p></div>
                <button onClick={() => removeMember(m)} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </li>
            ))}
            {members.length === 0 && <li className="text-xs text-slate-400 py-4 text-center">No non-teaching staff yet. Create one above.</li>}
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="block text-xs font-bold text-slate-700 mb-1.5">{label}</span>{children}</label>;
}
