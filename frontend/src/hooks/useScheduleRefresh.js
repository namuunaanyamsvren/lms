import { useEffect } from 'react';
import { subscribeScheduleChanges } from '../services/scheduleCache';

export default function useScheduleRefresh(refresh, intervalMs = 30_000) {
  useEffect(() => {
    const unsubscribe = subscribeScheduleChanges(refresh);
    const onFocus = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    const timer = window.setInterval(refresh, intervalMs);
    return () => {
      unsubscribe();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(timer);
    };
  }, [intervalMs, refresh]);
}
