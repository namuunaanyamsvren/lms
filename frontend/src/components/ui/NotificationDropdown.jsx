import { Bell, CheckCheck, Trash2, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { formatDate } from '../../utils/formatDate';
import { useAuth } from '../../context/AuthContext';
import { getRoleRedirectPath } from '../../context/AuthContext';
import { resolveNotificationActionUrl } from '../../utils/notificationActionUrl';

export default function NotificationDropdown({ notifications = [], unreadCount = 0, onMarkAsRead, onMarkAllAsRead, onClearAll, onViewAll, className = '' }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  const getRolePath = (path) => {
    const basePath = getRoleRedirectPath(user?.role);
    return `${basePath}${path}`;
  };

  const handleNotificationClick = (notification) => {
    if (onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
    const actionUrl = resolveNotificationActionUrl(notification, user?.role);
    if (actionUrl && onViewAll) {
      setOpen(false);
      onViewAll(actionUrl);
    }
  };

  return (
    <div className={`relative group ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative p-2.5 text-slate-600 hover:text-primary hover:bg-primary/5 rounded-2xl transition-all"
        aria-label="Мэдэгдэл"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-primary rounded-full ring-2 ring-white animate-pulse" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full pt-2 w-80 z-50">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-primary text-white">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-white" />
                <span className="font-semibold text-sm">Мэдэгдэл</span>
              </div>
              {unreadCount > 0 && (
                <span className="bg-white/20 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
                  {unreadCount} шинэ
                </span>
              )}
            </div>

            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {notifications.length > 0 ? (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className="p-3.5 hover:bg-indigo-50/50 transition cursor-pointer"
                  >
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-semibold text-slate-900">{notification.title}</p>
                      {!notification.read && <span className="h-2 w-2 rounded-full bg-indigo-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{notification.description}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-indigo-600 font-medium">
                        {formatDate(notification.createdAt)}
                      </span>
                      {resolveNotificationActionUrl(notification, user?.role) && (
                        <span className="text-[10px] font-semibold text-indigo-600 inline-flex items-center gap-0.5">
                          Харах <ArrowRight size={10} />
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <Bell size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500">Мэдэгдэл алга</p>
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div className="flex gap-1">
                  {onMarkAllAsRead && unreadCount > 0 && (
                    <button
                      onClick={onMarkAllAsRead}
                      className="text-xs font-medium text-slate-600 hover:text-indigo-600 px-2 py-1 rounded hover:bg-slate-200 transition"
                      title="Бүгдийг уншсанаар тэмдэглэх"
                    >
                      <CheckCheck size={14} />
                    </button>
                  )}
                  {onClearAll && (
                    <button
                      onClick={onClearAll}
                      className="text-xs font-medium text-slate-600 hover:text-red-600 px-2 py-1 rounded hover:bg-slate-200 transition"
                      title="Бүгдийг цэвэрлэх"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                {onViewAll && (
                  <button
                    onClick={() => onViewAll(getRolePath('/notifications'))}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    Бүгдийг харах →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
