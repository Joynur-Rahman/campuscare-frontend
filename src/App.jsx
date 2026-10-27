import React from 'react';
import { AppProvider, useApp } from './context/AppContext.jsx';
import LoginView from './components/LoginView.jsx';
import AuthedApp from './AuthedApp.jsx';
import Toasts from './components/Toast.jsx';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('[CampusCare ErrorBoundary]', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen min-h-[100dvh] flex items-center justify-center p-6 bg-[#dfe7e5] dark:bg-[#101214] text-slate-800 dark:text-slate-100">
          <div className="max-w-md w-full bg-white dark:bg-[#1d2024] p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-[#2a2e35] text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center text-xl font-bold">⚠️</div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">Something unexpected happened</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">{this.state.error?.message || 'A display error occurred.'}</p>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
              className="px-4 py-2 bg-[#262262] hover:bg-[#1a1744] text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Reload CampusCare
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Root() {
  const { user, booting } = useApp();
  if (booting) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-[#101214] text-white">
        <div className="animate-pulse text-sm font-semibold tracking-wide">Loading CampusCare…</div>
      </div>
    );
  }
  return user ? <AuthedApp /> : <LoginView />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <Root />
        <Toasts />
      </AppProvider>
    </ErrorBoundary>
  );
}
