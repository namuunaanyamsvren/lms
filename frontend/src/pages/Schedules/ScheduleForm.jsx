import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Save } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import { ErrorState, LoadingCards, OfflineBanner } from '../../components/ui/AsyncState';
import useAsyncAction from '../../hooks/useAsyncAction';
import useNetworkStatus from '../../hooks/useNetworkStatus';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';
import { createSchedule, fetchScheduleById, fetchScheduleOptions, updateSchedule } from '../../services/api';
import { DAYS, SCHEDULE_TIMEZONE } from './scheduleUtils';

const empty = {
  courseId: '',
  title: '',
  dayOfWeek: 'MONDAY',
  startTime: '09:00',
  endTime: '10:30',
  termId: '',
  roomId: '',
};
const inputClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';

export default function ScheduleForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const online = useNetworkStatus();
  const { run, pending } = useAsyncAction();
  const [form, setForm] = useState(empty);
  const [initial, setInitial] = useState(empty);
  const [options, setOptions] = useState({ courses: [], terms: [], rooms: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fieldError, setFieldError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);
  useUnsavedChanges(dirty && !pending && !submitted);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchScheduleOptions(),
      editing ? fetchScheduleById(id) : Promise.resolve(null),
    ]).then(([scheduleOptions, schedule]) => {
      if (!active) return;
      setOptions(scheduleOptions);
      if (schedule) {
        const value = {
          courseId: schedule.courseId,
          title: schedule.title,
          dayOfWeek: schedule.dayOfWeek,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          termId: schedule.termId || '',
          roomId: schedule.roomId || '',
        };
        setForm(value);
        setInitial(value);
      }
    }).catch(setError).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [editing, id]);

  const change = (key, value) => {
    setFieldError('');
    setForm(current => ({ ...current, [key]: value }));
  };
  const submit = event => run(async () => {
    event.preventDefault();
    if (form.startTime >= form.endTime) {
      setFieldError('Дуусах цаг эхлэх цагаас хойш байх ёстой.');
      return;
    }
    const payload = Object.fromEntries(Object.entries(form).filter(([, value]) => value !== ''));
    try {
      if (editing) await updateSchedule(id, payload);
      else await createSchedule(payload);
      setSubmitted(true);
      setInitial(form);
      navigate('/teacher/schedules', { replace: true, state: { saved: true } });
    } catch (submitError) {
      setError(submitError);
    }
  });

  if (loading) return <LoadingCards count={3} />;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={editing ? 'Хуваарь засах' : 'Шинэ хуваарь'}
        subtitle={`Давхцлыг ${SCHEDULE_TIMEZONE} (UTC+8) цагийн бүсээр шалгана.`}
        right={<CalendarPlus size={28} />}
      />
      {!online && <OfflineBanner />}
      {error && <ErrorState error={error} />}
      <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="grid gap-5 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Хичээл
            <select required aria-label="Хичээл" className={inputClass} value={form.courseId} onChange={event => change('courseId', event.target.value)}>
              <option value="">Хичээл сонгох</option>
              {options.courses.map(course => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Гарчиг
            <input required maxLength={200} className={inputClass} value={form.title} onChange={event => change('title', event.target.value)} placeholder="Жишээ: Лекц" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Гараг
            <select className={inputClass} value={form.dayOfWeek} onChange={event => change('dayOfWeek', event.target.value)}>
              {DAYS.map(day => <option key={day.value} value={day.value}>{day.label}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Семестр
            <select required aria-label="Семестр" className={inputClass} value={form.termId} onChange={event => change('termId', event.target.value)}>
              <option value="">Семестр сонгох</option>
              {options.terms.map(term => <option key={term.id} value={term.id}>{term.code} · {term.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Эхлэх цаг
            <input required type="time" className={inputClass} value={form.startTime} onChange={event => change('startTime', event.target.value)} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Дуусах цаг
            <input required type="time" className={inputClass} value={form.endTime} onChange={event => change('endTime', event.target.value)} />
          </label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Өрөө
            <select aria-label="Өрөө" className={inputClass} value={form.roomId} onChange={event => change('roomId', event.target.value)}>
              <option value="">Өрөө сонгоогүй</option>
              {options.rooms.map(room => (
                <option key={room.id} value={room.id}>{room.building?.campus?.name} · {room.building?.name} · {room.code} {room.name}</option>
              ))}
            </select>
          </label>
        </div>
        {fieldError && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{fieldError}</p>}
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn justify-center" onClick={() => navigate('/teacher/schedules')}>Болих</button>
          <button disabled={pending || !online} className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-50">
            <Save size={17} /> {pending ? 'Хадгалж байна…' : 'Хадгалах'}
          </button>
        </div>
      </form>
    </div>
  );
}
