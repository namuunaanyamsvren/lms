import { User, ChevronDown, LogOut, BookOpen, Activity, HelpCircle, Settings as SettingsIcon } from 'lucide-react';
import { useState } from 'react';
import { getInitials } from '../../utils/getInitials';
import { useAuth } from '../../context/AuthContext';

export default function ProfileDropdown({ user = {}, onLogout, onNavigate, className = '' }) {
  const [open, setOpen] = useState(false);
  const { user: authUser } = useAuth();

  const initials = getInitials(user.firstName, user.lastName, user.email);
  const displayName = user ? `${user.lastName || ''} ${user.firstName || ''}`.trim() || user.email : 'Guest';

  const menuItems = [
    { icon: User, label: 'My Profile', action: () => onNavigate?.('/profile') },
    { icon: SettingsIcon, label: 'Edit Profile', action: () => onNavigate?.('/profile') },
    { icon: BookOpen, label: 'My Courses', action: () => onNavigate?.(`/${authUser?.role?.toLowerCase()}/courses`) },
    { icon: Activity, label: 'Activity', action: () => onNavigate?.('/activity') },
    { icon: SettingsIcon, label: 'Preferences', action: () => onNavigate?.('/settings/appearance') },
    { icon: HelpCircle, label: 'Help Center', action: () => onNavigate?.('/help') },
  ];

  return (
    <div className={`relative group ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 p-1.5 pl-2.5 hover:bg-slate-100 rounded-2xl transition-colors border border-slate-200/80"
        aria-label="User profile"
      >
        <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
          {initials}
        </div>
        <span className="hidden sm:inline-block text-xs font-semibold text-slate-800">{displayName}</span>
        <ChevronDown size={14} className="text-slate-400 group-hover:rotate-180 transition-transform duration-200" />
      </button>

      {open && (
        <div className="absolute right-0 top-full pt-2 w-72 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-4 bg-slate-950 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow">
                  {initials}
                </div>
                <div>
                  <p className="font-semibold text-sm">{displayName}</p>
                  <p className="text-[11px] text-slate-400">{user.email}</p>
                  <p className="text-[10px] text-indigo-400 mt-0.5">{user.role || 'User'}</p>
                </div>
              </div>
            </div>

            <div className="p-1.5 space-y-0.5">
              {menuItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    key={index}
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
                onClick={() => {
                  onLogout?.();
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-red-50 text-red-600 flex items-center gap-3 text-xs font-medium transition"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
