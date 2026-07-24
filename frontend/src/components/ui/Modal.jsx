export default function Modal({ open, title, children, footer, onClose, className = '' }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className={`w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl ${className}`}>
        <div className="mb-5 flex items-center justify-between">
          {title && <h2 className="text-xl font-semibold text-slate-900">{title}</h2>}
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">Close</button>
        </div>
        <div className="space-y-4">{children}</div>
        {footer && <div className="mt-6 border-t border-slate-200 pt-4">{footer}</div>}
      </div>
    </div>
  );
}
