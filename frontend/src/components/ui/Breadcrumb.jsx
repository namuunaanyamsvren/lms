import { Link } from 'react-router-dom';

export default function Breadcrumb({ items = [], className = '' }) {
  return (
    <nav className={`flex flex-wrap items-center gap-2 text-sm text-slate-500 ${className}`} aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={item.href || item.label} className="inline-flex items-center gap-2">
          {index > 0 && <span className="text-slate-300">/</span>}
          {item.href && !item.current ? (
            <Link to={item.href} className="text-slate-500 hover:text-slate-900">
              {item.label}
            </Link>
          ) : (
            <span className={`font-medium ${item.current ? 'text-slate-900' : 'text-slate-500'}`}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
