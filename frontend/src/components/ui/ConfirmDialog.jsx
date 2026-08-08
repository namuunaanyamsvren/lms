import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import useDialogA11y from '../../hooks/useDialogA11y';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((options) => {
    const message = typeof options === 'string' ? options : options.message;
    const {
      title = 'Баталгаажуулах',
      confirmLabel = 'Тийм',
      cancelLabel = 'Цуцлах',
      tone = 'default',
    } = typeof options === 'string' ? {} : options;
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setRequest({ title, message, confirmLabel, cancelLabel, tone });
    });
  }, []);

  const settle = (result) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setRequest(null);
  };
  const dialogRef = useDialogA11y(Boolean(request), () => settle(false));

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) settle(false);
          }}
        >
          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-message"
            tabIndex={-1}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 outline-none dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} aria-hidden className={request.tone === 'destructive' ? 'text-rose-500' : 'text-amber-500'} />
                <h3 id="confirm-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">{request.title}</h3>
              </div>
              <button onClick={() => settle(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Хаах">
                <X size={16} aria-hidden />
              </button>
            </div>
            <p id="confirm-message" className="mt-3 text-xs text-slate-600 dark:text-slate-300">{request.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => settle(false)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                {request.cancelLabel}
              </button>
              <button
                onClick={() => settle(true)}
                className={`rounded-2xl px-4 py-2 text-xs font-semibold text-white shadow-md transition ${
                  request.tone === 'destructive' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {request.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
};
