import { useEffect } from 'react';

// Locks page scroll while a modal/drawer is open.
// The counter lives on window so a hot reload or an unexpected unmount can never leave
// the page stuck with overflow:hidden, and release always restores normal scrolling.
const key = '__ccScrollLocks';

function apply() {
  const n = window[key] || 0;
  const html = document.documentElement;
  if (n > 0) {
    const gap = window.innerWidth - html.clientWidth; // avoid layout jump when the scrollbar disappears
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = gap > 0 ? `${gap}px` : '';
  } else {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }
}

export function useBodyScrollLock(isLocked = true) {
  useEffect(() => {
    if (!isLocked) return;
    window[key] = (window[key] || 0) + 1;
    apply();
    return () => {
      window[key] = Math.max(0, (window[key] || 0) - 1);
      apply();
    };
  }, [isLocked]);
}

// Safety net: if no modal is mounted, make sure the page can scroll
if (typeof window !== 'undefined' && !window.__ccScrollGuard) {
  window.__ccScrollGuard = true;
  const heal = () => {
    if (!(window[key] > 0) && document.body.style.overflow === 'hidden') apply();
  };
  window.addEventListener('focus', heal);
  document.addEventListener('visibilitychange', heal);
  window.addEventListener('popstate', heal);
}

export default useBodyScrollLock;
