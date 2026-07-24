import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import { Users, UserCheck, UserPlus, BookOpen, BarChart3, Bell, Server } from 'lucide-react';
import { getAdminDashboardData } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function Admin() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const data = await getAdminDashboardData();
        setDashboardData(data);
      } catch (err) {
        setError('Админы хяналтын самбарын мэдээллийг ачааллахад алдаа гарлаа.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const adminName = user ? `${user.lastName || ''} ${user.firstName || ''}`.trim() || user.email : 'Админ';

  if (loading) {
    return <div className="space-y-6">Ачааллаж байна...</div>;
  }

  if (error) {
    return <div className="space-y-6">{error}</div>;
  }

  const stats = [
    { label: 'Нийт Оюутнууд', value: dashboardData.stats.students, icon: Users },
    { label: 'Багш нар', value: dashboardData.stats.instructors, icon: UserCheck },
    { label: 'Ажилтнууд / Бусад', value: dashboardData.stats.staff, icon: UserPlus },
    { label: 'Нийт Хичээлүүд', value: dashboardData.stats.courses, icon: BookOpen },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Админы хяналтын самбар (${adminName})`}
        subtitle="Хэрэглэгчид, дүрүүд, хичээлүүд болон системийн төлөв байдал (PostgreSQL DB)."
        right={
          <>
            <div className="font-medium text-slate-900">Өнөөдөр</div>
            <div className="mt-1 text-sm text-slate-500">{new Date().toLocaleDateString('mn-MN')}</div>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((item, index) => (
          <StatCard key={index} title={item.label} value={item.value} icon={item.icon} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card title="Системийн идэвхжилийн тойм">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-3xl bg-slate-50 p-5 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{dashboardData.activityOverview.userGrowth.label}</p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">{dashboardData.activityOverview.userGrowth.value}</p>
                  </div>
                  <BarChart3 size={24} className="text-indigo-600" />
                </div>
                <div className="mt-6 h-36 rounded-3xl bg-gradient-to-r from-indigo-500 to-sky-500" />
              </div>
              <div className="rounded-3xl bg-slate-50 p-5 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{dashboardData.activityOverview.courseEngagement.label}</p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">{dashboardData.activityOverview.courseEngagement.value}</p>
                  </div>
                  <Bell size={24} className="text-amber-600" />
                </div>
                <div className="mt-6 h-36 rounded-3xl bg-gradient-to-r from-amber-300 to-amber-500" />
              </div>
            </div>
          </Card>

          <Card title="Баазад бүртгэлтэй хэрэглэгчид (PostgreSQL DB)">
            <div className="space-y-3">
              {dashboardData.recentUsers.map((usr, index) => (
                <div key={index} className="flex items-center justify-between rounded-3xl bg-slate-50 p-4 border border-slate-200">
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
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Сүүлийн системийн логууд">
            <ul className="space-y-3">
              {dashboardData.systemLogs.map((log, index) => (
                <li key={index} className="rounded-3xl bg-slate-50 p-4 border border-slate-200 text-sm text-slate-600">{log.message}</li>
              ))}
            </ul>
          </Card>

          <Card title="Системийн Төлөв (PostgreSQL DB)">
            <div className="space-y-3">
              {dashboardData.systemStatus.map((item, index) => (
                <div key={index} className="flex items-center justify-between rounded-3xl bg-slate-50 p-4 border border-slate-200">
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
