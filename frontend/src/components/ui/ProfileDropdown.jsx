import { ChevronDown, LogOut, HelpCircle, Shield } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getInitials } from '../../utils/getInitials';

export default function ProfileDropdown({ user = {}, onLogout, onNavigate, className = '' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const initials = getInitials(user.firstName, user.lastName, user.email);
  const displayName = user ? `${user.lastName || ''} ${user.firstName || ''}`.trim() || user.email : 'Зочин';

  const menuItems = [
    { icon: HelpCircle, label: 'Тусламж', action: () => onNavigate?.('/help') },
    { icon: Shield, label: 'Аюулгүй байдал', action: () => onNavigate?.('/settings/security') },
  ];

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative group ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 p-1.5 pl-2.5 hover:bg-primary/5 rounded-2xl transition-colors border border-slate-200/80"
        aria-label="Хэрэглэгчийн мэдээлэл"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <div className="w-8 h-8 rounded-xl bg-primary text-white font-bold flex items-center justify-center text-xs shadow-xs">
          {initials}
        </div>
        <span className="hidden sm:inline-block text-xs font-semibold text-slate-800">{displayName}</span>
        <ChevronDown size={14} className="text-slate-400 group-hover:rotate-180 transition-transform duration-200" />
      </button>

      {open && (
        <div className="absolute right-0 top-full pt-2 w-72 z-50">
          <div role="menu" aria-label="Хэрэглэгчийн цэс" className="bg-white rounded-2xl border border-slate-200/80 shadow-xl overflow-hidden">
            <div className="p-4 bg-primary text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white text-primary font-bold flex items-center justify-center text-sm shadow">
                  {initials}
                </div>
                <div>
                  <p className="font-semibold text-sm">{displayName}</p>
                  <p className="text-[11px] text-white/80">{user.email}</p>
                  <p className="text-[10px] text-white/90 font-medium mt-0.5">{({ USER: 'Энгийн хэрэглэгч', STUDENT: 'Сурагч', INSTRUCTOR: 'Багш', PARENT: 'Эцэг эх', PRINCIPAL: 'Захирал', ORG_ADMIN: 'Менежер', SUPER_ADMIN: 'Ерөнхий менежер' })[user.role] || 'Хэрэглэгч'}</p>
                </div>
              </div>
            </div>

            <div className="p-1.5 space-y-0.5">
              {menuItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    key={index}
                    role="menuitem"
                    onClick={() => {
                      item.action();
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-100 flex items-center gap-3 text-xs font-medium text-slate-700 transition"
                  >
                    <Icon size={16} className="text-indigo-600" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
              <div className="my-1 border-t border-slate-100" />
              <button
                role="menuitem"
                onClick={() => {
                  onLogout?.();
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-red-50 text-red-600 flex items-center gap-3 text-xs font-medium transition"
              >
                <LogOut size={16} />
                <span>Гарах</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
