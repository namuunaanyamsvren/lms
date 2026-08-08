import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
export default function useUnsavedChanges(dirty, message = 'Хадгалаагүй өөрчлөлт байна. Хуудсаас гарах уу?') {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm(message)) blocker.proceed();
      else blocker.reset();
    }
  }, [blocker, message]);
  useEffect(() => {
    const before = event => { if (!dirty) return; event.preventDefault(); event.returnValue = message; };
    window.addEventListener('beforeunload', before);
    return () => window.removeEventListener('beforeunload', before);
  }, [dirty, message]);
}
