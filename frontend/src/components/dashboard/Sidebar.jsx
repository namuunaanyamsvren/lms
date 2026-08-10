import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChevronDown,
  Home,
} from 'lucide-react';
import {useAuth} from '../../context/AuthContext';
import { getDashboardMenu, isDashboardMenuItemActive } from './navigationItems';

export default function Sidebar({ isOpen }) {
  const {user}=useAuth();
  const [expandedItems, setExpandedItems] = useState({});

  const toggleExpanded = (item) => {
    setExpandedItems((prev) => ({
      ...prev,
      [item]: !prev[item],
    }));
  };

  const location = useLocation();
  const menuItems = getDashboardMenu({ pathname: location.pathname, role: user?.role });

  return (
    <aside
      className={`h-full border-r border-slate-200/80 bg-white text-slate-700 shadow-xs transition-all duration-300 ${
        isOpen ? 'w-64' : 'w-20'
      } overflow-hidden`}
      aria-label="Үндсэн цэс"
    >
      <div className={`flex h-full flex-col ${isOpen ? 'p-4' : 'px-3 py-4'}`}>
        <div className={isOpen ? 'mb-5' : 'mb-4 flex justify-center'}>
          <div
            className={`flex items-center gap-3 rounded-2xl text-xl font-extrabold text-slate-900 ${isOpen ? 'px-2 py-2' : 'p-2'}`}
            aria-label="EduPulse LMS"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-md shadow-primary/20">
              <Home size={22} />
            </div>
            {isOpen && (
              <span className="tracking-tight text-primary">
                EduPulse <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-800">LMS</span>
              </span>
            )}
          </div>
        </div>

        <nav role="navigation" aria-label="Main" className={`flex-1 space-y-1 overflow-y-auto ${isOpen ? 'pr-1' : ''}`}>
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const isExpanded = expandedItems[index];
            const isActive = isDashboardMenuItemActive(location.pathname, item.href);

            return (
              <div key={index}>
                {item.submenu ? (
                  <button
                    onClick={() => toggleExpanded(index)}
                    title={item.label}
                    className={`group relative flex w-full items-center rounded-xl text-sm font-medium transition-all ${
                      isOpen ? 'justify-between px-3 py-2.5' : 'justify-center px-0 py-3'
                    } ${isExpanded ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100 hover:text-primary'}`}
                  >
                    <div className={`flex items-center ${isOpen ? 'gap-3' : 'justify-center'}`}>
                      <Icon size={19} className={isExpanded ? 'text-primary' : 'text-slate-500'} />
                      {isOpen && <span>{item.label}</span>}
                    </div>
                    {isOpen && (
                      <ChevronDown
                        size={16}
                        className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    )}
                  </button>
                ) : (
                  <Link
                    to={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    title={item.label}
                    className={`group relative flex rounded-xl text-sm font-medium transition-all duration-200 ${
                      isOpen ? 'items-center gap-3.5 px-3 py-2.5' : 'h-12 items-center justify-center px-0'
                    } ${
                      isActive
                        ? 'bg-slate-100 text-slate-950 font-semibold'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                    }`}
                  >
                    {isActive && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary" />}
                    <Icon size={20} className={isActive ? 'text-primary' : 'text-slate-500'} aria-hidden />
                    {isOpen && <span>{item.label}</span>}
                  </Link>
                )}

                {item.submenu && isOpen && isExpanded && (
                  <div className="ml-4 mt-1 space-y-1 border-l-2 border-primary/20 pl-4">
                    {item.submenu.map((subitem, subindex) => (
                      <Link
                        key={subindex}
                        to={subitem.href}
                        className="block px-3 py-2 text-xs font-medium text-slate-600 hover:bg-primary/5 hover:text-primary rounded-xl transition-colors"
                      >
                        {subitem.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {isOpen && (
          <div className="border-t border-slate-100 pt-4">
            <p className="text-center text-[11px] font-medium text-slate-400">EduPulse LMS © 2026</p>
          </div>
        )}
      </div>
    </aside>
  );
}
