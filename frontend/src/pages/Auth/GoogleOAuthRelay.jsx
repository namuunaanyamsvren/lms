import { useEffect, useRef } from 'react';

export default function GoogleOAuthRelay() {
  const started = useRef(false);

  useEffect(() => {
    // Google's authorization code and our Redis-backed state are single-use,
    // so this redirect must fire exactly once. Without this guard, React
    // StrictMode's dev-mode double-invoke replays the same code/state pair,
    // and the second callback request always fails.
    if (started.current) return;
    started.current = true;

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
    const incoming = new URLSearchParams(window.location.search);
    const backendCallback = new URL(`${apiBaseUrl}/auth/google/callback`, window.location.origin);

    for (const name of ['code', 'state', 'error']) {
      const value = incoming.get(name);
      if (value) backendCallback.searchParams.set(name, value);
    }

    window.location.replace(backendCallback.toString());
  }, []);

  return (
    <div className="rounded-2xl bg-white p-6 text-center shadow-md sm:p-8">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
      <h1 className="mt-4 text-xl font-bold text-gray-900">Google нэвтрэлтийг баталгаажуулж байна</h1>
      <p className="mt-2 text-sm text-gray-500">Түр хүлээнэ үү…</p>
    </div>
  );
}
