import { useEffect, useRef, useState } from 'react';

// Subscribe to a live API feed. `subscribe` is an api.subscribeTo*() method.
// Returns { data, loading, error }. Each dashboard calls this only for the
// data it needs — no global store, no full-page reloads.
export function useSubscription(subscribe, deps = [], initial = []) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const subRef = useRef(subscribe);
  subRef.current = subscribe;

  useEffect(() => {
    let unsub;
    try {
      unsub = subRef.current(
        (d) => { setData(d); setLoading(false); },
        (e) => { setError(e); setLoading(false); },
        () => setLoading(false)
      );
    } catch (e) { setError(e); setLoading(false); }
    return () => { if (typeof unsub === 'function') unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}
