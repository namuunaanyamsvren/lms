import { X } from 'lucide-react';
import useDialogA11y from '../../hooks/useDialogA11y';

export default function Modal({ open, title, children, footer, onClose, className = '' }) {
  const dialogRef = useDialogA11y(open, onClose);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        tabIndex={-1}
        className={`w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl outline-none ${className}`}
      >
        <div className="mb-5 flex items-center justify-between">
          {title && <h2 id="modal-title" className="text-xl font-semibold text-slate-900">{title}</h2>}
          <button onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Хаах">
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="space-y-4">{children}</div>
        {footer && <div className="mt-6 border-t border-slate-200 pt-4">{footer}</div>}
      </div>
    </div>
  );
}
