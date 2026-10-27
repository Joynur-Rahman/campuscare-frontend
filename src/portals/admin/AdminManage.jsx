import { useState, useRef } from 'react';
import { UserPlus, Loader2, Trash2, Users, ShieldCheck, Search, X, Info, Power, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { DEPT_GROUPS, DEPARTMENTS, deptInfo } from '../../lib/departments.js';

const initials = n => String(n || '?').replace(/\(.*?\)/g, '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const inputCls = 'w-full px-3 py-2 text-sm border border-slate-300 dark:border-[#2a2e35] rounded-xl bg-white dark:bg-[#15171a] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2f4e56]/25';

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

function Panel({ title, sub, right, children, className = '' }) {
  return (
    <section className={`rounded-none bg-[#fcfdfd] dark:bg-[#121417] border border-[#bfd0cc] dark:border-[#212124] shadow-xs p-4 flex flex-col min-h-0 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-3 shrink-0">
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{title}</h3>
          {sub && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export default function AdminManage({ techs = [], members = [] }) {
  const { api, showToast } = useApp();
  const [kind, setKind] = useState('dept'); // dept | member
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [dept, setDept] = useState('');
  const [section, setSection] = useState('');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [showAllUncovered, setShowAllUncovered] = useState(false);
  const nameInputRef = useRef(null);

  const info = dept ? deptInfo(dept) : null;

  async function create(e) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return showToast('Name and email are required.', 'warning');
    if (kind === 'dept' && !dept) return showToast('Pick the department this person works in.', 'warning');
    setBusy(true);
    try {
      if (kind === 'dept') {
        const r = await api.createTechnician({ name: name.trim(), phone: phone.trim(), email: email.trim().toLowerCase(), dept });
        showToast(`${info.role} added to ${dept}.${r?.tempPassword ? ' Temp password: ' + r.tempPassword : ''}`, 'success');
      } else {
        const r = await api.createCampusMember({ name: name.trim(), phone: phone.trim(), email: email.trim().toLowerCase(), section: section.trim() });
        showToast(`Non-teaching staff created.${r?.tempPassword ? ' Temp password: ' + r.tempPassword : ''}`, 'success');
      }
      setName(''); setPhone(''); setEmail(''); setDept(''); setSection('');
    } catch (err) { showToast(err.message || 'Could not create account', 'error'); }
    finally { setBusy(false); }
  }

  async function toggleDuty(t) {
    const id = t.clerk_id || t.id || t.firebaseId;
    const next = t.status === 'On Duty' ? 'Off Duty' : 'On Duty';
    try {
      await api.updateTechnicianStatus(id, next);
      showToast(`${t.name || t.full_name} is now ${next}.`, 'success');
    } catch (e) { showToast(e.message || 'Failed to update status', 'error'); }
  }

  async function removeTech(t) {
    const id = t.firebaseId || t.clerk_id || t.id;
    try {
      await api.deleteTechnician(id);
      showToast(`${t.name || t.full_name} removed.`, 'success');
    } catch (e) { showToast(e.message || 'Failed to remove', 'error'); }
  }

  async function removeMember(m) {
    const id = m.clerk_id || m.id || m.uid;
    if (!id) return showToast('User ID missing', 'warning');
    try { await api.deleteCampusMember(id); showToast('Removed.', 'success'); }
    catch (e) { showToast(e.message, 'error'); }
  }

  const pickUncoveredDept = (deptName) => {
    setKind('dept');
    setDept(deptName);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const match = (x) => !q.trim() || `${x.name} ${x.full_name || ''} ${x.email} ${x.dept || ''} ${x.section || ''}`.toLowerCase().includes(q.trim().toLowerCase());
  const staffByGroup = DEPT_GROUPS.map(g => ({ ...g, people: techs.filter(t => deptInfo(t.dept || t.department).group === g.key).filter(match) })).filter(g => g.people.length);
  const shownMembers = members.filter(match);
  const covered = new Set(techs.map(t => (t.dept || '').toLowerCase()));
  const uncovered = DEPARTMENTS.filter(d => !covered.has(d.name.toLowerCase()));
  const visibleUncovered = showAllUncovered ? uncovered : uncovered.slice(0, 6);

  return (
    <div className="space-y-3 lg:space-y-0 lg:gap-3 lg:grid lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)] lg:h-full lg:min-h-0">
      {/* Left Column: Clean, Self-Contained Account Creation Form */}
      <Panel title="Create an account" sub="Add department staff (who resolve issues) or non-teaching staff." className="lg:h-fit">
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#e3ebe9] dark:bg-white/5 mb-3.5">
          {[['dept', 'Department staff', ShieldCheck], ['member', 'Non-teaching staff', Users]].map(([k, l, I]) => (
            <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
              className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${kind === k ? 'bg-[#2f4e56] text-white shadow-sm dark:bg-white dark:text-black' : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/10'}`}>
              <I className="w-3.5 h-3.5" /> {l}
            </button>
          ))}
        </div>

        <form onSubmit={create} className="space-y-3">
          {kind === 'dept' && (
            <Field label="Department *" hint={info ? `Role badge: ${info.role}` : 'Select a department or click a chip on the right'}>
              <select value={dept} onChange={e => setDept(e.target.value)} className={inputCls}>
                <option value="">Select department…</option>
                {DEPT_GROUPS.map(g => (
                  <optgroup key={g.key} label={g.label}>
                    {DEPARTMENTS.filter(d => d.group === g.key).map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </Field>
          )}
          <Field label="Full name *">
            <input ref={nameInputRef} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Dr. Meera Nath" className={inputCls} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Email (login) *"><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@iiitg.ac.in" className={inputCls} /></Field>
            <Field label="Phone"><input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" placeholder="9876543210" className={inputCls} /></Field>
          </div>
          {kind === 'member' && (
            <Field label="Section / office"><input value={section} onChange={e => setSection(e.target.value)} placeholder="e.g. Library, Accounts…" className={inputCls} /></Field>
          )}
          <button type="submit" disabled={busy} className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#2f4e56] hover:bg-[#243d43] dark:bg-white dark:text-black dark:hover:bg-slate-200 text-white text-sm font-bold rounded-xl disabled:opacity-60 transition cursor-pointer shadow-xs">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Create account
          </button>
        </form>
      </Panel>

      {/* Right Column: Actionable People Directory + Compact Unstaffed Dept Quick-Fill Banner */}
      <Panel
        title="People Directory"
        sub={`${techs.length} department staff · ${members.length} non-teaching staff`}
        className="lg:h-full"
        right={
          <div className="relative w-48 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, role, or dept…" className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-[#2a2e35] bg-white dark:bg-[#15171a] text-slate-800 dark:text-slate-100 focus:outline-none" />
            {q && <button onClick={() => setQ('')} aria-label="Clear" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"><X className="w-3.5 h-3.5" /></button>}
          </div>
        }
      >
        {/* Compact Unstaffed Departments Quick-Fill Banner */}
        {uncovered.length > 0 && (
          <div className="shrink-0 mb-3 rounded-xl border border-amber-200/90 bg-amber-50/90 dark:bg-amber-400/10 dark:border-amber-400/30 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-extrabold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>{uncovered.length} departments have no staff assigned — click any chip to quick-fill the form:</span>
              </p>
              {uncovered.length > 6 && (
                <button
                  type="button"
                  onClick={() => setShowAllUncovered(v => !v)}
                  className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300 hover:underline shrink-0 cursor-pointer"
                >
                  <span>{showAllUncovered ? 'Show less' : `+${uncovered.length - 6} more`}</span>
                  {showAllUncovered ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {visibleUncovered.map(d => {
                const isSelected = dept === d.name && kind === 'dept';
                return (
                  <button
                    key={d.name}
                    type="button"
                    onClick={() => pickUncoveredDept(d.name)}
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#2f4e56] text-white border-[#2f4e56]'
                        : 'bg-white dark:bg-white/10 border-amber-200 dark:border-amber-400/30 text-amber-900 dark:text-amber-100 hover:bg-amber-100'
                    }`}
                  >
                    + {d.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="lg:flex-1 lg:min-h-0 overflow-y-auto custom-ticket-scrollbar -mr-1 pr-1 pb-4 space-y-4">
          {staffByGroup.map(g => (
            <div key={g.key}>
              <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">{g.label} · {g.people.length}</p>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {g.people.map(t => {
                  const di = deptInfo(t.dept || t.department);
                  const on = t.status === 'On Duty';
                  return (
                    <li key={t.firebaseId || t.clerk_id || t.id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#f3f7f6] dark:bg-white/5 border border-[#e3ebe9] dark:border-[#2a2e35]">
                      <span className="w-9 h-9 rounded-lg bg-[#2f4e56] dark:bg-[#2a2e35] text-white text-xs font-extrabold flex items-center justify-center shrink-0">{initials(t.name || t.full_name)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">{t.name || t.full_name}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{di.role} · {t.dept || '—'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleDuty(t)}
                        title="Click to toggle On Duty / Off Duty"
                        className={`inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-1 rounded-lg border shrink-0 transition cursor-pointer ${
                          on
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-400/15 dark:text-emerald-300 dark:border-emerald-400/30'
                            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/10'
                        }`}
                      >
                        <Power className="w-3 h-3" />
                        <span>{t.status || 'On Duty'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTech(t)}
                        aria-label="Remove staff"
                        title="Remove account"
                        className="w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-400 hover:text-rose-600 transition cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {shownMembers.length > 0 && (
            <div>
              <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Non-teaching staff · {shownMembers.length}</p>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {shownMembers.map(m => (
                  <li key={m.uid || m.clerk_id || m.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-[#f3f7f6] dark:bg-white/5 border border-[#e3ebe9] dark:border-[#2a2e35]">
                    <span className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-extrabold flex items-center justify-center shrink-0">{initials(m.name || m.full_name)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{m.name || m.full_name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{m.section || 'Non-teaching'} · {m.email}</p>
                    </div>
                    <button onClick={() => removeMember(m)} aria-label="Remove" className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
