import { useMemo, useState } from 'react';
import { Power, KeyRound, Trash2, Star, Search, X, MoreVertical, Users, Wrench, Building2, GraduationCap, HeartHandshake, Phone, CheckCircle2, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { techStats } from '../../lib/adminMetrics.js';
import { DEPT_GROUPS, deptInfo } from '../../lib/departments.js';
import { ticketLabel, shortTicketId } from '../../lib/ticketUtils.js';

const GROUP_ICON = { maintenance: Wrench, services: Building2, academic: GraduationCap, welfare: HeartHandshake };
const initials = n => String(n || '?').replace(/\(.*?\)/g, '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const telHref = p => 'tel:' + String(p || '').replace(/[^\d+]/g, '');
const isResolved = t => ['resolved', 'done', 'fixed'].includes((t?.status || '').toLowerCase().trim());

export default function AdminTechnicians({ tickets = [], techs = [], onOpen }) {
  const { api, showToast } = useApp();
  const [busy, setBusy] = useState(null);
  const [optimisticDuty, setOptimisticDuty] = useState({});
  const [expandedJobs, setExpandedJobs] = useState({});
  const [group, setGroup] = useState('all');
  const [dutyFilter, setDutyFilter] = useState('all'); // 'all' | 'on' | 'active'
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [resetModal, setResetModal] = useState(null);

  const idOf = t => t.clerk_id || t.id || t.firebaseId;

  const enriched = (techs || []).map(t => {
    const tid = idOf(t);
    return optimisticDuty[tid] ? { ...t, status: optimisticDuty[tid] } : t;
  });

  const rows = useMemo(() => {
    return techStats(tickets, enriched).map(r => {
      const tid = idOf(r);
      const activeJobs = tickets.filter(t => !isResolved(t) && (
        (t.assignedTo || t.assigned_to) === tid ||
        (t.assignedToEmail && r.email && t.assignedToEmail.toLowerCase() === r.email.toLowerCase())
      ));
      return {
        ...r,
        info: deptInfo(r.dept || r.department),
        activeJobs,
      };
    });
  }, [tickets, enriched]);

  const list = rows.filter(r => {
    if (group !== 'all' && r.info.group !== group) return false;
    if (dutyFilter === 'on' && r.status !== 'On Duty') return false;
    if (dutyFilter === 'active' && r.active === 0) return false;
    if (q.trim()) {
      const hay = `${r.name} ${r.dept} ${r.email} ${r.info.role}`.toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  });

  async function toggle(tech) {
    const id = idOf(tech);
    setBusy(id);
    const next = tech.status === 'On Duty' ? 'Off Duty' : 'On Duty';
    setOptimisticDuty(p => ({ ...p, [id]: next }));
    try { await api.updateTechnicianStatus(id, next); showToast(`${tech.name} is now ${next}.`, 'success'); }
    catch (e) { setOptimisticDuty(p => { const c = { ...p }; delete c[id]; return c; }); showToast(e.message || 'Failed to update duty status', 'error'); }
    finally { setBusy(null); }
  }
  async function reset(tech) {
    setMenu(null);
    const tid = tech.clerk_id || tech.firebaseId || idOf(tech);
    setBusy(tid);
    try {
      const r = await api.resetTechnicianPassword(tid);
      setResetModal({
        tech,
        tempPassword: r?.temp_password || r?.tempPassword || 'CampusCare@2026',
        signInUrl: r?.sign_in_url || r?.signInUrl,
      });
      showToast(`Temporary password generated for ${tech.name}`, 'success');
    } catch (e) {
      showToast(e.message || 'Failed to reset password', 'error');
    } finally {
      setBusy(null);
    }
  }
  async function remove(tech) {
    setConfirmDel(null); setBusy(idOf(tech));
    try { await api.deleteTechnician(tech.firebaseId || idOf(tech)); showToast(`${tech.name} removed.`, 'success'); }
    catch (e) { showToast(e.message, 'error'); } finally { setBusy(null); }
  }

  const onDutyCount = rows.filter(r => r.status === 'On Duty').length;
  const activeStaffCount = rows.filter(r => r.active > 0).length;

  return (
    <div className="space-y-2.5 lg:space-y-0 lg:gap-2.5 lg:flex lg:flex-col lg:h-full lg:min-h-0">
      {/* Group Filter Cards */}
      <div className="shrink-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {[{ key: 'all', label: 'All staff', Icon: Users }, ...DEPT_GROUPS.map(g => ({ ...g, Icon: GROUP_ICON[g.key] }))].map(g => {
          const on = group === g.key;
          const n = g.key === 'all' ? rows.length : rows.filter(r => r.info.group === g.key).length;
          return (
            <button key={g.key} type="button" onClick={() => setGroup(g.key)} aria-pressed={on}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition cursor-pointer ${on ? 'bg-[#2f4e56] border-[#2f4e56] text-white shadow-sm dark:bg-[#2a2e35] dark:border-[#6366f1]' : 'bg-white/90 border-[#d3dfdc] hover:bg-white dark:bg-[#15171a] dark:border-[#2a2e35] dark:hover:bg-[#1b1d21]'}`}>
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${on ? 'bg-white/15 text-white' : 'bg-[#e3ebe9] text-[#2f4e56] dark:bg-white/10 dark:text-slate-200'}`}><g.Icon className="w-3.5 h-3.5" /></span>
              <span className={`flex-1 min-w-0 text-xs font-bold truncate ${on ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`} title={g.label}>{g.short || g.label}</span>
              <span className={`text-base font-extrabold leading-none ${on ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* Staff Directory Container */}
      <div className="flex flex-col gap-3 rounded-2xl sm:rounded-3xl p-3 sm:p-4 bg-[#d3dfdc]/80 dark:bg-[#101214]/90 border border-[#c3d2ce] dark:border-[#2a2e35] lg:max-h-full lg:min-h-0">
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2">
          <div className="relative flex-1 min-w-[14rem]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, department, role or email…"
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl border border-[#d6ded7] dark:border-[#2a2e35] bg-white dark:bg-[#121417] text-slate-800 dark:text-slate-100 focus:outline-none" />
            {q && <button onClick={() => setQ('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"><X className="w-4 h-4" /></button>}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { key: 'all', label: `All (${rows.length})` },
              { key: 'on', label: `🟢 On duty (${onDutyCount})` },
              { key: 'active', label: `🔧 Working (${activeStaffCount})` },
            ].map(f => (
              <button
                key={f.key}
                type="button"
                onClick={() => setDutyFilter(f.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  dutyFilter === f.key
                    ? 'bg-[#2f4e56] text-white border-[#2f4e56] dark:bg-indigo-600 dark:border-indigo-500'
                    : 'bg-white/80 dark:bg-[#121417] text-slate-700 dark:text-slate-300 border-[#c3d2ce] dark:border-[#2a2e35] hover:bg-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:overflow-y-auto -mx-1 px-1 pb-2 custom-ticket-scrollbar lg:overscroll-contain">
          {list.length === 0 ? (
            <div className="text-center py-12 bg-white/80 dark:bg-[#15171a] rounded-2xl border border-dashed border-[#c3d2ce] dark:border-[#2a2e35]">
              <Users className="w-9 h-9 mx-auto text-[#7f999f] mb-2" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-100">No matching staff found</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Try switching the group or duty filter above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {list.map(r => {
                const id = idOf(r);
                const on = r.status === 'On Duty';
                const currentJob = r.activeJobs?.[0];
                return (
                  <div key={id} className="relative rounded-2xl bg-[#fcfdfd] dark:bg-[#121417] border border-[#bfd0cc] dark:border-[#2a2e35] shadow-xs hover:shadow-md transition-shadow p-3.5 flex flex-col justify-between gap-2.5">
                    <div className="flex items-start gap-3">
                      <span className="w-10 h-10 rounded-xl bg-[#2f4e56] dark:bg-[#2a2e35] text-white font-extrabold text-xs flex items-center justify-center shrink-0">{initials(r.name)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{r.name || r.full_name}</p>
                        </div>
                        <p className="text-[11px] font-semibold text-[#2f4e56] dark:text-[#b9bec9] truncate">{r.info.role} · {r.dept || r.department || '—'}</p>
                        {r.email && <p className="text-[10.5px] text-slate-400 truncate">{r.email}</p>}
                      </div>
                      <div className="relative">
                        <button type="button" onClick={() => setMenu(menu === id ? null : id)} aria-label="More actions" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"><MoreVertical className="w-4 h-4" /></button>
                        {menu === id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                            <div className="absolute right-0 mt-1 z-20 w-48 rounded-xl border border-slate-200 dark:border-[#2a2e35] bg-white dark:bg-[#15171a] shadow-xl py-1 text-xs font-semibold">
                              <button onClick={() => reset(r)} className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1b1d21]"><KeyRound className="w-3.5 h-3.5" /> Reset password</button>
                              <button onClick={() => { setMenu(null); setConfirmDel(r); }} className="w-full flex items-center gap-2 px-3 py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="w-3.5 h-3.5" /> Remove staff</button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Compact Metrics + Active Ticket Indicator */}
                    <div className="grid grid-cols-4 gap-1.5 text-center">
                      {[
                        ['Given', r.given, 'text-slate-900 dark:text-white'],
                        ['Fixed', r.fixed, 'text-emerald-600 dark:text-emerald-300'],
                        ['Active', r.active, r.active > 0 ? 'text-sky-600 dark:text-sky-300' : 'text-slate-400'],
                        ['Rating', r.avgRating ? r.avgRating.toFixed(1) : '–', 'text-amber-600 dark:text-amber-300']
                      ].map(([l, v, c]) => (
                        <div key={l} className="rounded-lg bg-[#eef3f1] dark:bg-white/5 py-1.5">
                          <div className={`text-sm font-extrabold leading-none ${c}`}>
                            {l === 'Rating' && r.avgRating ? <span className="inline-flex items-center gap-0.5"><Star className="w-3 h-3 fill-current" />{v}</span> : v}
                          </div>
                          <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-1">{l}</div>
                        </div>
                      ))}
                    </div>

                    {/* Live Workload Context Strip */}
                    {currentJob ? (
                      expandedJobs[id] ? (
                        <div className="rounded-xl bg-sky-50/95 dark:bg-sky-950/50 border border-sky-300/80 dark:border-sky-800 p-2 text-[11px] flex flex-col gap-1.5 shadow-2xs">
                          <div className="flex items-center justify-between font-extrabold text-sky-900 dark:text-sky-200 px-0.5 pb-1 border-b border-sky-200/60 dark:border-sky-800/60">
                            <span className="flex items-center gap-1.5 text-[11px]">
                              <Wrench className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                              <span>Assigned tickets ({r.activeJobs.length})</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setExpandedJobs(p => ({ ...p, [id]: false }))}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-200/60 dark:hover:bg-sky-900/60 cursor-pointer flex items-center gap-0.5 transition"
                            >
                              Show less <ChevronUp className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5 custom-ticket-scrollbar">
                            {r.activeJobs.map((job, idx) => (
                              <button
                                key={job.id || idx}
                                type="button"
                                onClick={() => onOpen?.(job)}
                                className="w-full text-left flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-lg bg-white/90 dark:bg-[#161a20] border border-sky-100 dark:border-sky-900/40 hover:border-sky-300 dark:hover:border-sky-700 hover:bg-sky-50/50 dark:hover:bg-sky-950/30 transition cursor-pointer group"
                                title="Click to view ticket details"
                              >
                                <span className="truncate flex-1 font-semibold text-slate-800 dark:text-slate-200 group-hover:text-sky-900 dark:group-hover:text-white">
                                  <span className="font-extrabold text-sky-700 dark:text-sky-400 mr-1.5 font-mono">{shortTicketId(job)}:</span>
                                  <span>{ticketLabel(job)}</span>
                                </span>
                                {job.location && (
                                  <span className="text-[9.5px] font-medium text-slate-400 dark:text-slate-500 shrink-0 truncate max-w-[80px]">
                                    {job.location}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="px-2.5 py-1.5 rounded-xl bg-sky-50/90 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-800/60 flex items-center justify-between gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => onOpen?.(currentJob)}
                            className="font-bold text-sky-900 dark:text-sky-200 truncate flex items-center gap-1.5 text-left hover:underline cursor-pointer min-w-0"
                            title="Click to view ticket details"
                          >
                            <Wrench className="w-3 h-3 text-sky-600 shrink-0" />
                            <span className="truncate">{shortTicketId(currentJob)}: {ticketLabel(currentJob)}</span>
                          </button>
                          {r.activeJobs.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setExpandedJobs(p => ({ ...p, [id]: true }))}
                              className="px-2 py-0.5 rounded-lg bg-sky-200/80 hover:bg-sky-300 dark:bg-sky-800 dark:hover:bg-sky-700 text-sky-950 dark:text-sky-100 text-[10.5px] font-extrabold shrink-0 cursor-pointer flex items-center gap-1 transition shadow-2xs"
                              title="Click to view all active jobs"
                            >
                              <span>+{r.activeJobs.length - 1} more</span>
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )
                    ) : (
                      <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="truncate">No pending jobs · Available</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#e6eeeb] dark:border-[#2a2e35]">
                      <button type="button" disabled={busy === id} onClick={() => toggle(r)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${on ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-400/15 dark:text-emerald-300 dark:border-emerald-400/30' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/15'}`}>
                        <Power className="w-3.5 h-3.5" /> {on ? 'On duty' : 'Off duty'}
                      </button>
                      {r.phone ? (
                        <a href={telHref(r.phone)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs">
                          <Phone className="w-3.5 h-3.5" /> Call · {r.phone}
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 bg-slate-100 dark:bg-white/5 cursor-default" title="No phone number saved">
                          <Phone className="w-3.5 h-3.5" /> No phone
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" onClick={() => setConfirmDel(null)}>
          <div className="bg-white dark:bg-[#121417] rounded-2xl max-w-sm w-full p-5 space-y-4 border border-slate-200 dark:border-[#2a2e35] shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Remove {confirmDel.name}?</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">Their account will be removed from the staff list. Existing tickets stay intact.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDel(null)} className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-[#2a2e35] text-slate-700 dark:text-slate-200">Cancel</button>
              <button type="button" onClick={() => remove(confirmDel)} className="px-3.5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white">Remove</button>
            </div>
          </div>
        </div>
      )}

      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" onClick={() => setResetModal(null)}>
          <div className="bg-white dark:bg-[#121417] rounded-3xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-[#2a2e35] shadow-2xl text-slate-900 dark:text-white" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold">Staff Password Reset</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{resetModal.tech.name} ({resetModal.tech.email})</p>
                </div>
              </div>
              <button type="button" onClick={() => setResetModal(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Temporary Password</span>
              <div className="flex items-center justify-between gap-2 bg-white dark:bg-[#1b1d21] p-2.5 rounded-xl border border-slate-200 dark:border-[#2a2e35]">
                <code className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 select-all">{resetModal.tempPassword}</code>
                <button type="button" onClick={() => { navigator.clipboard.writeText(resetModal.tempPassword); showToast('Password copied!', 'success'); }} className="px-2.5 py-1 text-xs font-bold bg-[#2f4e56] hover:bg-[#253e45] text-white rounded-lg flex items-center gap-1 cursor-pointer">
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
              </div>
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
                Share this password with the technician. They can sign in immediately on the Staff Desk.
              </p>
            </div>

            {resetModal.signInUrl && (
              <div className="p-3.5 rounded-2xl bg-sky-500/5 border border-sky-500/20 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">Direct 1-Click Login Link</span>
                <div className="flex items-center justify-between gap-2 bg-white dark:bg-[#1b1d21] p-2.5 rounded-xl border border-slate-200 dark:border-[#2a2e35]">
                  <input readOnly value={resetModal.signInUrl} className="text-xs text-slate-600 dark:text-slate-300 bg-transparent flex-1 truncate outline-none select-all" />
                  <button type="button" onClick={() => { navigator.clipboard.writeText(resetModal.signInUrl); showToast('Sign-in link copied!', 'success'); }} className="px-2.5 py-1 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-lg flex items-center gap-1 cursor-pointer">
                    <Copy className="w-3.5 h-3.5" /> Copy Link
                  </button>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button type="button" onClick={() => setResetModal(null)} className="px-4 py-2 text-xs font-bold rounded-xl bg-[#2f4e56] hover:bg-[#253e45] text-white cursor-pointer">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
