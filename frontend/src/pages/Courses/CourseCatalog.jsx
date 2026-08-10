import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Users } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { fetchCourses } from '../../services/api';
import { ContextualEmpty, ErrorState, LoadingCards, OfflineBanner } from '../../components/ui/AsyncState';
import useNetworkStatus from '../../hooks/useNetworkStatus';

export default function CourseCatalog() {
  const [result, setResult] = useState({ items: [], pagination: {} });
  const [filters, setFilters] = useState({ search: '', level: '', page: 1, limit: 9 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const online = useNetworkStatus();
  const load = () => {
    setLoading(true); setError(null);
    return fetchCourses(filters).then(setResult).catch(setError).finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
    // filters intentionally controls debounced reload
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return <div className="space-y-6">
    <PageHeader title="Хичээлийн каталог" subtitle="Бүртгэлтэй хичээлүүдээ хайж, суралцах явцаа үргэлжлүүлээрэй." />
    {!online && <OfflineBanner />}
    <div className="flex flex-col sm:flex-row gap-3">
      <label className="relative flex-1">
        <Search className="absolute left-3 top-3 text-slate-400" size={18} />
        <input aria-label="Хичээл хайх" value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value, page: 1 })} placeholder="Нэр эсвэл кодоор хайх..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200" />
      </label>
      <input aria-label="Түвшин" value={filters.level} onChange={e => setFilters({ ...filters, level: e.target.value, page: 1 })} placeholder="Түвшин" className="px-4 py-2.5 rounded-xl border border-slate-200" />
    </div>
    {loading ? <LoadingCards /> : error ? <ErrorState error={error} onRetry={load}/> : result.items.length === 0 ? <ContextualEmpty title="Хичээл олдсонгүй" description={filters.search||filters.level?'Хайлтын нөхцөлөө цэвэрлээд дахин оролдоно уу.':'Таны бүртгэлтэй published хичээл одоогоор алга.'} action={(filters.search||filters.level)&&<button className="btn-primary" onClick={()=>setFilters({search:'',level:'',page:1,limit:9})}>Шүүлтүүр цэвэрлэх</button>} /> :
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{result.items.map(course =>
        <Link key={course.id} to={`/student/courses/${course.id}`} className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition">
          <div className="h-40 bg-gradient-to-br from-indigo-500 to-cyan-500">{course.coverImageUrl && <img src={course.coverImageUrl} alt="" className="w-full h-full object-cover" />}</div>
          <div className="p-5"><div className="flex justify-between gap-3"><span className="text-xs font-semibold text-indigo-600">{course.code}</span><span className="text-xs text-slate-500">{course.credits} кредит</span></div>
            <p className="mt-2 text-xs text-slate-500">{course.durationWeeks ? `${course.durationWeeks} долоо хоног` : 'Хугацаа тохируулаагүй'} · {Number(course.price || 0).toLocaleString('mn-MN')} {course.currency || 'MNT'}</p>
            <h2 className="font-semibold text-lg mt-2 group-hover:text-indigo-600">{course.title}</h2>
            <p className="text-sm text-slate-500 mt-2 line-clamp-2">{course.description || 'Тайлбар оруулаагүй'}</p>
            <div className="flex gap-4 mt-4 text-xs text-slate-500"><span>{course.level || 'Бүх түвшин'}</span><span className="flex gap-1"><Users size={14} />{course._count?.cohorts || 0} анги</span></div>
          </div>
        </Link>)}</div>}
    {result.pagination.pages > 1 && <div className="flex justify-center gap-3"><button disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Өмнөх</button><span>{filters.page} / {result.pagination.pages}</span><button disabled={filters.page >= result.pagination.pages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Дараах</button></div>}
  </div>;
}
