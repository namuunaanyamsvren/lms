const STORAGE_KEY = 'lms:schedule-version';
const EVENT_NAME = 'lms:schedule-changed';

export const notifyScheduleChanged = detail => {
  const version = {
    ...detail,
    changedAt: new Date().toISOString(),
  };
  if (typeof window === 'undefined') return version;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: version }));
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(version));
  } catch {
    // The in-tab event still invalidates the active view when storage is unavailable.
  }
  return version;
};

export const subscribeScheduleChanges = callback => {
  if (typeof window === 'undefined') return () => {};
  const onChange = event => callback(event.detail);
  const onStorage = event => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      callback(JSON.parse(event.newValue));
    } catch {
      callback();
    }
  };
  window.addEventListener(EVENT_NAME, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT_NAME, onChange);
    window.removeEventListener('storage', onStorage);
  };
};
