import { Menu, Search, X } from 'lucide-react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getRoleRedirectPath } from '../../context/AuthContext';
import NotificationDropdown from '../ui/NotificationDropdown';
import SettingsDropdown from '../ui/SettingsDropdown';
import ProfileDropdown from '../ui/ProfileDropdown';

const PORTAL_TITLES = {
  '/teacher': 'Teacher Portal',
  '/principal': 'Principal Portal',
  '/parent': 'Parent Portal',
  '/staff': 'Staff Portal',
  '/admin': 'Admin Portal',
  '/student': 'Student Portal',
};

const ROLE_LABELS = {
  STUDENT: 'Student',
  INSTRUCTOR: 'Teacher',
  PARENT: 'Parent',
  STAFF: 'Staff',
  ORG_ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
  PRINCIPAL: 'Principal',
};

const getPortalTitle = (pathname) => {
  const match = Object.keys(PORTAL_TITLES).find((prefix) => pathname.startsWith(prefix));
  return match ? PORTAL_TITLES[match] : 'Student Portal';
};

const getPageTitle = (pathname) => {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return 'Dashboard';
  if (segments.length === 1) return getPortalTitle(pathname);
  return segments[segments.length - 1].charAt(0).toUpperCase() + segments[segments.length - 1].slice(1);
};

export default function TopNavigation({ onSidebarToggle, onMobileMenuToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const pageTitle = getPageTitle(location.pathname);
  const portalTitle = getPortalTitle(location.pathname);
  const roleLabel = user ? ROLE_LABELS[user.role] || user.role : '';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavigate = (path) => {
    navigate(path);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Implement search functionality
      console.log('Searching for:', searchQuery);
    }
  };

  const mockNotifications = [
    { id: 1, title: 'System Update', description: 'New features have been added to the platform.', createdAt: new Date(Date.now() - 10 * 60 * 1000), read: false },
    { id: 2, title: 'New Assignment', description: 'You have a new assignment due next week.', createdAt: new Date(Date.now() - 60 * 60 * 1000), read: false },
    { id: 3, title: 'School Announcement', description: 'Important announcement about the upcoming semester.', createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), read: true },
  ];

  return (
    <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40 shadow-sm">
      <div className="px-4 md:px-6 lg:px-8 py-3">
        <div className="flex justify-between items-center">
          {/* Left side - Menu toggle and page title */}
          <div className="flex items-center gap-4">
            <button
              onClick={onSidebarToggle}
              className="hidden md:inline-flex p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              aria-label="Toggle sidebar"
            >
              <Menu size={20} />
            </button>

            <button
              onClick={onMobileMenuToggle}
              className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              aria-label="Toggle mobile menu"
            >
              <Menu size={20} />
            </button>

            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{pageTitle}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">{portalTitle}</p>
            </div>
          </div>

          {/* Center - Search bar */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <form onSubmit={handleSearch} className="relative w-full">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search courses, assignments, users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </form>
          </div>

          {/* Right side - Search toggle (mobile), Notifications, Settings, Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile search toggle */}
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              aria-label="Search"
            >
              <Search size={20} />
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              aria-label="Toggle theme"
              title={`Current theme: ${theme}`}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {/* Notifications */}
            <NotificationDropdown
              notifications={mockNotifications}
              unreadCount={mockNotifications.filter(n => !n.read).length}
              onViewAll={() => handleNavigate('/notifications')}
            />

            {/* Settings */}
            <SettingsDropdown onNavigate={handleNavigate} />

            {/* Profile */}
            <ProfileDropdown
              user={user}
              onLogout={handleLogout}
              onNavigate={handleNavigate}
            />
          </div>
        </div>

        {/* Mobile search bar */}
        {searchOpen && (
          <div className="md:hidden mt-3">
            <form onSubmit={handleSearch} className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full pl-10 pr-10 py-2 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
