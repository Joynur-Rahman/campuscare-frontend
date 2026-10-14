import TopNav from './components/TopNav.jsx';
import StudentPortal from './portals/StudentPortal.jsx';
import TechnicianPortal from './portals/TechnicianPortal.jsx';
import AdminPortal from './portals/AdminPortal.jsx';
import { useApp } from './context/AppContext.jsx';
import { GraduationCap, Wrench, ShieldAlert } from 'lucide-react';

export default function AuthedApp() {
  const { user, mockLogin, IS_MOCK } = useApp();
  const role = user?.role;
  const isAdmin = role === 'admin' || role === 'administrator';
  const portal = isAdmin ? 'Admin Portal' : role === 'staff' ? 'Staff Portal' : 'Campus Portal';
  const Body = isAdmin ? AdminPortal : role === 'staff' ? TechnicianPortal : StudentPortal;

  return (
    <div className="app-canvas min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <TopNav portal={portal} tabs={[]} activeTab="" onTab={() => {}} />
      <Body />

      {/* Floating Demo Role Switcher (Visible only when running with demo data / IS_MOCK) */}
      {IS_MOCK && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 p-1.5 bg-slate-900/90 dark:bg-slate-800/90 backdrop-blur-md border border-white/20 rounded-full shadow-2xl text-xs text-white">
          <span className="text-[10px] font-bold text-amber-400 px-2 uppercase tracking-wider hidden sm:inline">
            Demo Role:
          </span>
          <button
            type="button"
            onClick={() => mockLogin('student')}
            className={`px-2.5 py-1 rounded-full font-medium transition cursor-pointer flex items-center gap-1 ${
              role === 'student' ? 'bg-indigo-600 text-white font-bold shadow' : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
            title="Switch to Student Demo"
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Student</span>
          </button>
          <button
            type="button"
            onClick={() => mockLogin('staff')}
            className={`px-2.5 py-1 rounded-full font-medium transition cursor-pointer flex items-center gap-1 ${
              role === 'staff' ? 'bg-amber-600 text-white font-bold shadow' : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
            title="Switch to Staff/Technician Demo"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Staff</span>
          </button>
          <button
            type="button"
            onClick={() => mockLogin('administrator')}
            className={`px-2.5 py-1 rounded-full font-medium transition cursor-pointer flex items-center gap-1 ${
              isAdmin ? 'bg-emerald-600 text-white font-bold shadow' : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
            title="Switch to Admin Demo"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Admin</span>
          </button>
        </div>
      )}
    </div>
  );
}
