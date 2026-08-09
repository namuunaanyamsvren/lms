import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { queryKeys } from '../../services/queryKeys';
import { fetchGuardianLinks, fetchAttendance } from '../../services/api';
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_BADGE_TONE } from '../../utils/attendanceStatus';
import CourseAttendanceBreakdown from '../../components/attendance/CourseAttendanceBreakdown';
import { CalendarCheck, CalendarX, Clock3, ShieldCheck, ChevronLeft, ChevronRight, Users } from 'lucide-react';

const formatDate = (value) => new Date(value).toLocaleDateString('mn-MN', { year: 'numeric', month: 'long', day: 'numeric' });

const DAY_ABBRS = ['Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня'];
const MONTH_NAMES_MN = ['1-р сар', '2-р сар', '3-р сар', '4-р сар', '5-р сар', '6-р сар', '7-р сар', '8-р сар', '9-р сар', '10-р сар', '11-р сар', '12-р сар'];

const DOT_TONE = {
  PRESENT: 'bg-emerald-500',
  ABSENT: 'bg-rose-500',
  LATE: 'bg-amber-500',
  EXCUSED: 'bg-sky-500',
};

function AttendanceCalendar({ records }) {
  const [cursor, setCursor] = useState(new Date());
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const byDate = Object.fromEntries(records.map((r) => [new Date(r.date).toDateString(), r.status]));
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const startingOffset = (firstDayOfMonth + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(startingOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"><ChevronLeft size={16} /></button>
        <p className="text-xs font-semibold text-slate-700">{year} {MONTH_NAMES_MN[month]}</p>
        <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1">
        {DAY_ABBRS.map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (day == null) return <div key={`empty-${index}`} />;
          const status = byDate[new Date(year, month, day).toDateString()];
          return (
            <div key={day} className="aspect-square rounded-lg border border-slate-100 flex flex-col items-center justify-center text-[10px] text-slate-600">
              <span>{day}</span>
              {status && <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${DOT_TONE[status] || 'bg-slate-300'}`} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ParentAttendanceDetail() {
  const [studentId, setStudentId] = useState('');
  const guardiansQuery = useQuery({ queryKey: ['guardians', 'approved'], queryFn: () => fetchGuardianLinks({ status: 'APPROVED' }) });
  const children = (guardiansQuery.data || [])
    .filter((link) => link.permissions?.includes('VIEW_ATTENDANCE'))
    .map((link) => link.studentUser);
  const selectedId = studentId || children[0]?.id || '';

  const attendanceQuery = useQuery({
    queryKey: queryKeys.attendance.list({ studentId: selectedId }),
    queryFn: () => fetchAttendance({ studentId: selectedId }),
    enabled: !!selectedId,
  });
  const records = [...(attendanceQuery.data || [])].sort((a, b) => new Date(b.date) - new Date(a.date));

  const total = records.length;
  const counts = records.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});
  const presentRate = total ? Math.round(((counts.PRESENT || 0) / total) * 100) : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Хүүхдийн ирц" subtitle="Хүүхдийнхээ ирцийн дэлгэрэнгүй түүхийг харах." />

      {guardiansQuery.isLoading ? (
        <div className="flex min-h-[20vh] items-center justify-center"><LoadingSpinner /></div>
      ) : children.length === 0 ? (
        <Card>
          <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
            <Users size={36} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">Холбогдсон хүүхэд алга</p>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <select value={selectedId} onChange={(e) => setStudentId(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              {children.map((child) => <option key={child.id} value={child.id}>{child.firstName} {child.lastName}</option>)}
            </select>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard title="Ирцийн хувь" value={presentRate != null ? `${presentRate}%` : '—'} icon={CalendarCheck} />
            <StatCard title="Ирсэн" value={counts.PRESENT || 0} icon={ShieldCheck} />
            <StatCard title="Тасалсан" value={counts.ABSENT || 0} icon={CalendarX} />
            <StatCard title="Хоцорсон" value={counts.LATE || 0} icon={Clock3} />
          </div>

          <Card title="Хичээл тус бүрийн ирц">
            {attendanceQuery.isLoading ? (
              <div className="flex min-h-[10vh] items-center justify-center"><LoadingSpinner /></div>
            ) : (
              <CourseAttendanceBreakdown records={records} />
            )}
          </Card>

          <Card title="Календарь">
            {attendanceQuery.isLoading ? (
              <div className="flex min-h-[20vh] items-center justify-center"><LoadingSpinner /></div>
            ) : (
              <AttendanceCalendar records={records} />
            )}
          </Card>

          <Card title="Ирцийн түүх">
            {attendanceQuery.isLoading ? (
              <div className="flex min-h-[30vh] items-center justify-center"><LoadingSpinner /></div>
            ) : records.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
                <CalendarCheck size={36} className="mx-auto text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-700">Ирцийн бүртгэл алга</p>
              </div>
            ) : (
              <div className="space-y-2">
                {records.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-200/80 px-4 py-2.5 text-xs">
                    <div>
                      <span className="text-slate-700 font-medium">{formatDate(r.date)}</span>
                      {r.note && <p className="text-slate-400 mt-0.5">{r.note}</p>}
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${ATTENDANCE_STATUS_BADGE_TONE[r.status] || 'bg-slate-100 text-slate-700'}`}>
                      {ATTENDANCE_STATUS_LABELS[r.status] || r.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
