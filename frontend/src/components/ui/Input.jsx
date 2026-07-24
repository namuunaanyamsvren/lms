export default function Input({
  label,
  placeholder = '',
  type = 'text',
  value,
  onChange,
  error,
  icon,
  className = '',
  ...props
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && <label className="block text-sm font-medium text-slate-900">{label}</label>}
      <div className="relative">
        {icon && <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 ${icon ? 'pl-11' : ''}`}
          {...props}
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
