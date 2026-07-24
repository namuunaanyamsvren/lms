import { useState, useEffect } from 'react';
import {
  BarChart2,
  Bell,
  BookOpen,
  Calendar,
  FileCheck,
  MessageCircle,
  Star,
} from 'lucide-react';
import DashboardTemplate from '../../components/dashboard/DashboardTemplate';
import {
  DashboardActivityFeed,
  DashboardInfoRows,
  DashboardListCard,
  DashboardMessageCard,
  DashboardMetricCard,
  DashboardProfileCard,
  DashboardProgressList,
} from '../../components/dashboard/DashboardWidgets';
import Card from '../../components/ui/Card';
import { getParentDashboardData } from '../../services/api';

const STAT_ICONS = [Calendar, Star, FileCheck, MessageCircle];
const NOTICE_ICONS = [Bell, BookOpen];

export default function Parent() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const data = await getParentDashboardData();
        setDashboardData(data);
      } catch (err) {
        setError('Эцэг эхийн хяналтын самбарын мэдээллийг ачааллахад алдаа гарлаа.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <DashboardTemplate title="Эцэг эхийн самбар" subtitle="Мэдээллийг ачааллаж байна...">
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

  if (!dashboardData.hasChild) {
    return (
      <DashboardTemplate
        title="Эцэг эхийн самбар"
        subtitle="Хүүхдийнхээ явц, ирц, мессежийг нэг дор хянаарай."
      >
        <Card title="Хүүхэд холбогдоогүй байна">
          <p className="text-sm text-slate-500">
            Таны бүртгэлтэй одоогоор ямар ч суралцагч холбогдоогүй байна. Сургуулийн ажилтантай холбогдож
            хүүхдээ бүртгүүлнэ үү.
          </p>
        </Card>
      </DashboardTemplate>
    );
  }

  const stats = dashboardData.stats.map((s, i) => ({ ...s, icon: STAT_ICONS[i] }));

  return (
    <DashboardTemplate
      title="Эцэг эхийн самбар"
      subtitle="Хүүхдийнхээ явц, ирц, мессежийг нэг дор хянаарай."
      stats={stats}
      leftColumn={
        <>
          <DashboardProfileCard
            name={dashboardData.child.name}
            badge={dashboardData.child.badge}
            meta={dashboardData.child.meta}
            stats={[{ ...dashboardData.child.profileStat, icon: Calendar }]}
          />

          <DashboardProgressList
            title="Дaалгаврын явц"
            subtitle="Одоогийн даалгаврууд"
            items={dashboardData.assignmentProgress}
          />

          <DashboardListCard
            title="Ойрын арга хэмжээ"
            items={
              dashboardData.upcomingEvents.length > 0
                ? dashboardData.upcomingEvents
                : [{ title: 'Ойрын арга хэмжээ алга байна', subtitle: '' }]
            }
          />

          <DashboardMessageCard
            title="Багшийн мессеж"
            messages={dashboardData.teacherMessages}
          />
        </>
      }
      rightColumn={
        <>
          <DashboardInfoRows
            title="Ирцийн тойм"
            items={dashboardData.attendanceBreakdown.map(item => ({
              ...item,
              value: `${item.value}%`,
              tone:
                item.label === 'Ирсэн'
                  ? 'text-emerald-600'
                  : item.label === 'Хоцорсон'
                  ? 'text-amber-600'
                  : 'text-rose-600',
            }))}
          />

          <DashboardInfoRows title="Сүүлийн дүн" items={dashboardData.recentGrades} />

          <Card title="Сургуулийн мэдэгдэл">
            {dashboardData.schoolNotices.length === 0 ? (
              <p className="text-sm text-slate-500">Одоогоор мэдэгдэл алга байна.</p>
            ) : (
              <div className="space-y-3">
                {dashboardData.schoolNotices.map((item, index) => {
                  const Icon = NOTICE_ICONS[index % NOTICE_ICONS.length];
                  return (
                    <div
                      key={index}
                      className="flex items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                        <div className="mt-1 text-sm text-slate-500">{item.body}</div>
                      </div>
                      <Icon size={20} className="shrink-0 text-indigo-600" />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <DashboardMetricCard
            title="Академик явц"
            subtitle="Ерөнхий гүйцэтгэл"
            value={dashboardData.academicProgress.value}
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
