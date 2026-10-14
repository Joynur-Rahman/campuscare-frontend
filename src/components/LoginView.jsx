import { useState } from 'react';
import { SignIn } from '@clerk/react';
import {
  GraduationCap, Wrench, Lock, Shield, HeartPulse, Sparkles, Sun, Moon, Laptop
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';

export default function LoginView() {
  const { mockLogin, IS_MOCK, theme, cycleTheme } = useApp();

  return (
    <div className="min-h-screen flex flex-col justify-between campus-hero-bg">
      <div className="h-1.5 w-full bg-gradient-to-r from-iiitg-900 via-iiitg-gold to-iiitg-900" />

      {/* Institute banner */}
      <header className="institute-banner shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <a href="https://www.iiitg.ac.in" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 min-w-0">
            <span className="logo-plate rounded-xl p-1.5 shrink-0 shadow-sm flex items-center justify-center">
              <img src="/assets/img/iiitg_emblem.png" alt="IIIT Guwahati" className="h-9 sm:h-11 w-9 sm:w-11 object-contain brightness-0 invert drop-shadow-xs" style={{ filter: 'brightness(0) invert(1)' }} />
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
          <div className="lg:col-span-6 max-w-md mx-auto w-full flex flex-col items-center">
            <div className="w-full glass-login-card rounded-2xl shadow-2xl shadow-black/20 overflow-hidden">
              <div className="p-6 sm:p-7 flex justify-center items-center min-h-[400px]">
                <SignIn routing="hash" />
              </div>
            </div>

            {/* Quick Demo Login (Only rendered when running with demo data / IS_MOCK) */}
            {IS_MOCK && (
              <div className="w-full mt-4 p-4 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-white/20 text-white shadow-2xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> 1-Click Demo Login
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                    Demo Data Mode
                  </span>
                </div>
                <p className="text-xs text-slate-300 mb-3">
                  Instantly enter with mock credentials to test all portals:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => mockLogin('student')}
                    className="px-3 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition active:scale-95 text-center flex flex-col items-center gap-1 border border-indigo-400/40 cursor-pointer"
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Student</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => mockLogin('staff')}
                    className="px-3 py-2.5 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow-md transition active:scale-95 text-center flex flex-col items-center gap-1 border border-amber-400/40 cursor-pointer"
                  >
                    <Wrench className="w-4 h-4" />
                    <span>Staff</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => mockLogin('administrator')}
                    className="px-3 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition active:scale-95 text-center flex flex-col items-center gap-1 border border-emerald-400/40 cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Admin</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="bg-iiitg-900 text-slate-300 text-xs py-3 px-4 text-center">
        <strong className="text-white">Indian Institute of Information Technology Guwahati</strong> · Bongora, Assam - 781015
      </footer>
    </div>
  );
}
