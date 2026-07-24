export default function EmptyState({
  title = 'Nothing here yet',
  description = 'Try adjusting your filters or adding a new item.',
  action,
  icon,
  className = '',
}) {
  return (
    <div className={`rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center ${className}`}>
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-700">
        {icon || <span className="text-2xl">—</span>}
      </div>
      <h2 className="mt-6 text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
