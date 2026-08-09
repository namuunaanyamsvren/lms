import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { getPrincipalDashboardData } from '../../services/api';
import { BarChart2, Users, Calendar, Layers, Star, ArrowRight, Cpu, ArrowUpRight } from 'lucide-react';

function MiniSeries({ items = [], suffix = '' }) {
  const max = Math.max(...items.map(item => Number(item.value) || 0), 1);
  return (
    <div className="mt-4 grid grid-cols-6 items-end gap-2" aria-label="Хугацааны цуваа">
      {items.map(item => {
        const value = Number(item.value) || 0;
        const height = Math.max(8, Math.round((value / max) * 72));
        return (
          <div key={item.label} className="flex min-w-0 flex-col items-center gap-2">
            <div className="flex h-[76px] w-full items-end justify-center rounded-xl bg-slate-100 px-1">
              <div className="w-full rounded-t-lg bg-primary" style={{ height }} title={`${item.label}: ${value}${suffix}`} />
            </div>
            <span className="max-w-full truncate text-[10px] text-slate-500">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Principal() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboards', 'principal'],
    queryFn: getPrincipalDashboardData,
  });

  if (isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><LoadingSpinner /></div>;
  }
  if (isError || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Захирлын хяналтын самбар" subtitle="Их сургуулийн түвшний KPI, тайлан." />
        <Card><p className="text-sm text-rose-600">Мэдээлэл ачаалахад алдаа гарлаа.</p></Card>
      </div>
    );
  }

  const kpiIcons = [Users, Star, Calendar, Layers];
  const kpiLinks = ['/principal/course-oversight', '/principal/course-oversight', '/principal/course-oversight', '/principal/course-oversight'];

  return (
    <div className="space-y-6">
      <PageHeader title="Захирлын хяналтын самбар" subtitle="Их сургуулийн түвшний KPI, тайлан." />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {data.stats.map((k, i) => (
          <Link key={i} to={kpiLinks[i]}>
            <StatCard title={k.title} value={k.value} icon={kpiIcons[i]} />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card title="Элсэлтийн чиг хандлага">
            <div className="rounded-3xl bg-slate-50 p-5 border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">6 сарын чиг хандлага</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">{data.enrollmentTrend.value}</p>
                </div>
                <BarChart2 size={24} className="text-indigo-600" />
              </div>
              <MiniSeries items={data.enrollmentSeries || []} />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {data.enrollmentDeltas.map((t, idx) => (
                <div key={idx} className="rounded-3xl bg-slate-50 p-4 border border-slate-200">
                  <p className="text-sm text-slate-500">{t.label}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{t.value}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Ирцийн шинжилгээ">
            <div className="rounded-3xl bg-slate-50 p-4 border border-slate-200">
              <p className="text-sm text-slate-500">Сүүлийн сарын дундаж ирц</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{data.attendanceTrend.value}</p>
              <MiniSeries items={data.attendanceSeries || []} suffix="%" />
            </div>
          </Card>

          <Card
            title="Тэнхимийн гүйцэтгэл"
            right={<Link to="/principal/course-oversight" className="text-xs font-semibold text-indigo-600 flex items-center gap-1">Хичээлүүд <ArrowRight size={13} /></Link>}
          >
            {data.departmentPerformance.length === 0 ? (
              <p className="text-sm text-slate-500">Гүйцэтгэлийн өгөгдөл алга байна.</p>
            ) : (
              <div className="space-y-3">
                {data.departmentPerformance.map((d, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-3xl bg-slate-50 p-4 border border-slate-200">
                    <div>
                      <p className="font-medium text-slate-900">{d.label}</p>
                      <p className="text-sm text-slate-500">Дундаж дүн</p>
                    </div>
                    <div className="text-sm font-semibold text-slate-700">{d.value}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Төгсөлтийн хувь">
            <div className="rounded-3xl bg-slate-50 p-4 border border-slate-200">
              <p className="text-sm text-slate-500">Cohort дүүргэлт</p>
              <div className="mt-4 text-3xl font-semibold text-slate-900">{data.graduationRate.value}</div>
            </div>
          </Card>

          <Card
            title="Сүүлийн үйл ажиллагаа"
            right={<Link to="/principal/audit-log" className="text-xs font-semibold text-indigo-600 flex items-center gap-1">Бүгд <ArrowRight size={13} /></Link>}
          >
            {data.activityFeed.length === 0 ? (
              <p className="text-sm text-slate-500">Үйл ажиллагаа алга байна.</p>
            ) : (
              <div className="space-y-3">
                {data.activityFeed.map((a, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className={`w-2.5 h-2.5 mt-2 rounded-full ${a.active ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                    <div>
                      <p className="text-sm text-slate-700">{a.title}</p>
                      <p className="text-xs text-slate-500">{a.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Системийн төлөв" right={<Link to="/principal/audit-log"><ArrowUpRight size={15} className="text-slate-400" /></Link>}>
            <div className="rounded-3xl bg-slate-50 p-4 border border-slate-200">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">Платформын байдал</p>
                <Cpu size={20} className="text-sky-600" />
              </div>
              <div className="mt-4 text-sm text-slate-600">{data.systemStatus.value}</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
