import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

export default function SidebarItem({
  icon: Icon,
  label,
  href,
  isActive,
  isExpanded,
  hasSubmenu,
  onToggle,
  collapsed,
  children,
}) {
  const baseClasses = 'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 group relative';
  
  const activeClasses = isActive
    ? 'bg-indigo-50 text-indigo-700 font-medium'
    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900';

  if (hasSubmenu) {
    return (
      <div>
        <button
          onClick={onToggle}
          className={`${baseClasses} ${activeClasses} w-full`}
        >
          {Icon && (
            <Icon 
              size={20} 
              className={`flex-shrink-0 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-500 group-hover:text-slate-700'}`} 
            />
          )}
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{label}</span>
              <ChevronDown
                size={16}
                className={`flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              />
            </>
          )}
        </button>
        
        {isExpanded && !collapsed && children && (
          <div className="ml-6 mt-1 space-y-1 border-l-2 border-slate-200 pl-3">
            {children}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      to={href}
      className={`${baseClasses} ${activeClasses}`}
    >
      {Icon && (
        <Icon 
          size={20} 
          className={`flex-shrink-0 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-500 group-hover:text-slate-700'}`} 
        />
      )}
      {!collapsed && <span className="flex-1">{label}</span>}
    </Link>
  );
}
