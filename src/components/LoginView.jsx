import { useState } from 'react';
import {
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  GraduationCap,
  Wrench,
  Lock,
  Shield,
  HeartPulse,
  BookOpen,
  Building2,
} from 'lucide-react';
import { SignIn, useClerk } from '@clerk/react';

export default function LoginView() {

  return (
    <div className="min-h-screen lg:h-dvh lg:overflow-hidden flex flex-col justify-between campus-hero-bg">
      <div className="h-1 w-full bg-gradient-to-r from-iiitg-900 via-iiitg-gold to-iiitg-900 shrink-0" />

      {/* Institute banner */}
      <header className="institute-banner shadow-md shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3">
          <a
            href="https://www.iiitg.ac.in"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 min-w-0"
          >
            <span className="logo-plate rounded-xl p-1.5 shrink-0 shadow-sm flex items-center justify-center">
              <img
                src="/assets/img/iiitg_emblem.png"
                alt="IIIT Guwahati"
                className="h-8 sm:h-10 w-8 sm:w-10 object-contain"
              />
            </span>
            <div className="min-w-0 hidden sm:block">
              <span className="block text-sm sm:text-base font-extrabold text-white leading-tight tracking-tight truncate">
                Indian Institute of Information Technology Guwahati
              </span>
              <span className="block text-[11px] font-semibold text-slate-300 leading-tight truncate font-hindi">
                भारतीय सूचना प्रौद्योगिकी संस्थान गुवाहाटी · Bongora, Assam
              </span>
            </div>
          </a>
          <div className="flex items-center gap-2.5 shrink-0 pl-3 border-l border-white/20">
            <img src="/assets/img/campuscare-mark.svg" alt="" className="w-8 h-8 sm:w-9 sm:h-9" />
            <div className="text-right hidden sm:block">
              <span className="block text-sm sm:text-base font-extrabold text-white tracking-tight leading-none">
                Campus<span className="text-iiitg-gold">Care</span>
              </span>
              <span className="block text-[9px] sm:text-[10px] font-bold text-amber-300 uppercase tracking-wider mt-0.5">
                Grievance &amp; Service Portal
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero + login */}
      <main className="flex-1 min-h-0 flex items-center py-4 lg:py-3 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center">
          {/* Left Hero Column */}
          <div className="hero-content-left lg:col-span-6 space-y-4 text-center lg:text-left text-white">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-slate-100 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Official Campus Grievance &amp; Service Portal</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.12] drop-shadow-lg">
              A better campus,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-iiitg-gold via-amber-300 to-iiitg-gold">
                together.
              </span>
            </h1>

            <p className="text-sm sm:text-[15px] text-slate-200 font-normal leading-relaxed max-w-xl mx-auto lg:mx-0">
              Report any problem on campus — hostel, academic, Wi-Fi, water, electrical, or lost &amp; found — and track it until it's fixed.
            </p>

            <div className="pt-3 border-t border-white/15">
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-1.5 text-xs text-slate-200">
                <span className="font-bold uppercase tracking-wider text-[10px] text-iiitg-gold">
                  Campus Duty Desk:
                </span>
                <a
                  href="tel:+913612630010"
                  className="flex items-center gap-1.5 hover:text-white transition"
                >
                  <Shield className="w-3.5 h-3.5 text-slate-300" /> Security:{' '}
                  <strong className="text-white font-mono ml-0.5">0361-2630010</strong>
                </a>
                <a
                  href="tel:+913612630015"
                  className="flex items-center gap-1.5 hover:text-white transition"
                >
                  <HeartPulse className="w-3.5 h-3.5 text-rose-300" /> Medical:{' '}
                  <strong className="text-white font-mono ml-0.5">0361-2630015</strong>
                </a>
              </div>
            </div>
          </div>

          {/* Right Login Card Column (Single unified card that never overflows 100dvh) */}
          <div className="lg:col-span-6 max-w-md mx-auto w-full flex flex-col items-center">
            <LoginCard />
          </div>
        </div>
      </main>

      <footer className="bg-iiitg-900/95 text-slate-300 text-xs py-2.5 px-4 text-center shrink-0 border-t border-white/10">
        <strong className="text-white">
          Indian Institute of Information Technology Guwahati
        </strong>{' '}
        · Bongora, Assam - 781015
      </footer>
    </div>
  );
}

// ─────────────────────────── Unified Sign-In Card ───────────────────────────
// Supports all 3 user portals (Campus User, Staff/Technician, Admin) and all 3 Campus User sub-roles
// (Student, Faculty, Non-teaching staff).

const LOGIN_TABS = [
  { key: 'campus', label: 'Campus User', subLabel: 'Student · Faculty', Icon: GraduationCap },
  { key: 'staff', label: 'Staff', subLabel: 'Technician · Caretaker', Icon: Wrench },
  { key: 'admin', label: 'Admin', subLabel: 'Warden · HoD · Office', Icon: Lock },
];

const CAMPUS_ROLES = [
  {
    value: 'student',
    label: 'Student',
    Icon: GraduationCap,
    sub: 'Sign in with your official @iiitg.ac.in Google account.',
  },
  {
    value: 'faculty',
    label: 'Faculty',
    Icon: BookOpen,
    sub: 'Faculty & teaching staff: sign in with your @iiitg.ac.in Google account.',
  },
  {
    value: 'non_teaching',
    label: 'Non-Teaching',
    Icon: Building2,
    sub: 'Office & non-teaching staff: sign in with your registered phone/email and password.',
  },
];

const TAB_COPY = {
  staff: {
    title: 'Technician & Caretaker Desk',
    sub: 'Sign in with your registered phone number (or email) and password.',
    idLabel: 'Phone / Email',
    idPlaceholder: '10-digit mobile or email@iiitg.ac.in',
  },
  admin: {
    title: 'Administrator Console',
    sub: 'For wardens, HoDs and administrative officers.',
    idLabel: 'Admin Username / Email',
    idPlaceholder: 'admin@iiitg.ac.in',
  },
};

const inputCls =
  'cc-login-input w-full h-11 px-3.5 rounded-xl bg-[#0b1424]/90 text-slate-100 text-sm placeholder:text-slate-500 border border-slate-700/80 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 outline-none transition';

const normaliseId = (v) => {
  const t = v.trim();
  const digits = t.replace(/[\s-]/g, '');
  if (/^\d{10}$/.test(digits)) return `+91${digits}`;
  return t;
};

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="w-5 h-5 shrink-0" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

function LoginCard() {
  const clerk = useClerk();
  const [tab, setTab] = useState('campus');
  const [campusRole, setCampusRole] = useState(() => {
    try {
      return sessionStorage.getItem('cc_login_role') || 'student';
    } catch {
      return 'student';
    }
  });
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [clerkFallback, setClerkFallback] = useState(() =>
    typeof window !== 'undefined' &&
    /sso-callback|factor|verify|forgot|reset/.test(window.location.hash)
  );

  const roleInfo = CAMPUS_ROLES.find((r) => r.value === campusRole) || CAMPUS_ROLES[0];
  const usesGoogle = tab === 'campus' && campusRole !== 'non_teaching';
  const copy =
    tab === 'campus'
      ? {
          title: 'Campus Sign In',
          sub: roleInfo.sub,
          idLabel: 'Phone / Email',
          idPlaceholder: 'Phone number or email@iiitg.ac.in',
        }
      : TAB_COPY[tab];

  const switchTab = (k) => {
    setTab(k);
    setError('');
    setPassword('');
  };

  const pickRole = (v) => {
    setCampusRole(v);
    setError('');
    try {
      sessionStorage.setItem('cc_login_role', v);
    } catch {
      /* ignore */
    }
  };

  const clerkError = (e) =>
    e?.errors?.[0]?.longMessage ||
    e?.errors?.[0]?.message ||
    e?.message ||
    'Sign-in failed. Please try again.';

  async function google() {
    setError('');
    try {
      setBusy(true);
      const origin = window.location.origin;
      await clerk.client.signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: `${origin}/#/sso-callback`,
        redirectUrlComplete: `${origin}/`,
      });
    } catch (e) {
      setBusy(false);
      setError(clerkError(e));
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!identifier.trim() || !password) {
      return setError('Enter your phone/email and password.');
    }
    try {
      setBusy(true);
      const res = await clerk.client.signIn.create({
        identifier: normaliseId(identifier),
        password,
      });
      if (res.status === 'complete') {
        await clerk.setActive({ session: res.createdSessionId });
        return;
      }
      setClerkFallback(true);
    } catch (err) {
      setError(clerkError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cc-login-card w-full rounded-3xl overflow-hidden border border-[#2a3a55] bg-[#0f1a2e]/95 backdrop-blur-xl shadow-2xl shadow-black/50 text-white">
      {/* Top 3 User Type Tabs */}
      <div className="grid grid-cols-3 gap-1 p-1.5 bg-[#0b1323] border-b border-white/10">
        {LOGIN_TABS.map(({ key, label, Icon }) => {
          const on = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                switchTab(key);
                setClerkFallback(false);
              }}
              aria-pressed={on}
              className={`relative flex items-center justify-center gap-1.5 py-2.5 px-1.5 rounded-2xl text-[12.5px] sm:text-sm font-bold whitespace-nowrap transition cursor-pointer ${
                on
                  ? 'bg-[#1a2942] text-white shadow-sm ring-1 ring-white/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              <Icon className={`hidden min-[400px]:block w-4 h-4 shrink-0 ${on ? 'text-amber-400' : 'text-slate-400'}`} />
              <span>{label}</span>
              {on && (
                <span className="absolute left-1/2 -translate-x-1/2 bottom-0.5 h-[2.5px] w-1/2 rounded-full bg-amber-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Card Body */}
      <div className="px-6 py-5">
        {/* Compact Horizontal Header */}
        <div className="flex items-center gap-3.5 pb-4 border-b border-white/10">
          <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
            <img src="/assets/img/campuscare-mark.svg" alt="" className="w-8 h-8" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight leading-tight text-white">
              {copy.title}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5 leading-snug">{copy.sub}</p>
          </div>
        </div>

        {clerkFallback ? (
          <div className="mt-4">
            <SignIn routing="hash" appearance={{ variables: { colorPrimary: '#d4af37' } }} />
            <button
              type="button"
              onClick={() => {
                setClerkFallback(false);
                window.location.hash = '';
              }}
              className="mt-3 w-full text-center text-xs font-bold text-amber-400 hover:underline cursor-pointer"
            >
              ← Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3.5" noValidate>
            {/* 1-Click Role Selector for Campus User Tab (Student / Faculty / Non-Teaching) */}
            {tab === 'campus' && (
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-300 mb-1.5">
                  Select Campus Role
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#0b1424] border border-slate-700/80">
                  {CAMPUS_ROLES.map((r) => {
                    const active = campusRole === r.value;
                    const RoleIcon = r.Icon;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => pickRole(r.value)}
                        className={`flex items-center justify-center gap-1 py-2 px-1 rounded-lg text-[11.5px] sm:text-xs font-bold whitespace-nowrap min-w-0 transition cursor-pointer ${
                          active
                            ? 'bg-amber-400 text-slate-950 shadow-sm'
                            : 'text-slate-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <RoleIcon className="hidden min-[400px]:block w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{r.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {usesGoogle ? (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={google}
                  disabled={busy}
                  className="w-full h-11 rounded-xl bg-white hover:bg-amber-50 text-slate-900 text-sm font-extrabold flex items-center justify-center gap-2.5 shadow-lg transition active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin text-slate-700" /> : <GoogleG />}
                  <span>Continue with Google (@iiitg.ac.in)</span>
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label
                    htmlFor="cc-login-id"
                    className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-300 mb-1"
                  >
                    {copy.idLabel}
                  </label>
                  <input
                    id="cc-login-id"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={copy.idPlaceholder}
                    autoComplete="username"
                    className={inputCls}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="cc-login-pw"
                      className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setClerkFallback(true)}
                      className="text-xs font-bold text-amber-300 hover:text-amber-200 cursor-pointer"
                    >
                      Reset password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="cc-login-pw"
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className={`${inputCls} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                >
                  {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
                  ) : (
                    <>
                      <span>Sign In to {tab === 'admin' ? 'Admin Console' : tab === 'staff' ? 'Staff Desk' : 'Campus Portal'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </>
            )}

            {error && (
              <p
                role="alert"
                className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-xl px-3 py-2"
              >
                {error}
              </p>
            )}
          </form>
        )}


        <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <Lock className="w-3 h-3" /> Secured with Clerk Authentication · IIIT Guwahati
        </div>
      </div>
    </div>
  );
}
