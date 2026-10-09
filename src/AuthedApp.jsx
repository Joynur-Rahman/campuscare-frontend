import TopNav from './components/TopNav.jsx';
import StudentPortal from './portals/StudentPortal.jsx';
import TechnicianPortal from './portals/TechnicianPortal.jsx';
import AdminPortal from './portals/AdminPortal.jsx';
import { useApp } from './context/AppContext.jsx';

export default function AuthedApp() {
  const { user, mockLogin } = useApp();
  const role = user?.role || 'student';
  const portal = role === 'administrator' ? 'Admin Portal' : role === 'staff' ? 'Staff Portal' : 'Campus Portal';
  const Body = role === 'administrator' ? AdminPortal : role === 'staff' ? TechnicianPortal : StudentPortal;

  return (
    <div className="min-h-screen bg-slate-50 relative pb-16">
      <TopNav portal={portal} tabs={[]} activeTab="" onTab={() => {}} />
      <Body />

      {/* Floating Dev Role Switcher */}
      <div className="fixed bottom-4 left-4 z-20 flex items-center gap-2 bg-[#262262]/95 backdrop-blur-md text-white text-xs px-3.5 py-2 rounded-full shadow-2xl border border-white/20">
        <span className="font-extrabold text-amber-300 uppercase tracking-wider text-[10px]">Dev Role:</span>
        <button
          onClick={() => mockLogin('student')}
          className={`px-2.5 py-1 rounded-full font-semibold transition cursor-pointer ${role === 'student' ? 'bg-indigo-500 text-white shadow' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}
        >
          Student
        </button>
        <button
          onClick={() => mockLogin('staff')}
          className={`px-2.5 py-1 rounded-full font-semibold transition cursor-pointer ${role === 'staff' ? 'bg-amber-500 text-white shadow' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}
        >
          Staff
        </button>
        <button
          onClick={() => mockLogin('administrator')}
          className={`px-2.5 py-1 rounded-full font-semibold transition cursor-pointer ${role === 'administrator' ? 'bg-emerald-500 text-white shadow' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}
        >
          Admin
        </button>
      </div>
    </div>
  );
}
