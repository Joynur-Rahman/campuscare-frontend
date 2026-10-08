import { AppProvider, useApp } from './context/AppContext.jsx';
import LoginView from './components/LoginView.jsx';
import AuthedApp from './AuthedApp.jsx';
import Toasts from './components/Toast.jsx';

function Root() {
  const { user, booting } = useApp();
  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-iiitg-900 text-white">
        <div className="animate-pulse text-sm font-semibold tracking-wide">Loading CampusCare…</div>
      </div>
    );
  }
  return user ? <AuthedApp /> : <LoginView />;
}

export default function App() {
  return (
    <AppProvider>
      <Root />
      <Toasts />
    </AppProvider>
  );
}
