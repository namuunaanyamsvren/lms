import { useRouteError, useNavigate, isRouteErrorResponse } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

export default function RouteError() {
  const error = useRouteError();
  const navigate = useNavigate();
  const status = isRouteErrorResponse(error) ? error.status : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center">
      <AlertTriangle size={40} className="text-rose-500" />
      <h1 className="text-lg font-bold text-slate-900">
        {status ? `Алдаа (${status})` : 'Хуудас ачаалахад алдаа гарлаа'}
      </h1>
      <p className="max-w-md text-sm text-slate-500">
        Энэ хуудсыг харуулах явцад алдаа гарлаа. Дахин оролдоно уу.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => navigate(-1)}
          className="rounded-2xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Буцах
        </button>
        <button
          onClick={() => navigate('/')}
          className="rounded-2xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 shadow-md transition"
        >
          Нүүр хуудас
        </button>
      </div>
    </div>
  );
}
