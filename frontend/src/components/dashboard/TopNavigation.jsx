import { Menu } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import NotificationDropdown from '../ui/NotificationDropdown';
import ProfileDropdown from '../ui/ProfileDropdown';
import {
  clearNotifications,
  fetchNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../../services/api';

const PORTAL_TITLES = {
  '/teacher': 'Багшийн хэсэг',
  '/user': 'Хэрэглэгчийн хэсэг',
  '/principal': 'Захирлын хэсэг',
  '/parent': 'Эцэг эхийн хэсэг',
  '/staff': 'Ажилтны хэсэг',
  '/admin': 'Менежерийн хэсэг',
  '/student': 'Сурагчийн хэсэг',
};

const getPortalTitle = (pathname, role) => {
  if (pathname.startsWith('/platform')) return 'Super admin';
  if (pathname.startsWith('/admin') && role === 'SUPER_ADMIN') return 'Super admin';
  const match = Object.keys(PORTAL_TITLES).find((prefix) => pathname.startsWith(prefix));
  return match ? PORTAL_TITLES[match] : 'Сургалтын систем';
};

const getPageTitle = (pathname, role) => {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return 'Хянах самбар';
  if (segments.length === 1) return getPortalTitle(pathname, role);
  return ({
    courses: 'Хичээлүүд', assignments: 'Даалгаврууд', quizzes: 'Шалгалтууд',
    attendance: 'Ирц', grades: 'Дүн', users: 'Хэрэглэгчид',
    notifications: 'Мэдэгдэл', settings: 'Тохиргоо',
  })[segments[segments.length - 1]] || 'Хянах самбар';
};

export default function TopNavigation({ onSidebarToggle, onMobileMenuToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    const loadNotifications = async () => {
      try {
        const items = await fetchNotifications(10);
        if (active) setNotifications(items);
      } catch (error) {
        console.error('Failed to load notifications:', error);
      }
    };
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user]);

  const pageTitle = getPageTitle(location.pathname, user?.role);
  const portalTitle = getPortalTitle(location.pathname, user?.role);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavigate = (path) => {
    navigate(path);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white shadow-xs">
      <div className="px-4 py-3">
        <div className="flex justify-between items-center">
          {/* Left side - Back button, Menu toggle and page title */}
          <div className="flex items-center gap-3">

            <button
              onClick={onSidebarToggle}
              className="hidden md:inline-flex p-2 text-slate-600 hover:text-primary hover:bg-primary/5 rounded-2xl transition-all"
              aria-label="Хажуугийн цэс нээх, хаах"
            >
              <Menu size={20} />
            </button>

            <button
              onClick={onMobileMenuToggle}
              className="md:hidden p-2 text-slate-600 hover:text-primary hover:bg-primary/5 rounded-2xl transition-all"
              aria-label="Гар утасны цэс нээх, хаах"
            >
              <Menu size={20} />
            </button>

            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                {pageTitle}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <p className="text-xs font-medium text-slate-500 hidden sm:block">{portalTitle}</p>
              </div>
            </div>
          </div>

          {/* Right side - Notifications, Profile */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* Notifications */}
            <NotificationDropdown
              notifications={notifications}
              unreadCount={notifications.filter(n => !n.read).length}
              onMarkAsRead={async id => {
                await markNotificationAsRead(id);
                setNotifications(items => items.map(item => item.id === id ? { ...item, read: true } : item));
              }}
              onMarkAllAsRead={async () => {
                await markAllNotificationsAsRead();
                setNotifications(items => items.map(item => ({ ...item, read: true })));
              }}
              onClearAll={async () => {
                await clearNotifications();
                setNotifications([]);
              }}
              onViewAll={handleNavigate}
            />

            {/* Profile */}
            <ProfileDropdown
              user={user}
              onLogout={handleLogout}
              onNavigate={handleNavigate}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
