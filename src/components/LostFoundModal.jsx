import { useEffect, useMemo, useState } from 'react';
import { X, Send, Loader2, Search, Frown, HandHeart, ImagePlus, Globe, Trash2, Check } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import LocationPicker from './LocationPicker.jsx';
import { useBodyScrollLock } from '../lib/useBodyScrollLock.js';
import { findMatchingLandmark } from '../lib/mappls.js';

function Step({ n, title, hint }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-[11px] font-black flex items-center justify-center shrink-0">{n}</span>
      <div className="min-w-0">
        <p className="text-[13px] font-extrabold text-slate-900 leading-tight">{title}</p>
        {hint && <p className="text-[11px] text-slate-500 leading-tight">{hint}</p>}
      </div>
    </div>
  );
}

const KINDS = [
  { key: 'lost', title: 'I lost something', sub: 'Ask campus to look out for it', Icon: Frown },
  { key: 'found', title: 'I found something', sub: 'Help it get back to its owner', Icon: HandHeart },
];

// Dedicated Lost & Found posting flow — NOT the generic ticket form.
export default function LostFoundModal({ onClose, onCreated }) {
  useBodyScrollLock();
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
  const photoUrlPreview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => { if (photoUrlPreview) URL.revokeObjectURL(photoUrlPreview); }, [photoUrlPreview]);
  const inputCls = 'w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white input-enhanced focus:outline-none';

  async function submit(e) {
    e.preventDefault();
    if (!item.trim()) return showToast('Please say what the item is.', 'warning');
    if (!place.trim()) return showToast(kind === 'found' ? 'Where did you find it?' : 'Where did you lose it?', 'warning');
    if (!phone.trim()) return showToast('Please add a contact number.', 'warning');

    // Strict validation for the 13 official campus locations
    const matchedLandmark = findMatchingLandmark(place);
    if (!matchedLandmark) {
      return showToast('Please select one of the 13 official campus locations (e.g. Library, Canteen, Boys Hostel...).', 'warning');
    }

    setBusy(true);
    try {
      const roomMatch = place.match(/(Room\s+[A-Za-z0-9-]+|Floor\s+\d+|Lab\s+[A-Za-z0-9-]+|Flat\s+\d+)/i);
      const detail = roomMatch ? ` (${roomMatch[0]})` : '';
      const finalLocation = `${matchedLandmark.name}${detail}, IIIT Guwahati Campus`;

      const kindWord = kind === 'found' ? 'FOUND' : 'LOST';
      const description = `[${kindWord}] ${item.trim()}` + (notes.trim() ? ` — ${notes.trim()}` : '') + (when ? ` (${when})` : '');
      let photoUrl;
      if (photo) { try { photoUrl = await api.uploadFile(photo, 'lost_found', {}); } catch {} }
      const t = await api.createTicket({
        category: 'Security', subCategory: 'Lost & found',
        categoryDisplay: `Lost & found — ${kind === 'found' ? 'Found item' : 'Lost item'}`,
        location: finalLocation, latitude: matchedLandmark.lat, longitude: matchedLandmark.lng, description, phone: phone.trim(),
        priority: 'Normal', urgent: false, isPublic: true, upvotes: 1,
        ...(photoUrl ? { photoUrl } : {}),
      });
      showToast(`Posted to Lost & Found (${t.id}).`, 'success');
      onCreated?.(t); onClose();
    } catch (err) { showToast(err.message || 'Failed to post', 'error'); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-md" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh] overflow-hidden lf-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="shrink-0 px-5 py-4 border-b border-amber-100 flex items-center justify-between gap-3 bg-amber-50">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Search className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h3 className="font-extrabold text-slate-900 leading-tight">Lost &amp; Found</h3>
              <p className="text-[11.5px] text-slate-600 leading-tight">Post it once — the whole campus can help</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="modal-x shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={submit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-6">
            {/* 1. Lost or found */}
            <div className="space-y-3">
              <Step n={1} title="Did you lose it or find it?" />
              <div className="grid grid-cols-2 gap-2.5">
                {KINDS.map(({ key, title, sub, Icon }) => {
                  const on = kind === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setKind(key)}
                      aria-pressed={on}
                      className={`relative text-left p-3 rounded-xl border-2 transition ${on ? 'border-amber-500 bg-amber-50 shadow-sm' : 'border-slate-200 bg-white hover:border-amber-300'}`}
                    >
                      {on && <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center"><Check className="w-3 h-3" /></span>}
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${on ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}><Icon className="w-4 h-4" /></span>
                      <span className="block text-[13px] font-bold text-slate-900">{title}</span>
                      <span className="block text-[11px] text-slate-500 leading-snug">{sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Item */}
            <div className="space-y-3">
              <Step n={2} title="What is it?" hint="A short name and anything that helps identify it" />
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Item *</label>
                <input value={item} onChange={e => setItem(e.target.value)} maxLength={80} placeholder="e.g. Black wallet, blue water bottle, ID card…" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Details <span className="font-medium text-slate-500">(optional)</span></label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Colour, brand, marks, what's inside…" className={`${inputCls} resize-none`} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Photo <span className="font-medium text-slate-500">(optional)</span></label>
                {photo ? (
                  <div className="flex items-center gap-3 p-2 rounded-xl border border-slate-200 bg-slate-50">
                    <img src={photoUrlPreview} alt="" className="w-14 h-14 rounded-lg object-cover border border-slate-200" />
                    <span className="flex-1 min-w-0 text-[12px] font-semibold text-slate-700 truncate">{photo.name}</span>
                    <button type="button" onClick={() => setPhoto(null)} aria-label="Remove photo" className="w-8 h-8 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-amber-400 cursor-pointer text-slate-500 hover:text-amber-700 transition">
                    <span className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center"><ImagePlus className="w-5 h-5" /></span>
                    <span className="text-[12.5px] font-semibold">Add a photo <span className="block text-[11px] font-normal text-slate-500">A picture makes it much easier to recognise</span></span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => setPhoto(e.target.files?.[0] || null)} />
                  </label>
                )}
              </div>
            </div>

            {/* 3. Where & when */}
            <div className="space-y-3">
              <Step n={3} title={kind === 'found' ? 'Where and when did you find it?' : 'Where and when did you lose it?'} />
              <LocationPicker
                value={place}
                onChange={setPlace}
                coords={coords}
                onCoordsChange={setCoords}
                label="Place *"
                placeholder={kind === 'found' ? 'e.g. Library 2nd floor, Mess…' : 'e.g. Canteen, Academic Block…'}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Date <span className="font-medium text-slate-500">(optional)</span></label>
                  <input type="date" value={when} onChange={e => setWhen(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Contact number *</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" placeholder="Your phone" className={inputCls} />
                </div>
              </div>
            </div>

            <p className="text-[11.5px] text-slate-600 flex items-start gap-2 rounded-xl bg-amber-50/70 border border-amber-100 px-3 py-2.5">
              <Globe className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
              Posted on the public Lost &amp; Found board so anyone on campus can help reunite it with its owner.
            </p>
          </div>

          {/* Footer */}
          <div className="shrink-0 px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Post to Lost &amp; Found</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
