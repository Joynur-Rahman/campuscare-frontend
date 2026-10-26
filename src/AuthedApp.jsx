import TopNav from './components/TopNav.jsx';
import StudentPortal from './portals/StudentPortal.jsx';
import TechnicianPortal from './portals/TechnicianPortal.jsx';
import AdminPortal from './portals/AdminPortal.jsx';
import { useApp } from './context/AppContext.jsx';

export default function AuthedApp() {
  const { user } = useApp();
  const role = user?.role;
  const isAdmin = role === 'admin' || role === 'administrator';
  const portal = isAdmin ? 'Admin Portal' : role === 'staff' ? 'Staff Portal' : 'Campus Portal';
  const Body = isAdmin ? AdminPortal : role === 'staff' ? TechnicianPortal : StudentPortal;

  return (
    <div className="app-canvas min-h-screen min-h-[100dvh] flex flex-col bg-[#dfe7e5] dark:bg-[#101214] text-slate-900 dark:text-slate-100 transition-colors pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <TopNav portal={portal} tabs={[]} activeTab="" onTab={() => {}} />
      <div className="flex-1 flex flex-col min-h-0 w-full">
        <Body />
      </div>
    </div>
  );
}
