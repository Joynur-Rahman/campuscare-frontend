import { X, PhoneCall, ShieldAlert, Activity, Shield, HeartPulse, Building2, GraduationCap } from 'lucide-react';
import { useBodyScrollLock } from '../lib/useBodyScrollLock.js';

const CARDS = [
  { Icon: ShieldAlert, title: 'National Emergency', sub: 'Police · Fire · Disaster', label: '112', tel: '112', red: true },
  { Icon: Activity, title: 'Ambulance', sub: 'Medical emergency (India)', label: '108', tel: '108', red: true },
  { Icon: Shield, title: 'Campus Security', sub: 'Main gate · 24/7', label: '0361-2630010', tel: '+913612630010', red: true },
  { Icon: HeartPulse, title: 'Campus Medical Centre', sub: 'First aid & on-call doctor', label: '0361-2630015', tel: '+913612630015', red: true },
  { Icon: Building2, title: 'Administration Office', sub: 'General help · office hours', label: '+91-361-2801084', tel: '+913612801084', red: false },
  { Icon: GraduationCap, title: 'Academic Section', sub: 'Academics & exam matters', label: '+91-361-2801090', tel: '+913612801090', red: false },
];

export default function EmergencyModal({ onClose }) {
  useBodyScrollLock();
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overscroll-contain" onClick={onClose}>
      <div 
        className="bg-white dark:bg-[#152d43] border border-slate-200 dark:border-[#36365f] rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col overflow-hidden max-h-[90vh] animate-fade-in-up overscroll-contain" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header with High-Contrast Clear Title */}
        <div className="px-6 py-4 border-b border-rose-200 dark:border-rose-900/60 flex items-center justify-between bg-rose-50/90 dark:bg-[#201c2b] text-rose-900 dark:text-rose-200">
          <h3 className="font-extrabold text-base sm:text-lg flex items-center gap-2.5 text-rose-900 dark:text-rose-200 tracking-tight">
            <span className="p-1.5 rounded-lg bg-rose-200/80 dark:bg-rose-900/70 text-rose-800 dark:text-rose-200 shrink-0">
              <PhoneCall className="w-5 h-5" />
            </span>
            Campus Emergency Directory
          </h3>
          <button 
            onClick={onClose} 
            aria-label="Close" 
            className="p-1.5 rounded-lg text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-white hover:bg-rose-200/60 dark:hover:bg-rose-900/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Directory Cards Grid */}
        <div className="p-6 overflow-y-auto bg-slate-50/60 dark:bg-[#112a40] grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CARDS.map((c, i) => (
            <div 
              key={i} 
              className={`p-4 rounded-xl border flex flex-col items-center text-center transition-all shadow-sm hover:shadow-md ${
                c.red 
                  ? 'border-rose-200/90 dark:border-rose-900/60 bg-white dark:bg-[#1a354e] hover:border-rose-300 dark:hover:border-rose-700' 
                  : 'border-slate-200 dark:border-[#36365f] bg-white dark:bg-[#1a354e] hover:border-slate-300 dark:hover:border-[#466188]'
              }`}
            >
              <div className={`p-2.5 rounded-xl mb-2.5 border ${
                c.red
                  ? 'bg-rose-50 dark:bg-rose-950/70 text-rose-600 dark:text-rose-300 border-rose-200/60 dark:border-rose-800/60'
                  : 'bg-indigo-50 dark:bg-[#20405c] text-indigo-600 dark:text-[#a4a4e8] border-indigo-100 dark:border-[#36365f]'
              }`}>
                <c.Icon className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>

              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                {c.title}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-300 mb-3.5 mt-1 font-medium">
                {c.sub}
              </p>

              <a 
                href={`tel:${c.tel}`} 
                className={`px-4 py-2.5 rounded-xl text-xs font-bold w-full transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] ${
                  c.red 
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20' 
                    : 'bg-slate-800 hover:bg-slate-900 dark:bg-[#5252a2] dark:hover:bg-[#6161b5] text-white shadow-indigo-600/20'
                }`}
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Call {c.label}</span>
              </a>
            </div>
          ))}

          <p className="sm:col-span-2 text-xs text-slate-600 dark:text-slate-300 text-center mt-2 leading-relaxed bg-white dark:bg-[#152d43] p-3 rounded-xl border border-slate-200 dark:border-[#36365f]">
            <strong className="text-rose-600 dark:text-rose-400 font-extrabold">112</strong> and <strong className="text-rose-600 dark:text-rose-400 font-extrabold">108</strong> are national emergency lines. Campus numbers are IIIT Guwahati office lines (<span className="text-slate-700 dark:text-slate-200 font-semibold">iiitg.ac.in</span>).
          </p>
        </div>
      </div>
    </div>
  );
}
