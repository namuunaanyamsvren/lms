import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import { Users, UserCheck, UserPlus, BookOpen, BarChart3, Bell, Layers, CalendarCheck, AlertTriangle } from 'lucide-react';
import { getAdminDashboardData } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import CalendarWithNotes from '../../components/dashboard/CalendarWithNotes';

const metricPercent = (metric) => {
  const max = Number(metric?.max || 0);
  const value = Number(metric?.value || 0);
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
};

const emptyDashboardData = {
  stats: {
    students: 0,
    instructors: 0,
    staff: 0,
    courses: 0,
    activeCohorts: 0,
    averageAttendancePct: null,
  },
  activityOverview: {
    userGrowth: { label: 'Хэрэглэгчийн өсөлт (сүүлийн 30 хоног)', value: '—' },
    courseEngagement: { label: 'Хичээлийн идэвх (сүүлийн 30 хоног)', value: '—' },
  },
  activityMetrics: [],
  recentUsers: [],
  atRiskSummary: { total: 0, studentCount: 0, courseCount: 0, items: [] },
  systemLogs: [],
  systemStatus: [
    { label: 'Academic Service', value: 'Түр хугацаанд мэдээлэл авах боломжгүй', status: 'UNKNOWN' },
  ],
};

export default function Admin() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setWarning(null);
        const data = await getAdminDashboardData();
        setDashboardData(data);
      } catch (err) {
        setDashboardData(emptyDashboardData);
        setWarning('Менежерийн хяналтын самбарын зарим мэдээлэл түр ачаалсангүй. Хуудсаа дахин сэргээгээрэй.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const adminName = user ? `${user.lastName || ''} ${user.firstName || ''}`.trim() || user.email : 'Менежер';

  if (loading) {
    return <div className="space-y-6">Ачааллаж байна...</div>;
  }

  const stats = [
    { label: 'Нийт Оюутнууд', value: dashboardData.stats.students, icon: Users },
    { label: 'Багш нар', value: dashboardData.stats.instructors, icon: UserCheck },
    { label: 'Ажилтнууд / Бусад', value: dashboardData.stats.staff, icon: UserPlus },
    { label: 'Нийт Хичээлүүд', value: dashboardData.stats.courses, icon: BookOpen },
  ];

  const summaryStats = [
    { label: 'Идэвхтэй ангиуд', value: dashboardData.stats.activeCohorts, icon: Layers },
    { label: 'Ирцийн дундаж', value: dashboardData.stats.averageAttendancePct != null ? `${dashboardData.stats.averageAttendancePct}%` : '—', icon: CalendarCheck },
  ];
  const atRiskSummary = dashboardData.atRiskSummary || { total: 0, studentCount: 0, courseCount: 0, items: [] };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Менежерийн хяналтын самбар (${adminName})`}
        subtitle="Хэрэглэгчид, дүрүүд, хичээлүүд болон системийн төлөв байдал."
        right={
          <>
            <div className="font-medium text-slate-900">Өнөөдөр</div>
            <div className="mt-1 text-sm text-slate-500">{new Date().toLocaleDateString('mn-MN')}</div>
          </>
        }
      />

      {warning && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {warning}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((item, index) => (
          <StatCard key={index} title={item.label} value={item.value} icon={item.icon} />
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {summaryStats.map((item, index) => (
          <StatCard key={index} title={item.label} value={item.value} icon={item.icon} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card
            title="Эрсдэлтэй сурагчид"
            right={
              <div className="flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                <AlertTriangle size={14} />
                {atRiskSummary.studentCount} сурагч
              </div>
            }
          >
            {atRiskSummary.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                Одоогоор эрсдэлтэй сурагч илрээгүй байна.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl border border-rose-100 bg-rose-50 px-2 py-2">
                    <p className="text-lg font-bold text-rose-700">{atRiskSummary.total}</p>
                    <p className="text-[11px] text-rose-700">Эрсдэлийн тохиолдол</p>
                  </div>
                  <div className="rounded-xl border border-amber-100 bg-amber-50 px-2 py-2">
                    <p className="text-lg font-bold text-amber-700">{atRiskSummary.studentCount}</p>
                    <p className="text-[11px] text-amber-700">Давхардалгүй сурагч</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2">
                    <p className="text-lg font-bold text-slate-700">{atRiskSummary.courseCount}</p>
                    <p className="text-[11px] text-slate-600">Холбогдсон курс</p>
                  </div>
                </div>
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                  {atRiskSummary.items.map((item) => {
                    const name = `${item.student?.lastName || ''} ${item.student?.firstName || ''}`.trim() || item.student?.email;
                    return (
                      <div key={`${item.student?.id}-${item.courseId}`} className="p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{name}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{item.courseTitle}</p>
                          </div>
                          <div className="flex gap-2 text-xs">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                              Дүн {item.percent != null ? `${Math.round(item.percent)}%` : '—'}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                              Ирц {item.attendancePercent != null ? `${Math.round(item.attendancePercent)}%` : '—'}
                            </span>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-rose-700">{(item.reasons || []).join(' · ')}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          <Card title="Системийн идэвхжилийн тойм">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {[
                { ...dashboardData.activityOverview.userGrowth, icon: BarChart3 },
                { ...dashboardData.activityOverview.courseEngagement, icon: Bell },
              ].map((overview, index) => {
                const Icon = overview.icon;
                return (
                  <div key={overview.label} className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-500">{overview.label}</p>
                        <p className="mt-2 text-xl font-semibold text-slate-900">{overview.value}</p>
                      </div>
                      <Icon size={24} className={index === 0 ? 'text-primary' : 'text-amber-600'} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 space-y-3">
              {(dashboardData.activityMetrics || []).map((metric) => (
                <div key={metric.label}>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span>{metric.label}</span>
                    <span>{metric.value}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${metricPercent(metric)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Сүүлд бүртгэгдсэн хэрэглэгчид">
            {dashboardData.recentUsers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                Сүүлийн хэрэглэгчийн мэдээлэл одоогоор алга.
              </div>
            ) : (
              <div className="space-y-3">
                {dashboardData.recentUsers.map((usr, index) => (
                <div key={index} className="flex items-center justify-between rounded-3xl bg-white p-4 border border-slate-200">
                  <div>
                    <p className="font-medium text-slate-900">{usr.name}</p>
                    <p className="text-sm text-slate-500">{usr.role} • {usr.email}</p>
                  </div>
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-indigo-600">
                    DB Хэрэглэгч
                  </span>
                </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <CalendarWithNotes />

          <Card title="Системийн төлөв">
            <div className="space-y-3">
              {dashboardData.systemStatus.map((item, index) => (
                <div key={index} className="flex items-center justify-between rounded-3xl bg-white p-4 border border-slate-200">
                  <div>
                    <p className="font-medium text-slate-900">{item.label}</p>
                    <p className="text-sm text-slate-500">{item.value}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">{item.status}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
