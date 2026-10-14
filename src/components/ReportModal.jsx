import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Send, Loader2, Search, ImagePlus, Film, Trash2, PencilLine, ClipboardPen, Siren, Users } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { CATEGORIES, GROUPS, categoryLabel, getCategory, submitKey } from '../data/catalog.js';
import LocationPicker from './LocationPicker.jsx';
import { useBodyScrollLock } from '../lib/useBodyScrollLock.js';

// Short names for the group tabs (full names live in the catalogue)
const GROUP_SHORT = {
  'Maintenance & Facilities': 'Maintenance',
  'Hostel, Mess & Campus Life': 'Hostel & Campus',
  'Academics & Administration': 'Academic & Admin',
  'Safety, Conduct & Wellbeing': 'Safety & Wellbeing',
  'Other': 'Other',
};

const CUSTOM = '__custom__';        // "My category isn't listed"
const CUSTOM_ISSUE = '__custom_issue__'; // "My problem isn't listed"
const MAX_FILES = 3;
const MAX_MB = 25;

function Step({ n, title, hint }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-6 h-6 rounded-full bg-[#2f4e56] text-white text-[11px] font-black flex items-center justify-center shrink-0">{n}</span>
      <div className="min-w-0">
        <p className="text-[13px] font-extrabold text-slate-900 leading-tight">{title}</p>
        {hint && <p className="text-[11px] text-slate-500 leading-tight">{hint}</p>}
      </div>
    </div>
  );
}

export default function ReportModal({ onClose, onCreated, initialLocation = '', initialCoords = null }) {
  useBodyScrollLock();
  const { api, showToast } = useApp();

  const [group, setGroup] = useState(GROUPS[0]);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('');
  const [issue, setIssue] = useState('');
  const [customCat, setCustomCat] = useState('');
  const [customIssue, setCustomIssue] = useState('');

  const [location, setLocation] = useState(initialLocation);
  const [coords, setCoords] = useState(initialCoords);
  const [showLocation, setShowLocation] = useState(false);
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [files, setFiles] = useState([]); // [{ file, url, kind }]
  const [busy, setBusy] = useState(false);

  const isCustomCat = cat === CUSTOM;
  const catInfo = isCustomCat ? null : getCategory(cat);
  const issues = catInfo?.issues || [];
  const confidential = Boolean(catInfo?.confidential);
  const onSite = isCustomCat ? false : (catInfo ? catInfo.onSite !== false : true);

  // Free preview URLs when the modal closes
  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(() => () => filesRef.current.forEach(f => URL.revokeObjectURL(f.url)), []);

  // Search across every category and sub-problem
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out = [];
    for (const c of CATEGORIES) {
      const catHit = c.label.toLowerCase().includes(q);
      for (const i of c.issues) {
        if (catHit || i.toLowerCase().includes(q)) out.push({ cat: c, issue: i });
        if (out.length >= 8) return out;
      }
    }
    return out;
  }, [query]);

  function pickCategory(key, presetIssue = '') {
    setCat(key);
    setIssue(presetIssue);
    setCustomIssue('');
    setShowLocation(false);
    if (key !== CUSTOM) setCustomCat('');
    setQuery('');
  }

  function addFiles(list) {
    const incoming = Array.from(list || []);
    const next = [...files];
    for (const file of incoming) {
      if (next.length >= MAX_FILES) { showToast(`You can attach up to ${MAX_FILES} files.`, 'warning'); break; }
      const isImg = file.type.startsWith('image/');
      const isVid = file.type.startsWith('video/');
      if (!isImg && !isVid) { showToast(`${file.name} is not a photo or video.`, 'warning'); continue; }
      if (file.size > MAX_MB * 1024 * 1024) { showToast(`${file.name} is larger than ${MAX_MB} MB.`, 'warning'); continue; }
      next.push({ file, url: URL.createObjectURL(file), kind: isImg ? 'image' : 'video' });
    }
    setFiles(next);
  }

  function removeFile(idx) {
    setFiles(prev => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  }

  async function submit(e) {
    e.preventDefault();
    const catName = isCustomCat ? customCat.trim() : categoryLabel(cat);
    const problem = (isCustomCat || issue === CUSTOM_ISSUE) ? customIssue.trim() : issue;
    if (!cat) return showToast('Pick a category.', 'warning');
    if (isCustomCat && !catName) return showToast('Tell us what the problem is about.', 'warning');
    if (!problem) return showToast('Pick or type the problem.', 'warning');
    if (!description.trim()) return showToast('Please describe the problem.', 'warning');
    if (onSite && !location.trim() && !coords) return showToast('Please add where the problem is.', 'warning');

    setBusy(true);
    try {
      const pub = isPublic && !confidential;
      const t = await api.createTicket({
        // Filed under a backend-known category; the full label travels in the title
        category: isCustomCat ? 'Other' : submitKey(cat),
        subCategory: problem,
        categoryDisplay: `${catName} — ${problem}`,
        confidential,
        location: location.trim(), latitude: coords?.lat, longitude: coords?.lng,
        description: description.trim(), phone: phone.trim(),
        priority: urgent ? 'High' : 'Normal', urgent, isPublic: pub, upvotes: pub ? 1 : 0,
      });

      // Attach photos / videos after the ticket exists (uses the existing upload endpoint)
      if (files.length && api.uploadFile) {
        const results = await Promise.allSettled(files.map(f => api.uploadFile(f.file, t?.id)));
        const failed = results.filter(r => r.status === 'rejected').length;
        if (failed) showToast(`Ticket created, but ${failed} attachment(s) failed to upload.`, 'warning');
      }

      showToast(`Ticket ${t.id} created.`, 'success');
      onCreated?.(t); onClose();
    } catch (err) { showToast(err.message || 'Failed to create ticket', 'error'); }
    finally { setBusy(false); }
  }

  const inputCls = 'w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white input-enhanced focus:outline-none';

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-md" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh] overflow-hidden lf-modal" onClick={e => e.stopPropagation()}>
        {/* Header (stays put while the form scrolls) */}
        <div className="shrink-0 px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-[#2f4e56] text-white flex items-center justify-center shrink-0 shadow-sm">
              <ClipboardPen className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h3 className="font-extrabold text-slate-900 leading-tight">Report a problem</h3>
              <p className="text-[11.5px] text-slate-500 leading-tight">Takes less than a minute · we'll route it to the right team</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="modal-x shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={submit} className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-6">
          {/* ── 1. What is the problem? ── */}
          {!cat ? (
            <div className="space-y-3">
              <Step n={1} title="What's the problem?" hint="Search, or pick a category below" />

              {/* Search everything */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search — e.g. wifi, fan, ragging, exam result…"
                  className={`${inputCls} pl-9`}
                />
                {results.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg py-1">
                    {results.map(r => (
                      <button
                        key={`${r.cat.key}|${r.issue}`}
                        type="button"
                        onClick={() => pickCategory(r.cat.key, r.issue)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex flex-col"
                      >
                        <span className="font-semibold text-slate-800">{r.issue}</span>
                        <span className="text-[11px] text-slate-500">{r.cat.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                {query.trim().length >= 2 && results.length === 0 && (
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    No match.{' '}
                    <button type="button" onClick={() => { pickCategory(CUSTOM); setCustomCat(query.trim()); }} className="font-semibold text-[#2f4e56] underline">
                      Report it as a new problem
                    </button>
                  </p>
                )}
              </div>

              {/* Group tabs */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
                {GROUPS.map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGroup(g)}
                    className={`chip shrink-0 ${group === g ? 'active' : ''}`}
                  >
                    {GROUP_SHORT[g] || g}
                  </button>
                ))}
              </div>

              {/* Categories of the selected group */}
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.filter(c => c.group === group).map(c => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => pickCategory(c.key)}
                    className="issue-card !text-[12.5px] !font-semibold"
                  >
                    {c.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => pickCategory(CUSTOM)}
                  className="issue-card !text-[12.5px] !font-semibold border-dashed !text-[#2f4e56]"
                >
                  <PencilLine className="w-3.5 h-3.5 shrink-0" /> Not listed here
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Step n={1} title="What's the problem?" />
              {/* Selected category summary */}
              <div className="flex items-center justify-between gap-2 rounded-xl border border-[#c9d7d4] bg-[#eef3f1] px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-500">Category</p>
                  <p className="text-sm font-bold text-slate-900 truncate">{isCustomCat ? 'Not listed (custom)' : catInfo?.label}</p>
                  {catInfo?.handledBy && <p className="text-[11px] text-slate-500 truncate">Handled by {catInfo.handledBy}</p>}
                </div>
                <button type="button" onClick={() => pickCategory('')} className="text-xs font-bold text-[#2f4e56] bg-white border border-[#c9d7d4] hover:bg-[#e3ebe9] px-3 py-1.5 rounded-lg shrink-0 transition">
                  Change
                </button>
              </div>

              {confidential && (
                <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[12px] leading-snug text-violet-900">
                  <span className="font-bold">Confidential complaint.</span> It is sent privately and never appears in Shared Issues for other students.
                </div>
              )}

              {isCustomCat ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">What is it about? *</label>
                    <input value={customCat} onChange={e => setCustomCat(e.target.value)} maxLength={60} placeholder="e.g. Hostel parcel room, Auditorium…" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">The problem in a few words *</label>
                    <input value={customIssue} onChange={e => setCustomIssue(e.target.value)} maxLength={80} placeholder="e.g. Parcels getting misplaced" className={inputCls} />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Problem *</label>
                  <select value={issue} onChange={e => { setIssue(e.target.value); setCustomIssue(''); }} className={`login-select ${inputCls}`}>
                    <option value="">Pick the problem…</option>
                    {issues.map(i => <option key={i} value={i}>{i}</option>)}
                    <option value={CUSTOM_ISSUE}>My problem isn't listed…</option>
                  </select>
                  {issue === CUSTOM_ISSUE && (
                    <input
                      value={customIssue}
                      onChange={e => setCustomIssue(e.target.value)}
                      maxLength={80}
                      autoFocus
                      placeholder="Name the problem in a few words"
                      className={`${inputCls} mt-2`}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── 2. Where? ── */}
          <div className="space-y-3">
          <Step n={2} title="Where is it?" hint={onSite ? 'Needed so staff can reach the spot' : 'Optional for this type of complaint'} />
          {(onSite || showLocation) ? (
            <LocationPicker
              value={location}
              onChange={setLocation}
              coords={coords}
              onCoordsChange={setCoords}
              label={onSite ? 'Building / room *' : 'Building / room'}
              placeholder="e.g. Hostel Room 214, Library 2nd floor, Academic Block…"
            />
          ) : (
            <button type="button" onClick={() => setShowLocation(true)} className="text-xs font-semibold text-[#2f4e56] hover:underline">
              + Add a location (optional)
            </button>
          )}
          </div>

          {/* ── 3. Details ── */}
          <div className="space-y-4">
          <Step n={3} title="Tell us more" hint="Details, photos and how to reach you" />
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Describe the problem *</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="What's wrong?" className={`${inputCls} resize-none`} />
          </div>

          {/* ── 4. Photos / videos ── */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">Photos or videos <span className="font-medium text-slate-500">(optional, up to {MAX_FILES})</span></label>
            </div>
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div key={f.url} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                  {f.kind === 'image' ? (
                    <img src={f.url} alt={f.file.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-600">
                      <Film className="w-5 h-5" />
                      <span className="text-[9px] px-1 truncate max-w-full">{f.file.name}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    aria-label={`Remove ${f.file.name}`}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {files.length < MAX_FILES && (
                <label className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 hover:border-[#2f4e56] text-slate-500 hover:text-[#2f4e56] flex flex-col items-center justify-center gap-1 cursor-pointer transition text-[10.5px] font-semibold">
                  <ImagePlus className="w-5 h-5" />
                  Add
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={e => { addFiles(e.target.files); e.target.value = ''; }}
                  />
                </label>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Max {MAX_MB} MB each. A clear photo helps staff fix it faster.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Contact number <span className="font-medium text-slate-500">(optional)</span></label>
            <input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" placeholder="Your phone" className={inputCls} />
          </div>
          </div>

          <div className={`grid gap-2 ${confidential ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
            <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${urgent ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
              <input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} className="mt-0.5 w-4 h-4 accent-rose-500 shrink-0" />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-[13px] font-bold text-slate-800"><Siren className="w-3.5 h-3.5 text-rose-500" /> Urgent</span>
                <span className="block text-[11px] text-slate-500 leading-snug">Safety risk or many people affected</span>
              </span>
            </label>
            {!confidential && (
              <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${isPublic ? 'border-[#9fbcbf] bg-[#eef3f1]' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="mt-0.5 w-4 h-4 accent-iiitg-800 shrink-0" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[13px] font-bold text-slate-800"><Users className="w-3.5 h-3.5 text-[#2f4e56]" /> Shared issue</span>
                  <span className="block text-[11px] text-slate-500 leading-snug">Others can press "Me too"</span>
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Footer (always visible) */}
        <div className="shrink-0 px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="flex-1 py-2.5 bg-iiitg-800 hover:bg-iiitg-900 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Submit ticket</>}
          </button>
        </div>
        </form>
      </div>
    </div>
  );
}
