import { Link } from 'react-router-dom';

export default function Sidebar({
  items = [],
  collapsed = false,
  logo,
  className = '',
  onToggle,
}) {
  return (
    <aside className={`flex h-full flex-col border-r border-slate-200 bg-white transition-all duration-200 ${collapsed ? 'w-20' : 'w-72'} ${className}`}>
      <div className="flex items-center justify-between gap-2 p-4">
        <div className="flex items-center gap-3">
          {logo}
          {!collapsed && <p className="text-lg font-semibold text-slate-900">LMS</p>}
        </div>
        {onToggle && (
          <button type="button" onClick={onToggle} className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200">
            <span className="text-sm">⇆</span>
          </button>
        )}
      </div>
      <nav className="flex-1 space-y-1 px-2 pb-4">
        {items.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className="flex items-center gap-3 rounded-3xl px-3 py-3 text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              {item.icon}
            </span>
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
