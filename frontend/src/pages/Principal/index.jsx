import { useState, useEffect } from 'react';
import {
  BarChart2,
  Calendar,
  Cpu,
  FileText,
  Layers,
  Star,
  Users,
} from 'lucide-react';
import DashboardTemplate from '../../components/dashboard/DashboardTemplate';
import {
  DashboardActivityFeed,
  DashboardChartCard,
  DashboardInfoRows,
  DashboardMetricCard,
} from '../../components/dashboard/DashboardWidgets';
import Card from '../../components/ui/Card';
import { getPrincipalDashboardData } from '../../services/api';

const STAT_ICONS = [Users, Star, Calendar, Layers];

export default function Principal() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const data = await getPrincipalDashboardData();
        setDashboardData(data);
      } catch (err) {
        setError('Захирлын хяналтын самбарын мэдээллийг ачааллахад алдаа гарлаа.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return <div className="space-y-6">Ачааллаж байна...</div>;
  }

  if (error) {
    return <div className="space-y-6">{error}</div>;
  }

  const stats = dashboardData.stats.map((s, i) => ({ ...s, icon: STAT_ICONS[i] }));

  return (
    <DashboardTemplate
      title="Захирлын самбар"
      subtitle="Их сургуулийн түвшний KPI болон тайлан."
      stats={stats}
      leftColumn={
        <>
          <DashboardChartCard
            title="Элсэлтийн чиг хандлага"
            subtitle="Сүүлийн 6 сарын өсөлт"
            label="6 сарын тренд"
            value={dashboardData.enrollmentTrend.value}
            icon={BarChart2}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            {dashboardData.enrollmentDeltas.map((item, index) => (
              <div key={index} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">{item.label}</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>

          <DashboardChartCard
            title="Ирцийн аналитик"
            subtitle="Өдөр тутмын ирцийн тойм"
            label="Дундаж ирц"
            value={dashboardData.attendanceTrend.value}
            icon={Calendar}
            gradient="from-emerald-300 to-emerald-500"
          />

          <DashboardInfoRows
            title="Тэнхимийн гүйцэтгэл"
            items={
              dashboardData.departmentPerformance.length > 0
                ? dashboardData.departmentPerformance.map(d => ({ ...d, subtitle: 'Сүүлийн гүйцэтгэл' }))
                : [{ label: 'Мэдээлэл алга', subtitle: 'Дүн бүртгэгдээгүй байна', value: '—' }]
            }
          />
        </>
      }
      rightColumn={
        <>
          <DashboardMetricCard
            title="Төгсөлтийн хувь"
            subtitle="Когортын дуусгал"
            value={dashboardData.graduationRate.value}
            icon={Star}
            tone="emerald"
          />

          <Card title="Удирдлагын тайлан">
            {dashboardData.managementReports.length === 0 ? (
              <p className="text-sm text-slate-500">Одоогоор удирдлагын тайлан бэлдээгүй байна.</p>
            ) : (
              <div className="space-y-3">
                {dashboardData.managementReports.map((report, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{report.title}</p>
                      <p className="text-sm text-slate-500">{report.date}</p>
                    </div>
                    <FileText size={20} className="text-indigo-600" />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <DashboardMetricCard
            title="Системийн төлөв"
            subtitle="Платформын эрүүл мэнд"
            value={dashboardData.systemStatus.value}
            icon={Cpu}
            tone="sky"
          />
        </>
      }
      bottomSection={
        <DashboardActivityFeed
          title="Сүүлийн үйл ажиллагаа"
          items={dashboardData.activityFeed}
        />
      }
    />
  );
}
