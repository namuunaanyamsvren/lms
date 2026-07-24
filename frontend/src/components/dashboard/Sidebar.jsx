import { useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, LayoutDashboard, BookOpen, FileText, Calendar, 
  GraduationCap, Users, UserCheck, Banknote, Bell, 
  Settings, BarChart2, Layers, LogOut, ChevronLeft, 
  ChevronRight, Search 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getInitials } from '../../utils/getInitials';
import SidebarItem from '../ui/SidebarItem';

const isMenuItemActive = (pathname, item) => {
  if (item.href === pathname) return true;
  if (item.submenu) {
    return item.submenu.some(subitem => pathname.startsWith(subitem.href));
  }
  return pathname.startsWith(item.href) && item.href !== '/';
};

const studentMenu = [
  { label: 'Dashboard', href: '/student', icon: LayoutDashboard },
  { label: 'Courses', href: '/student/courses', icon: BookOpen },
  { label: 'Assignments', href: '/student/assignments', icon: FileText },
  { label: 'Quizzes', href: '/student/quizzes', icon: FileText },
  { label: 'Attendance', href: '/student/attendance', icon: Calendar },
  { label: 'Grades', href: '/student/grades', icon: GraduationCap },
  { label: 'Calendar', href: '/student/calendar', icon: Calendar },
  { label: 'Messages', href: '/student/messages', icon: Bell },
];

const teacherMenu = [
  { label: 'Dashboard', href: '/teacher', icon: LayoutDashboard },
  { label: 'My Courses', href: '/teacher/courses', icon: BookOpen },
  { label: 'Assignments', href: '/teacher/assignments', icon: FileText },
  { label: 'Quizzes', href: '/teacher/quizzes', icon: FileText },
  { label: 'Attendance', href: '/teacher/attendance', icon: Calendar },
  { label: 'Grades', href: '/teacher/grades', icon: GraduationCap },
  { label: 'Students', href: '/teacher/users', icon: Users },
  { label: 'Calendar', href: '/teacher/calendar', icon: Calendar },
  { label: 'Messages', href: '/teacher/messages', icon: Bell },
];

const parentMenu = [
  { label: 'Dashboard', href: '/parent', icon: LayoutDashboard },
  { label: 'My Children', href: '/parent/children', icon: Users },
  { label: 'Payments', href: '/parent/payments', icon: Banknote },
  { label: 'Communication', href: '/parent/communication', icon: Bell },
  { label: 'Calendar', href: '/parent/calendar', icon: Calendar },
  { label: 'Settings', href: '/parent/settings', icon: Settings },
];

const staffMenu = [
  { label: 'Dashboard', href: '/staff', icon: LayoutDashboard },
  { label: 'Users', href: '/staff/users', icon: Users },
  { label: 'Documents', href: '/staff/documents', icon: FileText },
  { label: 'Scholarships', href: '/staff/scholarships', icon: GraduationCap },
  { label: 'Announcements', href: '/staff/announcements', icon: Bell },
  { label: 'Reports', href: '/staff/reports', icon: LayoutDashboard },
  { label: 'Calendar', href: '/staff/calendar', icon: Calendar },
  { label: 'Settings', href: '/staff/settings', icon: Settings },
];

const adminMenu = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Courses', href: '/admin/courses', icon: BookOpen },
  { label: 'Assignments', href: '/admin/assignments', icon: FileText },
  { label: 'Quizzes', href: '/admin/quizzes', icon: FileText },
  { label: 'Attendance', href: '/admin/attendance', icon: Calendar },
  { label: 'Grades', href: '/admin/grades', icon: GraduationCap },
  { label: 'Enrollments', href: '/admin/enrollments', icon: UserCheck },
  { label: 'Billing', href: '/admin/billing', icon: Banknote },
  { label: 'Calendar', href: '/admin/calendar', icon: Calendar },
  { label: 'Messages', href: '/admin/messages', icon: Bell },
  { label: 'Notifications', href: '/admin/notifications', icon: Bell },
  { label: 'Reports', href: '/admin/reports', icon: LayoutDashboard },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
];

const principalMenu = [
  { label: 'Dashboard', href: '/principal', icon: LayoutDashboard },
  { label: 'Analytics', href: '/principal/analytics', icon: BarChart2 },
  { label: 'Users', href: '/principal/users', icon: Users },
  { label: 'Departments', href: '/principal/departments', icon: Layers },
  { label: 'Reports', href: '/principal/reports', icon: FileText },
  { label: 'Calendar', href: '/principal/calendar', icon: Calendar },
  { label: 'Messages', href: '/principal/messages', icon: Bell },
  { label: 'Settings', href: '/principal/settings', icon: Settings },
];

export default function Sidebar({ isOpen, onToggle }) {
  const [expandedItems, setExpandedItems] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const toggleExpanded = (item) => {
    setExpandedItems((prev) => ({
      ...prev,
      [item]: !prev[item],
    }));
  };

  const menuItems = useMemo(() => {
    if (!user || !user.role) return [];
    switch (user.role) {
      case 'STUDENT':
        return studentMenu;
      case 'INSTRUCTOR':
        return teacherMenu;
      case 'PARENT':
        return parentMenu;
      case 'STAFF':
        return staffMenu;
      case 'ORG_ADMIN':
      case 'SUPER_ADMIN':
        return adminMenu;
      case 'PRINCIPAL':
        return principalMenu;
      default:
        return [];
    }
  }, [user]);

  const filteredMenuItems = useMemo(() => {
    if (!searchQuery) return menuItems;
    return menuItems.filter(item => 
      item.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [menuItems, searchQuery]);

  const initials = getInitials(user?.firstName, user?.lastName, user?.email);
  const displayName = user ? `${user.lastName || ''} ${user.firstName || ''}`.trim() || user.email : 'Guest';

  return (
    <aside
      className={`h-full overflow-hidden border-r border-slate-200 bg-white transition-all duration-300 ease-in-out ${
        isOpen ? 'w-72' : 'w-20'
      }`}
    >
      <div className="flex h-full flex-col">
        {/* Logo Section */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Home size={20} className="text-white" />
            </div>
            {isOpen && (
              <span className="text-lg font-bold text-slate-900 whitespace-nowrap">
                EduPulse LMS
              </span>
            )}
          </div>
          <button
            onClick={onToggle}
            className="flex-shrink-0 p-2 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
            aria-label="Toggle sidebar"
          >
            {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>

        {/* Search Section */}
        {isOpen && (
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {filteredMenuItems.map((item) => {
            const isActive = isMenuItemActive(location.pathname, item);
            const isExpanded = expandedItems[item.label];

            return (
              <SidebarItem
                key={item.href}
                icon={item.icon}
                label={item.label}
                href={item.href}
                isActive={isActive}
                isExpanded={isExpanded}
                hasSubmenu={!!item.submenu}
                onToggle={() => toggleExpanded(item.label)}
                collapsed={!isOpen}
              >
                {item.submenu && isExpanded && item.submenu.map((subitem) => {
                  const subActive = isMenuItemActive(location.pathname, subitem);
                  return (
                    <SidebarItem
                      key={subitem.href}
                      icon={subitem.icon}
                      label={subitem.label}
                      href={subitem.href}
                      isActive={subActive}
                      collapsed={false}
                    />
                  );
                })}
              </SidebarItem>
            );
          })}
        </nav>

        {/* User Card Section */}
        <div className="p-3 border-t border-slate-100 space-y-1">
          <Link
            to="/settings"
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 group ${
              location.pathname === '/settings' 
                ? 'bg-indigo-50 text-indigo-700 font-medium' 
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Settings size={20} className="flex-shrink-0" />
            {isOpen && <span className="flex-1">Settings</span>}
          </Link>

          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-700 hover:bg-red-50 hover:text-red-600 transition-all duration-200 group"
          >
            <LogOut size={20} className="flex-shrink-0" />
            {isOpen && <span className="flex-1">Logout</span>}
          </button>

          {/* User Info Card */}
          {isOpen && (
            <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-sm flex-shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
                  <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                </div>
              </div>
            </div>
          )}

          {!isOpen && (
            <div className="mt-3 flex justify-center">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-sm" title={displayName}>
                {initials}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
