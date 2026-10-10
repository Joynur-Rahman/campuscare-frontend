import { useState } from 'react';
import { X, Send, Loader2, Search, Frown, HandHeart, Camera, Globe } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import LocationPicker from './LocationPicker.jsx';

// Dedicated Lost & Found posting flow — NOT the generic ticket form.
export default function LostFoundModal({ onClose, onCreated }) {
  const { api, user, showToast } = useApp();
  const [kind, setKind] = useState('lost'); // 'lost' | 'found'
  const [item, setItem] = useState('');
  const [place, setPlace] = useState('');
  const [coords, setCoords] = useState(null);
  const [when, setWhen] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!item.trim()) return showToast('Please say what the item is.', 'warning');
    if (!place.trim()) return showToast(kind === 'found' ? 'Where did you find it?' : 'Where did you lose it?', 'warning');
    if (!phone.trim()) return showToast('Please add a contact number.', 'warning');
    setBusy(true);
    try {
      const kindWord = kind === 'found' ? 'FOUND' : 'LOST';
      const description = `[${kindWord}] ${item.trim()}` + (notes.trim() ? ` — ${notes.trim()}` : '') + (when ? ` (${when})` : '');
      let photoUrl;
      if (photo) { try { photoUrl = await api.uploadFile(photo, 'lost_found', {}); } catch {} }
      const t = await api.createTicket({
        category: 'Security', subCategory: 'Lost & found',
        categoryDisplay: `Lost & found — ${kind === 'found' ? 'Found item' : 'Lost item'}`,
        location: place.trim(), latitude: coords?.lat, longitude: coords?.lng, description, phone: phone.trim(),
        priority: 'Normal', urgent: false, isPublic: true, upvotes: 1,
        ...(photoUrl ? { photoUrl } : {}),
      });
      showToast(`Posted to Lost & Found (${t.id}).`, 'success');
      onCreated?.(t); onClose();
    } catch (err) { showToast(err.message || 'Failed to post', 'error'); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh] overflow-y-auto lf-modal" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-amber-100 flex items-center justify-between bg-amber-50">
          <h3 className="font-bold text-slate-900 flex items-center gap-2"><Search className="w-5 h-5 text-amber-600" /> Lost &amp; Found</h3>
          <button onClick={onClose} aria-label="Close" className="modal-x"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Did you lose it or find it? *</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setKind('lost')} className={`lf-kind-btn ${kind === 'lost' ? 'active' : ''}`}><Frown className="w-4 h-4" /> I lost something</button>
              <button type="button" onClick={() => setKind('found')} className={`lf-kind-btn ${kind === 'found' ? 'active' : ''}`}><HandHeart className="w-4 h-4" /> I found something</button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">What is it? *</label>
            <input value={item} onChange={e => setItem(e.target.value)} placeholder="e.g. Black wallet, blue water bottle, ID card…" className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg input-enhanced focus:outline-none" />
          </div>
          <LocationPicker
            value={place}
            onChange={setPlace}
            coords={coords}
            onCoordsChange={setCoords}
            placeholder={kind === 'found' ? 'Where did you find it? e.g. Library 2nd floor, Mess…' : 'Where was it lost? e.g. Canteen, Academic Block…'}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">When? (optional)</label>
              <input type="date" value={when} onChange={e => setWhen(e.target.value)} className="login-select w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg input-enhanced focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Contact number *</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" placeholder="Your phone" className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg input-enhanced focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Any details? (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Colour, brand, marks, what's inside…" className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg resize-none input-enhanced focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Photo (optional)</label>
            <label className="flex items-center gap-2 px-3 py-2.5 text-sm border border-dashed border-slate-300 rounded-lg cursor-pointer text-slate-500 hover:border-amber-400 transition-colors">
              <Camera className="w-4 h-4" /><span>{photo ? photo.name : 'Add a photo'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={e => setPhoto(e.target.files?.[0] || null)} />
            </label>
          </div>
          <p className="text-[11px] text-slate-500 flex items-start gap-1.5"><Globe className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Posted on the public Lost &amp; Found board so anyone on campus can help reunite it with its owner.</p>
          <button type="submit" disabled={busy} className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Post to Lost &amp; Found</>}
          </button>
        </form>
      </div>
    </div>
  );
}
