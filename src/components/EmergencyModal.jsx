import { X, PhoneCall, ShieldAlert, Activity, Shield, HeartPulse, Building2, GraduationCap } from 'lucide-react';

const CARDS = [
  { Icon: ShieldAlert, title: 'National Emergency', sub: 'Police · Fire · Disaster', label: '112', tel: '112', red: true },
  { Icon: Activity, title: 'Ambulance', sub: 'Medical emergency (India)', label: '108', tel: '108', red: true },
  { Icon: Shield, title: 'Campus Security', sub: 'Main gate · 24/7', label: '0361-2630010', tel: '+913612630010', red: true },
  { Icon: HeartPulse, title: 'Campus Medical Centre', sub: 'First aid & on-call doctor', label: '0361-2630015', tel: '+913612630015', red: true },
  { Icon: Building2, title: 'Administration Office', sub: 'General help · office hours', label: '+91-361-2801084', tel: '+913612801084', red: false },
  { Icon: GraduationCap, title: 'Academic Section', sub: 'Academics & exam matters', label: '+91-361-2801090', tel: '+913612801090', red: false },
];

export default function EmergencyModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col overflow-hidden max-h-[90vh] lf-modal" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-rose-100 flex items-center justify-between bg-rose-50 text-rose-900">
          <h3 className="font-bold text-lg flex items-center gap-2"><PhoneCall className="w-5 h-5" /> Campus Emergency Directory</h3>
          <button onClick={onClose} aria-label="Close" className="modal-x"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 overflow-y-auto bg-white grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CARDS.map((c, i) => (
            <div key={i} className={`p-4 rounded-xl border flex flex-col items-center text-center ${c.red ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200 bg-slate-50'}`}>
              <c.Icon className={`w-8 h-8 mb-2 ${c.red ? 'text-rose-600' : 'text-slate-600'}`} />
              <h4 className="font-bold text-sm text-slate-900">{c.title}</h4>
              <p className="text-xs text-slate-500 mb-3 mt-1">{c.sub}</p>
              <a href={`tel:${c.tel}`} className={`px-4 py-2 rounded-lg text-xs font-bold w-full transition-colors text-white ${c.red ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-800 hover:bg-slate-900'}`}>Call {c.label}</a>
            </div>
          ))}
          <p className="sm:col-span-2 text-[11px] text-slate-400 text-center mt-1 leading-relaxed">
            <strong className="text-rose-600">112</strong> and <strong className="text-rose-600">108</strong> are national emergency lines. Campus numbers are IIIT Guwahati office lines (iiitg.ac.in).
          </p>
        </div>
      </div>
    </div>
  );
}
