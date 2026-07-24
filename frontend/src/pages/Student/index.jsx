import { useState, useEffect } from 'react';
import { BarChart2, BookOpen, Calendar, FileCheck, Star } from 'lucide-react';
import DashboardTemplate from '../../components/dashboard/DashboardTemplate';
import {
  DashboardActivityFeed,
  DashboardInfoRows,
  DashboardListCard,
  DashboardMetricCard,
  DashboardProgressList,
} from '../../components/dashboard/DashboardWidgets';
import { CalendarMini } from './DashboardWidgets.local';
import { getStudentDashboardData } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/ui/Card';

export default function Student() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const data = await getStudentDashboardData();
        setDashboardData(data);
      } catch (err) {
        setError('Дашбордын мэдээллийг ачааллахад алдаа гарлаа.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const studentName = user ? `${user.lastName || ''} ${user.firstName || ''}`.trim() || user.email : 'Оюутан';

  if (loading) {
    return (
      <DashboardTemplate
        title={`Сайн байна уу, ${studentName}!`}
        subtitle="Таны суралцах идэвхжлийн тоймыг ачааллаж байна..."
      >
        <div>Ачааллаж байна...</div>
      </DashboardTemplate>
    );
  }

  if (error) {
    return (
      <DashboardTemplate title="Алдаа гарлаа" subtitle={error}>
        <Card>
          <p>Дахин оролдоно уу. Хэрэв алдаа засагдахгүй бол системийн админд хандана уу.</p>
        </Card>
      </DashboardTemplate>
    );
  }

  const stats = [
    { title: 'Хичээл', value: dashboardData.stats.courses, delta: 'Идэвхтэй', icon: BookOpen },
    { title: 'Даалгавар', value: dashboardData.stats.assignments, delta: 'Хүлээгдэж буй', icon: FileCheck },
    { title: 'Шалгалт', value: dashboardData.stats.exams, delta: 'Товлогдсон', icon: Star },
    { title: 'Суралцсан цаг', value: `${dashboardData.stats.studyHours}ц`, delta: `+${dashboardData.stats.studyHoursDelta}ц`, icon: Calendar },
  ];

  return (
    <DashboardTemplate
      title={`Сайн байна уу, ${studentName}!`}
      subtitle="Таны суралцах идэвхжлийн тойм (PostgreSQL Баазаас ачааллаа)."
      stats={stats}
      leftColumn={
        <>
          <DashboardProgressList
            title="Хичээлийн явц"
            subtitle="Идэвхтэй хичээлүүдийн явц"
            items={dashboardData.courseProgress}
          />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <DashboardListCard
              title="Ойрын даалгавар (DB)"
              items={dashboardData.upcomingAssignments.map(a => ({ ...a, subtitle: `Хугацаа: ${new Date(a.subtitle).toLocaleDateString('mn-MN')}`}))}
              actionLabel="Харах"
            />

            <DashboardListCard
              title="Өнөөдрийн хичээл"
              items={dashboardData.todayClasses.map((c) => ({
                title: c.title,
                subtitle: 'Лекцийн өрөө • Баазаас ачаалсан',
              }))}
              actionLabel="Оролцох"
            />
          </div>
        </>
      }
      rightColumn={
        <>
          <CalendarMini />

          <DashboardInfoRows
            title="Сүүлийн дүн (DB)"
            items={dashboardData.recentGrades}
          />

          <DashboardListCard
            title="Мэдэгдэл"
            items={dashboardData.notifications}
          />

          <DashboardMetricCard
            title="Суралцах идэвх"
            subtitle="Сүүлийн 7 хоног"
            value={dashboardData.engagement.value}
            icon={BarChart2}
          />
        </>
      }
      bottomSection={
        <DashboardActivityFeed title="Сүүлийн үйл ажиллагаа" items={dashboardData.activityFeed} />
      }
    />
  );
}
