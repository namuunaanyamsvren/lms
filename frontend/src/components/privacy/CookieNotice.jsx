import { useState } from 'react';

const STORAGE_KEY = 'lms-essential-cookie-notice-v1';

export default function CookieNotice() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'acknowledged';
    } catch {
      return true;
    }
  });
  if (!visible) return null;

  const acknowledge = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'acknowledged');
    } finally {
      setVisible(false);
    }
  };

  return (
    <section
      aria-label="Cookie notice"
      className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-slate-700">
          LMS нь нэвтрэх session, CSRF хамгаалалт зэрэг систем ажиллахад зайлшгүй
          cookie ашиглана. Одоогоор сурталчилгаа эсвэл analytics cookie ашиглахгүй.{' '}
          <a className="font-medium text-indigo-600 underline" href="/privacy#cookies">
            Дэлгэрэнгүй
          </a>
        </p>
        <button
          type="button"
          onClick={acknowledge}
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Ойлголоо
        </button>
      </div>
    </section>
  );
}
