import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart2, Calendar, ClipboardCheck, Edit3, FileCheck, Search, UserCheck } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { fetchCourses, fetchTeacherStudents } from '../../services/api';

const courseActions = [
  { label: 'Сурагчид', href: '/teacher/students', icon: UserCheck },
  { label: 'Ирцийн бүртгэл', href: '/teacher/attendance', icon: ClipboardCheck },
  { label: 'Даалгаврууд', href: '/teacher/assignments', icon: FileCheck },
  { label: 'Дүн тавих', href: '/teacher/grading', icon: BarChart2 },
  { label: 'Хичээлийн хуваарь', href: '/teacher/schedules', icon: Calendar },
];

export default function TeacherCourses() {
  const [result, setResult] = useState({ items: [], pagination: {} });
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { const timer = setTimeout(() => fetchCourses({ search, limit: 50 }).then(setResult), 200); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchCourses({ limit: 50 }), fetchTeacherStudents()])
      .then(([coursesResult, studentRows]) => {
        setResult(coursesResult);
        setStudents(studentRows);
        setSelectedCourseId(current => current || coursesResult.items?.[0]?.id || '');
      })
      .finally(() => setLoading(false));
  }, []);

  const courses = result.items || [];
  const selectedCourse = courses.find(course => course.id === selectedCourseId) || courses[0] || null;
  const selectedStudents = selectedCourse
    ? students.filter(student => student.enrollments?.some(enrollment => enrollment.cohort?.course?.id === selectedCourse.id))
    : [];

  return <div className="space-y-6">
    <PageHeader title="Миний хичээлүүд" subtitle="Course lifecycle, контент болон багийг удирдана." />

    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <label className="relative block">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm dark:border-slate-700 dark:bg-slate-900" value={search} onChange={e => setSearch(e.target.value)} placeholder="Хичээл хайх..." />
        </label>
        <div className="mt-3 space-y-2">
          {courses.map(course => (
            <button
              key={course.id}
              onClick={() => setSelectedCourseId(course.id)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition ${selectedCourse?.id === course.id ? 'border-indigo-300 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'}`}
            >
              <span className="block font-semibold">{course.title}</span>
              <span className="mt-0.5 block text-slate-500">{course.code} · {course._count?.cohorts || 0} анги</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        {!selectedCourse ? (
          <div className="flex min-h-[30vh] items-center justify-center text-sm text-slate-500">
            {loading ? <LoadingSpinner /> : 'Хичээл олдсонгүй.'}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-indigo-600">{selectedCourse.code}</span>
                <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{selectedCourse.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{selectedCourse._count?.modules || 0} модуль · {selectedStudents.length} сурагч</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${selectedCourse.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : selectedCourse.status === 'ARCHIVED' ? 'bg-slate-200' : 'bg-amber-100 text-amber-700'}`}>{selectedCourse.status}</span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                  <tr>
                    <th className="px-4 py-3">Сурагч</th>
                    <th className="px-4 py-3">Имэйл</th>
                    <th className="px-4 py-3">Утас</th>
                    <th className="px-4 py-3">Анги</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {selectedStudents.length === 0 ? (
                    <tr><td colSpan="4" className="px-4 py-10 text-center text-sm text-slate-500">Энэ хичээлд бүртгэлтэй сурагч алга.</td></tr>
                  ) : selectedStudents.map(student => {
                    const cohortNames = student.enrollments
                      ?.filter(enrollment => enrollment.cohort?.course?.id === selectedCourse.id)
                      .map(enrollment => enrollment.cohort?.name)
                      .filter(Boolean)
                      .join(', ');
                    return (
                      <tr key={student.id} className="bg-white dark:bg-slate-800">
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{student.firstName} {student.lastName}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{student.email}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{student.phone || '—'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{cohortNames || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {courseActions.map(({ label, href, icon: Icon }) => (
                <Link
                  key={href}
                  to={`${href}?courseId=${encodeURIComponent(selectedCourse.id)}`}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Icon size={15} />
                  <span>{label}</span>
                </Link>
              ))}
              <Link to={`/teacher/courses/${selectedCourse.id}/builder`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-500/10">
                <Edit3 size={15} />
                <span>Builder</span>
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  </div>;
}
