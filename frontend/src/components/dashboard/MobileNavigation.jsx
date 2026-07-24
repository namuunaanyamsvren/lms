import { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, X, LayoutDashboard, BookOpen, FileText, Calendar, GraduationCap, Users, UserCheck, Banknote, Bell, Settings, BarChart2, Layers } from 'lucide-react';
import { useAuth } from '../../context/AuthContext'; // Import useAuth

// Helper to determine if a menu item is active
const isMenuItemActive = (pathname, item) => {
  if (item.href === pathname) return true;
  if (item.submenu) {
    return item.submenu.some(subitem => pathname.startsWith(subitem.href));
  }
  return pathname.startsWith(item.href) && item.href !== '/'; // More flexible matching for parent paths
};

// Define menu items for each role
const studentMenu = [
  { label: 'Dashboard', href: '/student', icon: LayoutDashboard },
  { label: 'Courses', href: '/student/courses', icon: BookOpen },
  { label: 'Assignments', href: '/student/assignments', icon: FileText },
  { label: 'Quizzes', href: '/student/quizzes', icon: FileText },
  { label: 'Attendance', href: '/student/attendance', icon: Calendar },
  { label: 'Grades', href: '/student/grades', icon: GraduationCap },
];

const teacherMenu = [
  { label: 'Dashboard', href: '/teacher', icon: LayoutDashboard },
  { label: 'My Courses', href: '/teacher/courses', icon: BookOpen },
  { label: 'Assignments', href: '/teacher/assignments', icon: FileText },
  { label: 'Quizzes', href: '/teacher/quizzes', icon: FileText },
  { label: 'Attendance', href: '/teacher/attendance', icon: Calendar },
  { label: 'Grades', href: '/teacher/grades', icon: GraduationCap },
  { label: 'Students', href: '/teacher/users', icon: Users },
];

const parentMenu = [
  { label: 'Dashboard', href: '/parent', icon: LayoutDashboard },
  { label: 'My Children', href: '/parent/children', icon: Users },
  { label: 'Payments', href: '/parent/payments', icon: Banknote },
  { label: 'Communication', href: '/parent/communication', icon: Bell },
  { label: 'Settings', href: '/parent/settings', icon: Settings },
];

const staffMenu = [
  { label: 'Dashboard', href: '/staff', icon: LayoutDashboard },
  { label: 'Users', href: '/staff/users', icon: Users },
  { label: 'Documents', href: '/staff/documents', icon: FileText },
  { label: 'Scholarships', href: '/staff/scholarships', icon: GraduationCap },
  { label: 'Announcements', href: '/staff/announcements', icon: Bell },
  { label: 'Reports', href: '/staff/reports', icon: LayoutDashboard },
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
  { label: 'Settings', href: '/admin/settings', icon: Settings },
];

const principalMenu = [
  { label: 'Dashboard', href: '/principal', icon: LayoutDashboard },
  { label: 'Analytics', href: '/principal/analytics', icon: BarChart2 },
  { label: 'Users', href: '/principal/users', icon: Users },
  { label: 'Departments', href: '/principal/departments', icon: Layers },
  { label: 'Reports', href: '/principal/reports', icon: FileText },
  { label: 'Settings', href: '/principal/settings', icon: Settings },
];


export default function MobileNavigation({ onClose }) {
  const [expandedItems, setExpandedItems] = useState({});
  const location = useLocation();
  const { user } = useAuth(); // Get user from AuthContext

  const toggleExpanded = (item) => {
    setExpandedItems((prev) => ({
      ...prev,
      [item]: !prev[item],
    }));
  };

  const menu = useMemo(() => {
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

  return (
    <div className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden">
      <div className="animate-slideIn absolute left-0 top-0 h-screen w-64 bg-white shadow-lg">
        <div className="flex h-full flex-col p-6">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-xl font-bold text-indigo-600">EduPulse LMS</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-2 transition-colors hover:bg-gray-100"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>

          <nav role="navigation" aria-label="Mobile" className="flex-1 space-y-1">
            {menu.map((item, index) => {
              const Icon = item.icon;
              const isExpanded = expandedItems[item.label]; // Use item.label as key
              const isActive = isMenuItemActive(location.pathname, item);

              return (
                <div key={item.href}>
                  {item.submenu ? (
                    <button
                      onClick={() => toggleExpanded(item.label)} // Use item.label as key
                      className={`flex w-full items-center justify-between rounded-lg px-4 py-2 transition-colors ${
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
                      className={`flex items-center gap-3 rounded-lg px-4 py-2 transition-colors ${
                        isActive
                          ? 'bg-indigo-50 font-semibold text-indigo-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon size={20} aria-hidden />
                      <span>{item.label}</span>
                    </Link>
                  )}

                  {item.submenu && isExpanded && (
                    <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-4">
                      {item.submenu.map((subitem) => {
                        const subActive = isMenuItemActive(location.pathname, subitem);

                        return (
                          <Link
                            key={subitem.href}
                            to={subitem.href}
                            aria-current={subActive ? 'page' : undefined}
                            onClick={onClose}
                            className={`block rounded-lg px-4 py-2 text-sm transition-colors ${
                              subActive
                                ? 'bg-slate-50 text-slate-900'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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

          <div className="border-t border-gray-200 pt-4">
            <p className="text-center text-xs text-gray-500">EduPulse LMS © 2026</p>
          </div>
        </div>
      </div>

      <button onClick={onClose} className="absolute inset-0 z-30" aria-label="Close menu" />
    </div>
  );
}
