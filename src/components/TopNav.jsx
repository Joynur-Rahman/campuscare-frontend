import { useState } from 'react';
import { useClerk } from '@clerk/react';
import { Siren, Monitor, Moon, Sun, LogOut, User, KeyRound } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import EmergencyModal from './EmergencyModal.jsx';

export default function TopNav({ portal, tabs, activeTab, onTab }) {
  const { user, logout, theme, cycleTheme } = useApp();
  const { openUserProfile } = useClerk();
  const [emergency, setEmergency] = useState(false);
  const [menu, setMenu] = useState(false);
  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  const initials = (user?.name || user?.email || 'U').slice(0, 1).toUpperCase();

  return (
    <header className="sticky top-0 z-40 bg-[#262262] text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
        <div className="flex items-center gap-2.5 shrink-0">
          <img src="/assets/img/campuscare-mark.svg" alt="" className="w-9 h-9" />
          <div className="leading-none">
            <span className="block text-[15px] font-extrabold tracking-tight">Campus<span className="text-iiitg-gold">Care</span></span>
            <span className="block text-[9px] text-slate-300 uppercase font-bold mt-1 tracking-widest">{portal}</span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-1 ml-6 overflow-x-auto no-scrollbar">
          {tabs.map(t => (
            <button key={t.key} onClick={() => onTab(t.key)}
              className={`nav-link ${activeTab === t.key ? 'active' : ''}`}>
              {t.Icon && <t.Icon className="w-4 h-4" />}{t.label}
            </button>
          ))}
        </nav>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5">
          <button onClick={cycleTheme} className="nav-icon-btn" title={`Theme: ${theme}`}><ThemeIcon className="w-5 h-5" /></button>
          <button onClick={() => setEmergency(true)} className="emergency-btn" title="Emergency — campus help numbers">
            <Siren className="w-5 h-5" /><span className="emergency-btn-label">SOS</span>
          </button>
          <div className="relative ml-1">
            <button onClick={() => setMenu(m => !m)} className="w-9 h-9 rounded-full bg-gradient-to-tr from-iiitg-gold to-amber-300 text-iiitg-900 font-extrabold text-xs flex items-center justify-center ring-2 ring-white/20">
              {initials}
            </button>
            {menu && (
              <div className="absolute right-0 mt-3 w-60 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 text-sm text-slate-700 z-50" onMouseLeave={() => setMenu(false)}>
                <div className="px-4 py-3 border-b border-slate-100">
                  <span className="font-bold text-slate-900 block truncate flex items-center gap-2"><User className="w-4 h-4 text-slate-400" />{user?.name || user?.full_name || 'User'}</span>
                  <span className="text-slate-500 text-xs block truncate font-mono mt-1">{user?.email}</span>
                </div>
                <button
                  onClick={() => { setMenu(false); openUserProfile?.(); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-slate-50 text-slate-700 font-semibold border-b border-slate-100 transition-colors"
                >
                  <KeyRound className="w-4 h-4 text-slate-500" /> Account &amp; Password
                </button>
                <button onClick={logout} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-slate-50 text-rose-600 font-semibold transition-colors">
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* mobile tabs */}
      <nav className="md:hidden flex items-center gap-1 px-3 pb-2 overflow-x-auto no-scrollbar">
        {tabs.map(t => (
          <button key={t.key} onClick={() => onTab(t.key)} className={`nav-link text-xs ${activeTab === t.key ? 'active' : ''}`}>
            {t.Icon && <t.Icon className="w-4 h-4" />}{t.label}
          </button>
        ))}
      </nav>

      {emergency && <EmergencyModal onClose={() => setEmergency(false)} />}
    </header>
  );
}
