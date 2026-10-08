import TopNav from './components/TopNav.jsx';
import StudentPortal from './portals/StudentPortal.jsx';
import TechnicianPortal from './portals/TechnicianPortal.jsx';
import AdminPortal from './portals/AdminPortal.jsx';
import { useApp } from './context/AppContext.jsx';

export default function AuthedApp() {
  const { user } = useApp();
  const role = user?.role;
  const portal = role === 'administrator' ? 'Admin Portal' : role === 'staff' ? 'Staff Portal' : 'Campus Portal';
  const Body = role === 'administrator' ? AdminPortal : role === 'staff' ? TechnicianPortal : StudentPortal;

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav portal={portal} tabs={[]} activeTab="" onTab={() => {}} />
      <Body />
    </div>
  );
}
