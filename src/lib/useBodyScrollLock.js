import { useEffect } from 'react';

let lockCount = 0;
let originalStyle = '';

export function useBodyScrollLock(isLocked = true) {
  useEffect(() => {
    if (!isLocked) return;
    if (lockCount === 0) {
      originalStyle = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    lockCount++;
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.style.overflow = originalStyle;
      }
    };
  }, [isLocked]);
}

export default useBodyScrollLock;
