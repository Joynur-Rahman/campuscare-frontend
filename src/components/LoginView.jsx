import { useState } from 'react';
import { SignIn } from '@clerk/react';
import {
  GraduationCap, Wrench, Lock, Eye, EyeOff, ArrowRight, Loader2,
  Shield, HeartPulse, ShieldCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { IS_MOCK } from '../api';

const TABS = [
  { key: 'student', label: 'Campus User', Icon: GraduationCap },
  { key: 'staff', label: 'Staff', Icon: Wrench },
  { key: 'admin', label: 'Admin', Icon: Lock },
];

export default function LoginView() {
  const { login, showToast, api } = useApp();
  const [role, setRole] = useState('student');
  const [campusType, setCampusType] = useState('student'); // student | faculty | nonteaching
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);

  const isNonTeaching = role === 'student' && campusType === 'nonteaching';
  const showGoogle = role === 'student' && !isNonTeaching;
  const adminDefault = role === 'admin' ? 'admin@iiitg.ac.in' : '';

  const heading = role === 'admin' ? 'Administrator Console' : role === 'staff' ? 'Technician & Caretaker Desk' : 'Campus Sign In';
  const sub = role === 'admin'
    ? 'Warden, HoD & Administrative Officer access.'
    : role === 'staff'
      ? 'Technicians: sign in with your phone/email and the password the admin set up.'
      : isNonTeaching
        ? 'Non-teaching staff: sign in with the phone/email and password the admin set up for you.'
        : campusType === 'faculty'
          ? 'Faculty & teaching staff: sign in with your official IIITG Google account.'
          : 'Students: sign in with your official IIITG Google account.';

  async function handlePasswordLogin(e) {
    e.preventDefault();
    let id = (identifier || adminDefault).trim().toLowerCase();
    if (role === 'admin' && id && !id.includes('@')) id = `${id}@iiitg.ac.in`;
    const effectiveRole = (role === 'staff' || isNonTeaching) ? 'staff' : role;
    setBusy(true);
    try {
      if (effectiveRole === 'staff' && id && !id.includes('@')) {
        const digits = id.replace(/\D/g, '');
        if (digits.length < 10) throw new Error('Enter your 10-digit phone number or email.');
        const email = await api.resolveStaffEmailByPhone(digits);
        if (!email) throw new Error('No staff account found for that phone number. Try your email.');
        id = email;
      }
      await login({ email: id, password, role: effectiveRole });
      setPassword('');
    } catch (err) {
      showToast(err.message || 'Authentication failed', 'error');
    } finally { setBusy(false); }
  }

  async function handleGoogle() {
    setBusy(true);
    try { await login({ role: 'student' }); }
    catch (err) { showToast(err.message || 'Google sign-in failed', 'error'); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between campus-hero-bg">
      <div className="h-1.5 w-full bg-gradient-to-r from-iiitg-900 via-iiitg-gold to-iiitg-900" />

      {/* Institute banner */}
      <header className="institute-banner shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <a href="https://www.iiitg.ac.in" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 min-w-0">
            <span className="logo-plate rounded-xl p-1.5 shrink-0 shadow-sm flex items-center justify-center">
              <img src="/assets/img/iiitg_emblem.png" alt="IIIT Guwahati" className="h-9 sm:h-11 w-9 sm:w-11 object-contain" />
            </span>
            <div className="min-w-0 hidden sm:block">
              <span className="block text-sm sm:text-base font-extrabold text-white leading-tight tracking-tight truncate">Indian Institute of Information Technology Guwahati</span>
              <span className="block text-[11px] font-semibold text-slate-300 leading-tight truncate font-hindi">भारतीय सूचना प्रौद्योगिकी संस्थान गुवाहाटी · Bongora, Assam</span>
            </div>
          </a>
          <div className="flex items-center gap-2.5 shrink-0 pl-3 border-l border-white/20">
            <img src="/assets/img/campuscare-mark.svg" alt="" className="w-9 h-9 sm:w-10 sm:h-10" />
            <div className="text-right hidden sm:block">
              <span className="block text-sm sm:text-base font-extrabold text-white tracking-tight leading-none">Campus<span className="text-iiitg-gold">Care</span></span>
              <span className="block text-[9px] sm:text-[10px] font-bold text-amber-300 uppercase tracking-wider mt-0.5">Grievance &amp; Service Portal</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero + login */}
      <main className="flex-1 flex items-center py-8 lg:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
          <div className="hero-content-left lg:col-span-6 space-y-5 text-center lg:text-left text-white">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-slate-200 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Official Campus Grievance &amp; Service Portal
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.15] drop-shadow-lg">
              A better campus, <span className="text-transparent bg-clip-text bg-gradient-to-r from-iiitg-gold via-amber-300 to-iiitg-gold">together.</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-200 font-normal leading-relaxed max-w-xl mx-auto lg:mx-0">
              Report any problem on campus — hostel, academic, Wi-Fi, water, electrical and more — and watch it get resolved. Built for every member of IIIT Guwahati: students, faculty and staff.
            </p>
            <div className="pt-4 border-t border-white/15">
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-xs text-slate-200">
                <span className="font-bold uppercase tracking-wider text-[10px] text-iiitg-gold">Campus Duty Desk:</span>
                <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-slate-300" /> Security: <strong className="text-white font-mono ml-1">0361-2630010</strong></span>
                <span className="flex items-center gap-1.5"><HeartPulse className="w-3.5 h-3.5 text-rose-300" /> Medical: <strong className="text-white font-mono ml-1">0361-2630015</strong></span>
              </div>
            </div>
          </div>

          {/* Login card */}
          <div className="lg:col-span-6 max-w-md mx-auto w-full">
            <div className="glass-login-card rounded-2xl shadow-2xl shadow-black/20 overflow-hidden">
              <div className="p-6 sm:p-7 flex justify-center items-center min-h-[400px]">
                <SignIn routing="hash" />
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-iiitg-900 text-slate-300 text-xs py-3 px-4 text-center">
        <strong className="text-white">Indian Institute of Information Technology Guwahati</strong> · Bongora, Assam - 781015
      </footer>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"/></svg>
  );
}
