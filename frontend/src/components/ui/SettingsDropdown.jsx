import { Settings as SettingsIcon, User, Bell, Shield } from 'lucide-react';
import { useState } from 'react';

export default function SettingsDropdown({ onNavigate, className = '' }) {
  const [open, setOpen] = useState(false);
  const menuItems = [
    { icon: User, label: 'Profile Settings', action: () => onNavigate?.('/profile') },
    { icon: Bell, label: 'Notification Settings', action: () => onNavigate?.('/profile') },
    { icon: Shield, label: 'Security', action: () => onNavigate?.('/settings/security') },
  ];

  return (
    <div className={`relative group ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="p-2.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-colors"
        aria-label="Settings"
      >
        <SettingsIcon size={20} />
      </button>

      {open && (
        <div className="absolute right-0 top-full pt-2 w-64 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-950 text-white font-semibold text-sm flex items-center gap-2">
              <SettingsIcon size={16} className="text-indigo-400" />
              <span>Settings</span>
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
                    <Icon size={16} className="text-slate-400" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
