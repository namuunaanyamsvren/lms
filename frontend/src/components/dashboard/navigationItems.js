import {
  Activity,
  Award,
  BarChart2,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  ClipboardCheck,
  FileCheck,
  FileBadge,
  FileSignature,
  FileText,
  CreditCard,
  FolderKanban,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  Layers,
  LineChart,
  Notebook,
  Settings,
  Shield,
  ScrollText,
  User,
  UserCheck,
  Users,
} from 'lucide-react';

const studentMenu = [
  { icon: LayoutDashboard, label: 'Нүүр', href: '/student' },
  { icon: BookOpen, label: 'Миний хичээлүүд', href: '/student/courses' },
  { icon: Activity, label: 'Сорилтууд', href: '/student/quizzes' },
  { icon: Calendar, label: 'Миний хуваарь', href: '/student/schedules' },
  { icon: FileCheck, label: 'Даалгаврууд', href: '/student/assignments' },
  { icon: BarChart2, label: 'Дүнгийн мэдээлэл', href: '/student/grades' },
  { icon: ClipboardCheck, label: 'Ирцийн бүртгэл', href: '/student/attendance' },
  { icon: Award, label: 'Сертификатууд', href: '/student/certificates' },
  { icon: CreditCard, label: 'Төлбөр', href: '/student/payments' },
  { icon: FileText, label: 'Баримт бичиг', href: '/student/document-requests' },
  { icon: GraduationCap, label: 'Тэтгэлэг', href: '/student/scholarships' },
  { icon: Bell, label: 'Мэдэгдэл', href: '/notifications' },
  { icon: User, label: 'Профайл', href: '/profile' },
];

const userMenu = [
  { icon: LayoutDashboard, label: 'Нүүр', href: '/user' },
  { icon: Bell, label: 'Мэдэгдэл', href: '/notifications' },
  { icon: User, label: 'Профайл', href: '/profile' },
];

const teacherMenu = [
  { icon: LayoutDashboard, label: 'Нүүр', href: '/teacher' },
  { icon: BookOpen, label: 'Хичээлүүд', href: '/teacher/courses' },
  { icon: Users, label: 'Анги/Бүлгүүд', href: '/teacher/cohorts' },
  { icon: Activity, label: 'Сорилын удирдлага', href: '/teacher/quizzes' },
  { icon: Notebook, label: 'Дүнгийн журнал', href: '/teacher/gradebook' },
  { icon: FileSignature, label: 'Зөвшөөрлийн маягт', href: '/consent-forms' },
  { icon: LineChart, label: 'Тайлан', href: '/reports' },
  { icon: Bell, label: 'Мэдэгдэл', href: '/notifications' },
  { icon: User, label: 'Профайл', href: '/profile' },
];

const parentMenu = [
  { icon: LayoutDashboard, label: 'Нүүр', href: '/parent' },
  { icon: Calendar, label: 'Хүүхдийн хуваарь', href: '/parent/schedules' },
  { icon: BarChart2, label: 'Дүнгийн мэдээлэл', href: '/parent/grades' },
  { icon: ClipboardCheck, label: 'Ирцийн бүртгэл', href: '/parent/attendance' },
  { icon: FileText, label: 'Баримт бичиг', href: '/parent/document-requests' },
  { icon: GraduationCap, label: 'Тэтгэлэг', href: '/parent/scholarships' },
  { icon: Shield, label: 'Асран хамгаалагч холбоос', href: '/guardians' },
  { icon: FileSignature, label: 'Зөвшөөрлийн маягт', href: '/consent-forms' },
  { icon: Bell, label: 'Мэдэгдэл', href: '/notifications' },
  { icon: User, label: 'Профайл', href: '/profile' },
];

const staffMenu = [
  { icon: LayoutDashboard, label: 'Нүүр', href: '/staff' },
  { icon: FolderKanban, label: 'Хүсэлтийн урсгал', href: '/staff/workflows' },
  { icon: FileText, label: 'Баримт бичиг', href: '/staff/document-requests' },
  { icon: GraduationCap, label: 'Тэтгэлэг', href: '/staff/scholarships' },
  { icon: Users, label: 'Асран хамгаалагч холбоос', href: '/guardians' },
  { icon: FileSignature, label: 'Зөвшөөрлийн маягт', href: '/consent-forms' },
  { icon: LineChart, label: 'Тайлан', href: '/reports' },
  { icon: Bell, label: 'Мэдэгдэл', href: '/notifications' },
  { icon: User, label: 'Профайл', href: '/profile' },
];

const adminMenu = role => [
  { icon: LayoutDashboard, label: 'Нүүр', href: '/admin' },
  ...(role === 'SUPER_ADMIN' ? [{ icon: Layers, label: 'Organizations', href: '/platform' }] : []),
  { icon: Users, label: 'Хэрэглэгчид', href: '/admin/users' },
  { icon: UserCheck, label: 'Сурагчийн хүсэлт', href: '/admin/student-access-requests' },
  { icon: Shield, label: 'Асран хамгаалагч холбоос', href: '/guardians' },
  { icon: FileSignature, label: 'Зөвшөөрлийн маягт', href: '/consent-forms' },
  { icon: Building2, label: 'Академик бүтэц', href: '/admin/academic-structure' },
  { icon: BookOpen, label: 'Хичээл, ангийн хяналт', href: '/admin/course-oversight' },
  { icon: FileBadge, label: 'Сертификатын удирдлага', href: '/admin/certificates' },
  { icon: FileText, label: 'Баримт бичиг', href: '/admin/document-requests' },
  { icon: GraduationCap, label: 'Тэтгэлэг', href: '/admin/scholarships' },
  { icon: LineChart, label: 'Тайлан мэдээ', href: '/admin/reports' },
  { icon: ScrollText, label: 'Аудит лог', href: '/admin/audit-log' },
  { icon: CreditCard, label: 'Төлбөр', href: '/admin/billing' },
  { icon: Activity, label: 'Системийн төлөв', href: '/admin/system-health' },
  { icon: User, label: 'Профайл', href: '/profile' },
  { icon: Settings, label: 'Тохиргоо', href: '/admin/settings' },
];

const principalMenu = [
  { icon: LayoutDashboard, label: 'Нүүр', href: '/principal' },
  { icon: BookOpen, label: 'Хичээл, ангийн хяналт', href: '/principal/course-oversight' },
  { icon: Calendar, label: 'Байгууллагын хуваарь', href: '/principal/schedules' },
  { icon: ScrollText, label: 'Аудит лог', href: '/principal/audit-log' },
  { icon: FileText, label: 'Баримт бичиг', href: '/principal/document-requests' },
  { icon: GraduationCap, label: 'Тэтгэлэг', href: '/principal/scholarships' },
  { icon: HeartHandshake, label: 'Асран хамгаалагч холбоос', href: '/guardians' },
  { icon: FileSignature, label: 'Зөвшөөрлийн маягт', href: '/consent-forms' },
  { icon: LineChart, label: 'Тайлан', href: '/reports' },
  { icon: User, label: 'Профайл', href: '/profile' },
];

const dashboardRoots = new Set(['/user', '/student', '/teacher', '/parent', '/staff', '/admin', '/principal', '/platform']);

export const isDashboardMenuItemActive = (pathname, href) =>
  pathname === href || (!dashboardRoots.has(href) && href !== '/' && pathname.startsWith(`${href}/`));

export const getDashboardMenu = ({ pathname, role }) => {
  if (pathname.startsWith('/user')) return userMenu;
  if (pathname.startsWith('/teacher')) return teacherMenu;
  if (pathname.startsWith('/parent')) return parentMenu;
  if (pathname.startsWith('/staff')) return staffMenu;
  if (pathname.startsWith('/admin') || pathname.startsWith('/platform')) return adminMenu(role);
  if (pathname.startsWith('/principal')) return principalMenu;
  if (role === 'INSTRUCTOR') return teacherMenu;
  if (role === 'PARENT') return parentMenu;
  if (role === 'STAFF') return staffMenu;
  if (role === 'ORG_ADMIN' || role === 'SUPER_ADMIN') return adminMenu(role);
  if (role === 'PRINCIPAL') return principalMenu;
  if (role === 'USER') return userMenu;
  return studentMenu;
};
