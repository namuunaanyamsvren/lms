import { Search, Settings } from 'lucide-react';

export default function Topbar({
  title,
  subtitle,
  searchValue,
  onSearchChange,
  actions,
  className = '',
}) {
  return (
    <div className={`flex flex-col gap-4 bg-white px-4 py-4 shadow-sm md:px-6 lg:px-8 ${className}`}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          {title && <h1 className="text-xl font-semibold text-slate-900">{title}</h1>}
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">{actions}</div>
      </div>
      <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-2">
        <Search size={18} className="text-slate-400" />
        <input
          value={searchValue}
          onChange={onSearchChange}
          placeholder="Search"
          className="w-full border-none bg-transparent text-sm text-slate-900 focus:outline-none"
        />
        <button type="button" className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-100">
          <Settings size={16} />
          Settings
        </button>
      </div>
    </div>
  );
}
