import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { getStudentDashboardData } from '../../services/api';
import { BookOpen, FileCheck2, Activity, Bell, ArrowRight } from 'lucide-react';

const formatDateTime = (value) => new Date(value).toLocaleString('mn-MN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function Student() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboards', 'student'],
    queryFn: getStudentDashboardData,
  });

  if (isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><LoadingSpinner /></div>;
  }
  if (isError || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Хяналтын самбар" subtitle="Таны сургалтын үйл ажиллагааны тойм." />
        <Card><p className="text-sm text-rose-600">Мэдээлэл ачаалахад алдаа гарлаа.</p></Card>
      </div>
    );
  }

  const stats = [
    { title: 'Хичээлүүд', value: data.stats.courses, icon: BookOpen, href: '/student/courses' },
    { title: 'Даалгавар', value: data.stats.assignments, icon: FileCheck2, href: '/student/assignments' },
    { title: 'Шалгалт', value: data.stats.exams, icon: Activity, href: '/student/quizzes' },
    { title: 'Ирцийн хувь', value: data.engagement?.value || '—', icon: Bell, href: '/student/attendance' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Тавтай морил" subtitle="Таны сургалтын үйл ажиллагааны тойм." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <Link key={i} to={s.href}>
            <StatCard title={s.title} value={s.value} icon={s.icon} />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card
            title="Дараагийн даалгаврууд"
            subtitle="Хугацаа дуусахаас өмнө илгээгээрэй"
            right={<Link to="/student/assignments" className="text-xs font-semibold text-indigo-600 flex items-center gap-1">Бүгд <ArrowRight size={13} /></Link>}
          >
            {data.upcomingAssignments.length === 0 ? (
              <p className="text-sm text-slate-500">Дараагийн даалгавар алга.</p>
            ) : (
              <ul className="space-y-3">
                {data.upcomingAssignments.map((a, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-700 text-sm">{a.title}</div>
                      <div className="text-xs text-slate-500">Хугацаа: {formatDateTime(a.subtitle)}</div>
                    </div>
                    <Link to="/student/assignments" className="text-sm text-indigo-600">Харах</Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Өнөөдрийн хичээлүүд" right={<Link to="/student/schedules" className="text-xs font-semibold text-indigo-600 flex items-center gap-1">Хуваарь <ArrowRight size={13} /></Link>}>
            {data.todayClasses.length === 0 ? (
              <p className="text-sm text-slate-500">Өнөөдөр хичээл алга.</p>
            ) : (
              <ul className="space-y-3">
                {data.todayClasses.map((c) => (
                  <li key={c.id} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{c.course?.title}</div>
                      <div className="text-xs text-slate-500">{c.startTime} - {c.endTime}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Сүүлийн дүнгүүд" right={<Link to="/student/grades" className="text-xs font-semibold text-indigo-600 flex items-center gap-1">Бүгд <ArrowRight size={13} /></Link>}>
            {data.recentGrades.length === 0 ? (
              <p className="text-sm text-slate-500">Дүн алга байна.</p>
            ) : (
              <ul className="space-y-2">
                {data.recentGrades.map((g, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <div className="text-sm text-slate-700">{g.label}</div>
                    <div className="font-semibold">{g.value}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Мэдэгдэл" right={<Link to="/notifications" className="text-xs font-semibold text-indigo-600 flex items-center gap-1">Бүгд <ArrowRight size={13} /></Link>}>
            {data.notifications.length === 0 ? (
              <p className="text-sm text-slate-500">Шинэ мэдэгдэл алга.</p>
            ) : (
              <ul className="space-y-2 text-sm text-slate-600">
                {data.notifications.map((n, i) => (
                  <li key={i} className="py-2 border-b border-gray-100 last:border-0">
                    <div className="font-medium text-slate-700">{n.title}</div>
                    <div className="text-xs text-slate-500">{n.subtitle}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card title="Сүүлийн үйл ажиллагаа">
        {data.activityFeed.length === 0 ? (
          <p className="text-sm text-slate-500">Үйл ажиллагаа алга байна.</p>
        ) : (
          <ul className="space-y-3">
            {data.activityFeed.map((a, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className={`w-2.5 h-2.5 mt-2 rounded-full ${a.active ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                <div>
                  <div className="text-sm text-slate-700">{a.title}</div>
                  <div className="text-xs text-slate-500">{a.time}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
