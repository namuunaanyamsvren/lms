import { ChevronLeft, ChevronRight, Clock3, MapPin, Pencil, Trash2, UserRound } from 'lucide-react';
import {
  addCalendarDays,
  addCalendarMonths,
  calendarDayNumber,
  DAY_LABELS,
  DAYS,
  formatDate,
  formatMonth,
  monthGrid,
  occursOnDate,
  sameCalendarMonth,
  scheduleDayForDate,
  weekDates,
} from './scheduleUtils';

const modeButton = (active) => `rounded-lg px-3 py-2 text-sm font-medium ${active ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`;
const teacherName = schedule => schedule.teacher ? `${schedule.teacher.firstName} ${schedule.teacher.lastName}` : '—';
const locationName = schedule => schedule.roomRelation
  ? `${schedule.roomRelation.building?.campus?.name || ''} ${schedule.roomRelation.building?.name || ''} · ${schedule.roomRelation.name}`.trim()
  : schedule.room || 'Өрөө заагаагүй';

function ScheduleActions({ schedule, onEdit, onDelete }) {
  if (!onEdit) return null;
  return (
    <div className="flex justify-end gap-1">
      <button type="button" className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50" aria-label={`${schedule.title} засах`} onClick={() => onEdit(schedule)}>
        <Pencil size={17} />
      </button>
      <button type="button" className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label={`${schedule.title} устгах`} onClick={() => onDelete(schedule)}>
        <Trash2 size={17} />
      </button>
    </div>
  );
}

function TableView({ schedules, onEdit, onDelete }) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Гараг / цаг</th>
              <th className="px-4 py-3">Хичээл</th>
              <th className="px-4 py-3">Багш</th>
              <th className="px-4 py-3">Өрөө</th>
              <th className="px-4 py-3">Семестр</th>
              {onEdit && <th className="px-4 py-3 text-right">Үйлдэл</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {schedules.map(schedule => (
              <tr key={schedule.id} className="hover:bg-slate-50">
                <td className="px-4 py-4 font-medium text-slate-800">{DAY_LABELS[schedule.dayOfWeek]}<div className="text-xs font-normal text-slate-500">{schedule.startTime}–{schedule.endTime}</div></td>
                <td className="px-4 py-4"><div className="font-medium text-slate-900">{schedule.title}</div><div className="text-xs text-slate-500">{schedule.course?.code} {schedule.course?.title}</div></td>
                <td className="px-4 py-4 text-slate-600">{teacherName(schedule)}</td>
                <td className="px-4 py-4 text-slate-600">{locationName(schedule)}</td>
                <td className="px-4 py-4 text-slate-600">{schedule.term?.name || schedule.semester}</td>
                {onEdit && <td className="px-4 py-4"><ScheduleActions schedule={schedule} onEdit={onEdit} onDelete={onDelete} /></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:hidden">
        {schedules.map(schedule => (
          <article key={schedule.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{DAY_LABELS[schedule.dayOfWeek]} · {schedule.startTime}–{schedule.endTime}</span>
                <h2 className="mt-1 font-semibold text-slate-900">{schedule.title}</h2>
                <p className="text-sm text-slate-500">{schedule.course?.title}</p>
              </div>
              <ScheduleActions schedule={schedule} onEdit={onEdit} onDelete={onDelete} />
            </div>
            <div className="mt-3 grid gap-2 text-sm text-slate-600">
              <span className="flex items-center gap-2"><UserRound size={15} />{teacherName(schedule)}</span>
              <span className="flex items-center gap-2"><MapPin size={15} />{locationName(schedule)}</span>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function Entry({ schedule }) {
  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-2 text-xs text-indigo-950">
      <div className="font-semibold">{schedule.startTime} {schedule.title}</div>
      <div className="mt-0.5 truncate text-indigo-700">{schedule.room || schedule.roomRelation?.name || schedule.course?.title}</div>
    </div>
  );
}

function WeekView({ schedules, anchor }) {
  const dates = weekDates(anchor);
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <div className="grid min-w-[900px] grid-cols-7 divide-x divide-slate-100">
        {dates.map((date, index) => {
          const entries = schedules.filter(schedule => occursOnDate(schedule, date));
          return (
            <section key={date.toISOString()} className="min-h-80 p-3">
              <h2 className="border-b border-slate-100 pb-2 text-center text-sm font-semibold text-slate-700">
                {DAYS[index].label}<span className="ml-1 text-xs font-normal text-slate-400">{formatDate(date)}</span>
              </h2>
              <div className="mt-3 space-y-2">{entries.map(schedule => <Entry key={schedule.id} schedule={schedule} />)}</div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function MonthView({ schedules, anchor }) {
  const dates = monthGrid(anchor);
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <div className="grid min-w-[900px] grid-cols-7 border-b border-slate-200 bg-slate-50">
        {DAYS.map(day => <div key={day.value} className="p-2 text-center text-xs font-semibold uppercase text-slate-500">{day.label}</div>)}
      </div>
      <div className="grid min-w-[900px] grid-cols-7">
        {dates.map(date => {
          const entries = schedules.filter(schedule => occursOnDate(schedule, date));
          const inMonth = sameCalendarMonth(date, anchor);
          return (
            <section key={date.toISOString()} className={`min-h-28 border-b border-r border-slate-100 p-2 ${inMonth ? '' : 'bg-slate-50 opacity-60'}`}>
              <div className="mb-1 text-xs font-semibold text-slate-500">{calendarDayNumber(date)} · {DAY_LABELS[scheduleDayForDate(date)]}</div>
              <div className="space-y-1">{entries.slice(0, 3).map(schedule => <Entry key={schedule.id} schedule={schedule} />)}</div>
              {entries.length > 3 && <div className="mt-1 text-xs text-slate-500">+{entries.length - 3} хуваарь</div>}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default function ScheduleView({ schedules, mode, onModeChange, anchor, onAnchorChange, onEdit, onDelete }) {
  const move = direction => {
    onAnchorChange(mode === 'month'
      ? addCalendarMonths(anchor, direction)
      : addCalendarDays(anchor, 7 * direction));
  };
  return (
    <section className="space-y-4" aria-label="Хуваарийн харагдац">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-fit rounded-xl bg-slate-100 p-1" aria-label="Харагдац солих">
          <button className={modeButton(mode === 'table')} onClick={() => onModeChange('table')}>Хүснэгт</button>
          <button className={modeButton(mode === 'week')} onClick={() => onModeChange('week')}>7 хоног</button>
          <button className={modeButton(mode === 'month')} onClick={() => onModeChange('month')}>Сар</button>
        </div>
        {mode !== 'table' && (
          <div className="flex items-center gap-2">
            <button className="btn" aria-label="Өмнөх үе" onClick={() => move(-1)}><ChevronLeft size={17} /></button>
            <span className="min-w-36 text-center text-sm font-semibold text-slate-700">
              {mode === 'month' ? formatMonth(anchor) : `${formatDate(weekDates(anchor)[0])} – ${formatDate(weekDates(anchor)[6])}`}
            </span>
            <button className="btn" aria-label="Дараагийн үе" onClick={() => move(1)}><ChevronRight size={17} /></button>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-slate-500"><Clock3 size={15} />Asia/Ulaanbaatar (UTC+8)</div>
      </div>
      {mode === 'table' && <TableView schedules={schedules} onEdit={onEdit} onDelete={onDelete} />}
      {mode === 'week' && <WeekView schedules={schedules} anchor={anchor} />}
      {mode === 'month' && <MonthView schedules={schedules} anchor={anchor} />}
    </section>
  );
}
