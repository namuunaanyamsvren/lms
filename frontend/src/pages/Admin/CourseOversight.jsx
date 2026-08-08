import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { queryKeys } from '../../services/queryKeys';
import { fetchCourses, fetchCohorts } from '../../services/api';
import { Search, BookOpen, Layers } from 'lucide-react';

const STATUS_TONE = {
  PUBLISHED: 'bg-emerald-100 text-emerald-800',
  DRAFT: 'bg-amber-100 text-amber-800',
  ARCHIVED: 'bg-slate-100 text-slate-600',
};

export default function CourseOversight() {
  const [searchParams] = useSearchParams();
  const highlightedCohortId = searchParams.get('cohortId');
  const [tab, setTab] = useState(searchParams.get('tab') === 'cohorts' || highlightedCohortId ? 'cohorts' : 'courses');
  const [search, setSearch] = useState('');

  const coursesQuery = useQuery({ queryKey: ['courses', 'oversight'], queryFn: () => fetchCourses({ limit: 100 }) });
  const cohortsQuery = useQuery({ queryKey: queryKeys.cohorts.list, queryFn: fetchCohorts });

  const courses = (coursesQuery.data?.items || []).filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));
  const cohorts = (cohortsQuery.data || []).filter((c) => `${c.course?.title || ''} ${c.name}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader title="Хичээл, ангийн хяналт" subtitle="Байгууллагын бүх хичээл, ангийн нэгдсэн харагдац." />

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <button onClick={() => setTab('courses')} className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${tab === 'courses' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Хичээлүүд ({courses.length})</button>
            <button onClick={() => setTab('cohorts')} className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${tab === 'cohorts' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Ангиуд ({cohorts.length})</button>
          </div>
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Хайх..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs" />
          </div>
        </div>

        {tab === 'courses' ? (
          coursesQuery.isLoading ? (
            <div className="flex min-h-[30vh] items-center justify-center"><LoadingSpinner /></div>
          ) : courses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
              <BookOpen size={36} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">Хичээл олдсонгүй</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {courses.map((c) => (
                <div key={c.id} className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-600">{c.code}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[c.status] || 'bg-slate-100 text-slate-700'}`}>{c.status}</span>
                  </div>
                  <p className="mt-2 font-semibold text-slate-900">{c.title}</p>
                  <p className="mt-1 text-slate-500">{c._count?.modules || 0} модуль · {c._count?.cohorts || 0} анги</p>
                </div>
              ))}
            </div>
          )
        ) : cohortsQuery.isLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center"><LoadingSpinner /></div>
        ) : cohorts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
            <Layers size={36} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">Анги олдсонгүй</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cohorts.map((c) => (
              <div
                key={c.id}
                className={`flex items-center justify-between rounded-2xl border px-4 py-2.5 text-xs ${
                  highlightedCohortId === c.id
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-slate-200/80 bg-slate-50'
                }`}
              >
                <span className="text-slate-700 font-medium">{c.course?.title || 'Хичээл'} — {c.name}</span>
                <span className="text-slate-500">{(c.enrollments || []).length} сурагч</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
