import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import { ContextualEmpty, ErrorState, LoadingCards, OfflineBanner } from '../../components/ui/AsyncState';
import useNetworkStatus from '../../hooks/useNetworkStatus';
import useScheduleRefresh from '../../hooks/useScheduleRefresh';
import { deleteSchedule, fetchMySchedules, fetchScheduleOptions, fetchSchedules } from '../../services/api';
import ScheduleFilters from './ScheduleFilters';
import ScheduleView from './ScheduleView';
import { compareSchedules, SCHEDULE_TIMEZONE } from './scheduleUtils';

const emptyOptions = { courses: [], terms: [], rooms: [], teachers: [], children: [], timezone: SCHEDULE_TIMEZONE };
const initialFilters = { courseId: '', semester: '', termId: '', teacherId: '', studentId: '' };

export default function ScheduleOverview({ audience }) {
  const navigate = useNavigate();
  const online = useNetworkStatus();
  const teacher = audience === 'teacher';
  const parent = audience === 'parent';
  const organization = audience === 'organization';
  const [schedules, setSchedules] = useState([]);
  const [options, setOptions] = useState(emptyOptions);
  const [filters, setFilters] = useState(initialFilters);
  const [mode, setMode] = useState('table');
  const [anchor, setAnchor] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [message, setMessage] = useState('');

  const query = useMemo(() => Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value),
  ), [filters]);

  const loadSchedules = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await (teacher || organization ? fetchSchedules(query) : fetchMySchedules(query));
      setSchedules([...data].sort(compareSchedules));
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organization, query, teacher]);

  useEffect(() => {
    let active = true;
    fetchScheduleOptions()
      .then(data => {
        if (!active) return;
        setOptions({ ...emptyOptions, ...data });
        if (parent && data.children.length) {
          setFilters(current => current.studentId ? current : { ...current, studentId: data.children[0].id });
        }
      })
      .catch(setError);
    return () => { active = false; };
  }, [parent]);

  useEffect(() => {
    // Initial and filter-driven remote synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSchedules();
  }, [loadSchedules]);

  useScheduleRefresh(useCallback(() => {
    if (online) void loadSchedules({ quiet: true });
  }, [loadSchedules, online]));

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSchedule(deleteTarget.id);
      setDeleteTarget(null);
      setMessage('Хуваарь амжилттай устгагдлаа.');
      await loadSchedules({ quiet: true });
    } catch (deleteError) {
      setError(deleteError);
      setDeleteTarget(null);
    }
  };

  const title = teacher
    ? 'Хичээлийн хуваарь'
    : parent
      ? 'Хүүхдийн хуваарь'
      : organization
        ? 'Байгууллагын хуваарь'
        : 'Миний хуваарь';
  const subtitle = parent
    ? 'Хүүхдээ сонгон тухайн семестрийн хичээлийн хуваарийг харна.'
    : organization
      ? 'Бүх багш, хичээл, семестрийн давхцалгүй нэгдсэн хуваарь.'
      : `Цагийн бүс: ${options.timezone || SCHEDULE_TIMEZONE} (UTC+8)`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        showBack={false}
        right={<CalendarDays size={28} />}
      />
      {teacher && (
        <div className="flex justify-end">
          <button className="btn-primary" onClick={() => navigate('/teacher/schedules/new')}>
            <Plus size={17} /> Хуваарь нэмэх
          </button>
        </div>
      )}
      {!online && <OfflineBanner />}
      {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">{message}</div>}
      {error && <ErrorState error={error} onRetry={() => loadSchedules()} />}
      {parent && options.children.length === 0 ? (
        <ContextualEmpty title="Холбогдсон хүүхэд алга" description="Сургуулийн менежер таны parent бүртгэлийг хүүхдийн бүртгэлтэй холбосны дараа хуваарь харагдана." />
      ) : (
        <>
          <ScheduleFilters
            filters={filters}
            onChange={setFilters}
            options={options}
            showTeacher={organization}
            showChild={parent}
          />
          <div className="flex justify-end">
            <button className="btn" disabled={refreshing || !online} onClick={() => loadSchedules({ quiet: true })}>
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Шинэчлэх
            </button>
          </div>
          {loading ? <LoadingCards count={4} /> : schedules.length === 0 ? (
            <ContextualEmpty
              title="Хуваарь олдсонгүй"
              description="Сонгосон шүүлтүүрт тохирох хуваарь байхгүй байна."
              action={teacher ? <button className="btn-primary" onClick={() => navigate('/teacher/schedules/new')}><Plus size={16} />Эхний хуваарь нэмэх</button> : null}
            />
          ) : (
            <ScheduleView
              schedules={schedules}
              mode={mode}
              onModeChange={setMode}
              anchor={anchor}
              onAnchorChange={setAnchor}
              onEdit={teacher ? schedule => navigate(`/teacher/schedules/${schedule.id}/edit`) : undefined}
              onDelete={teacher ? setDeleteTarget : undefined}
            />
          )}
        </>
      )}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="delete-schedule-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600"><Trash2 size={20} /></div>
            <h2 id="delete-schedule-title" className="mt-4 text-lg font-semibold text-slate-900">Хуваарь устгах уу?</h2>
            <p className="mt-2 text-sm text-slate-600">“{deleteTarget.title}” хуваарь устаж, бүртгэлтэй сурагч болон эцэг эхэд мэдэгдэл очно.</p>
            <div className="mt-6 flex justify-end gap-2">
              <button className="btn" onClick={() => setDeleteTarget(null)}>Болих</button>
              <button className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700" onClick={confirmDelete}>Устгах</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
