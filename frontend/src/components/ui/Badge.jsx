export default function Badge({ label, variant = 'neutral', className = '' }) {
  const styles = {
    neutral: 'bg-slate-100 text-slate-800',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-rose-100 text-rose-700',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${styles[variant]} ${className}`}>
      {label}
    </span>
  );
}
