import { useCallback, useRef, useState } from 'react';
export default function useAsyncAction() {
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const run = useCallback(async action => {
    if (lock.current) return undefined;
    lock.current = true; setPending(true);
    try { return await action(); }
    finally { lock.current = false; setPending(false); }
  }, []);
  return { run, pending };
}
