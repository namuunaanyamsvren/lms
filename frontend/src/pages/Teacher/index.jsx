import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import PageHeader from '../../components/ui/PageHeader';
import {
  TeachStat,
  CourseCard,
  UpcomingClassItem,
  AssignmentReviewItem,
  PerfRow,
} from './TeacherWidgets';
import { getTeacherDashboardData } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function Teacher() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const data = await getTeacherDashboardData();
        setDashboardData(data);
      } catch (err) {
        setError('Багшийн хяналтын самбарын мэдээллийг ачааллахад алдаа гарлаа.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const teacherName = user ? `${user.lastName || ''} ${user.firstName || ''}`.trim() || user.email : 'Багш';

  if (loading) {
    return <div className="space-y-6">Ачааллаж байна...</div>;
  }

  if (error) {
    return <div className="space-y-6">{error}</div>;
  }

  const stats = [
    { title: 'Хичээлүүд', value: dashboardData.stats.courses, change: '' },
    { title: 'Сурагчид', value: dashboardData.stats.students, change: 'Бүртгэлтэй' },
    {
      title: 'Дундаж дүн',
      value: dashboardData.stats.averageGrade,
      change: dashboardData.stats.gradesCount > 0 ? `${dashboardData.stats.gradesCount} дүнгээр` : '',
    },
    { title: 'Шалгах даалгавар', value: dashboardData.stats.pendingReviews, change: '' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Багшийн самбар (${teacherName})`}
        subtitle="Таны зааж буй хичээл болон оюутнуудын тойм (PostgreSQL)."
        right={
          <>
            <div className="text-sm text-slate-500">Өнөөдөр</div>
            <div className="bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl text-sm font-medium">
              {new Date().toLocaleDateString('mn-MN')}
            </div>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <TeachStat key={i} title={s.title} value={s.value} change={s.change} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Миний зааж буй хичээлүүд (DB)">
            {dashboardData.courseList.length === 0 ? (
              <p className="text-sm text-slate-500">Танд одоогоор хичээл оноогоогүй байна.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {dashboardData.courseList.map((c, i) => (
                  <CourseCard key={i} title={c.title} students={c.students} progress={c.progress} />
                ))}
              </div>
            )}
          </Card>

          <Card title="Шалгах даалгаврууд (DB)">
            {dashboardData.reviewList.length === 0 ? (
              <p className="text-sm text-slate-500">Шалгах даалгавар одоогоор алга байна.</p>
            ) : (
              <div className="space-y-2">
                {dashboardData.reviewList.map((r, i) => (
                  <AssignmentReviewItem key={i} title={r.title} pending={r.pending} />
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Идэвхтэй ангиуд">
            {dashboardData.upcomingClasses.length === 0 ? (
              <p className="text-sm text-slate-500">Идэвхтэй анги одоогоор алга байна.</p>
            ) : (
              <div className="space-y-2">
                {dashboardData.upcomingClasses.map((c, i) => (
                  <UpcomingClassItem key={i} title={c.title} time="Хуваарь тодорхойгүй" />
                ))}
              </div>
            )}
          </Card>

          <Card title="Оюутнуудын гүйцэтгэл (DB)">
            {dashboardData.perfList.length === 0 ? (
              <p className="text-sm text-slate-500">Дүнгийн мэдээлэл одоогоор алга байна.</p>
            ) : (
              <div className="space-y-2">
                {dashboardData.perfList.map((p, i) => (
                  <PerfRow key={i} student={p.student} score={p.score} />
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Card title="Сүүлийн үйл ажиллагаа">
        {dashboardData.activityFeed.length === 0 ? (
          <p className="text-sm text-slate-500">Сүүлийн үйл ажиллагаа одоогоор алга байна.</p>
        ) : (
          <ul className="space-y-3">
            {dashboardData.activityFeed.map((item, i) => (
              <li key={i} className="text-sm">{item.message} — {item.time}</li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
