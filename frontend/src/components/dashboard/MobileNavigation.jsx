import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getDashboardMenu, isDashboardMenuItemActive } from './navigationItems';

export default function MobileNavigation({ onClose }) {
  const [expandedItems, setExpandedItems] = useState({});
  const location = useLocation();
  const { user } = useAuth();

  const toggleExpanded = (item) => {
    setExpandedItems((prev) => ({
      ...prev,
      [item]: !prev[item],
    }));
  };

  const menu = getDashboardMenu({ pathname: location.pathname, role: user?.role });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden">
      <div className="absolute left-0 top-0 h-screen w-64 bg-white shadow-lg animate-slideIn">
        <div className="p-6 flex flex-col h-full">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-bold text-primary">EduPulse LMS</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>

          <nav role="navigation" aria-label="Mobile" className="flex-1 space-y-1">
            {menu.map((item, index) => {
              const Icon = item.icon;
              const isExpanded = expandedItems[index];
              const isActive = isDashboardMenuItemActive(location.pathname, item.href);

              return (
                <div key={index}>
                  {item.submenu ? (
                    <button
                      onClick={() => toggleExpanded(index)}
                      className={`w-full flex items-center justify-between px-4 py-2 rounded-lg transition-colors ${
                        isExpanded ? 'bg-gray-100' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={20} />
                        <span>{item.label}</span>
                      </div>
                      <ChevronDown
                        size={16}
                        className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>
                  ) : (
                    <Link
                      to={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                        isActive ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon size={20} aria-hidden />
                      <span>{item.label}</span>
                    </Link>
                  )}

                  {item.submenu && isExpanded && (
                    <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-4">
                      {item.submenu.map((subitem, subindex) => {
                        const subActive = isDashboardMenuItemActive(location.pathname, subitem.href);

                        return (
                          <Link
                            key={subindex}
                            to={subitem.href}
                            aria-current={subActive ? 'page' : undefined}
                            onClick={onClose}
                            className={`block px-4 py-2 text-sm rounded-lg transition-colors ${
                              subActive ? 'bg-slate-50 text-slate-900' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                          >
                            {subitem.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">EduPulse LMS © 2026</p>
          </div>
        </div>
      </div>

      <button onClick={onClose} className="absolute inset-0 z-30" aria-label="Close menu" />
    </div>
  );
}
