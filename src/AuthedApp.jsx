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
    <div className="app-canvas min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <TopNav portal={portal} tabs={[]} activeTab="" onTab={() => {}} />
      <Body />

    </div>
  );
}
