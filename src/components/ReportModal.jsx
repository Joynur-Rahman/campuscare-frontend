import { useState } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { CATEGORIES, categoryLabel } from '../data/catalog.js';
import LocationPicker from './LocationPicker.jsx';

export default function ReportModal({ onClose, onCreated, initialLocation = '', initialCoords = null }) {
  const { api, showToast } = useApp();
  const [cat, setCat] = useState('');
  const [issue, setIssue] = useState('');
  const [location, setLocation] = useState(initialLocation);
  const [coords, setCoords] = useState(initialCoords);
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [busy, setBusy] = useState(false);
  const issues = CATEGORIES.find(c => c.key === cat)?.issues || [];

  async function submit(e) {
    e.preventDefault();
    if (!cat || !issue) return showToast('Pick a category and the problem.', 'warning');
    if (!description.trim()) return showToast('Please describe the problem.', 'warning');
    setBusy(true);
    try {
      const t = await api.createTicket({
        category: cat, subCategory: issue, categoryDisplay: `${categoryLabel(cat)} — ${issue}`,
        location: location.trim(), latitude: coords?.lat, longitude: coords?.lng,
        description: description.trim(), phone: phone.trim(),
        priority: urgent ? 'High' : 'Normal', urgent, isPublic, upvotes: isPublic ? 1 : 0,
      });
      showToast(`Ticket ${t.id} created.`, 'success');
      onCreated?.(t); onClose();
    } catch (err) { showToast(err.message || 'Failed to create ticket', 'error'); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh] overflow-y-auto lf-modal" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h3 className="font-bold text-slate-900">Report a problem</h3>
          <button onClick={onClose} aria-label="Close" className="modal-x"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Category *</label>
            <select value={cat} onChange={e => { setCat(e.target.value); setIssue(''); }} className="login-select w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white">
              <option value="">Select a category…</option>
              {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          {cat && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Problem *</label>
              <select value={issue} onChange={e => setIssue(e.target.value)} className="login-select w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white">
                <option value="">Pick the problem…</option>
                {issues.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          )}
          <LocationPicker
            value={location}
            onChange={setLocation}
            coords={coords}
            onCoordsChange={setCoords}
            placeholder="e.g. Hostel Room 214, Library 2nd floor, Academic Block…"
          />
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Describe the problem *</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="What's wrong?" className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg resize-none input-enhanced focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Contact number</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Your phone" className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg input-enhanced focus:outline-none" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} className="w-4 h-4 accent-rose-500" /> This is urgent (safety risk / many affected)</label>
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-4 h-4 accent-iiitg-800" /> Shared issue (others can press "Me too")</label>
          </div>
          <button type="submit" disabled={busy} className="w-full py-3 bg-iiitg-800 hover:bg-iiitg-900 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Submit ticket</>}
          </button>
        </form>
      </div>
    </div>
  );
}
