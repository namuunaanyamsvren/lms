import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { queryKeys } from '../../services/queryKeys';
import { fetchTeacherStudents, fetchSubmissions, fetchAttendance } from '../../services/api';
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_BADGE_TONE } from '../../utils/attendanceStatus';
import { Search, User } from 'lucide-react';

const formatDate = (value) => new Date(value).toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' });

export default function StudentProgress() {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const studentsQuery = useQuery({ queryKey: queryKeys.teacherStudents.list, queryFn: fetchTeacherStudents });
  const submissionsQuery = useQuery({ queryKey: queryKeys.submissions.list, queryFn: fetchSubmissions });
  const attendanceQuery = useQuery({ queryKey: queryKeys.attendance.list(), queryFn: () => fetchAttendance() });

  const students = (studentsQuery.data || []).filter((s) =>
    `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase().includes(search.toLowerCase()));
  const selected = (studentsQuery.data || []).find((s) => s.id === selectedId) || null;

  const submissions = (submissionsQuery.data || []).filter((s) => s.studentId === selectedId);
  const attendance = (attendanceQuery.data || []).filter((a) => a.studentId === selectedId);
  const presentRate = attendance.length ? Math.round((attendance.filter((a) => a.status === 'PRESENT').length / attendance.length) * 100) : null;
  const graded = submissions.filter((s) => s.grades?.length);
  const averagePercent = graded.length
    ? Math.round((graded.reduce((sum, s) => sum + s.grades[0].score / (s.assignment?.maxPoints || 100), 0) / graded.length) * 100)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Сурагчийн ахиц" subtitle="Тодорхой сурагчийн даалгавар, дүн, ирцийн дэлгэрэнгүй." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Сурагчид">
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Хайх..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs" />
          </div>
          {studentsQuery.isLoading ? (
            <div className="flex min-h-[20vh] items-center justify-center"><LoadingSpinner /></div>
          ) : students.length === 0 ? (
            <p className="text-sm text-slate-500">Сурагч олдсонгүй.</p>
          ) : (
            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
              {students.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`w-full text-left rounded-2xl px-3 py-2 text-xs transition ${selectedId === s.id ? 'bg-indigo-50 border border-indigo-300' : 'bg-slate-50 border border-transparent hover:bg-slate-100'}`}
                >
                  <p className="font-semibold text-slate-900">{s.firstName} {s.lastName}</p>
                  <p className="text-slate-500">{s.email}</p>
                </button>
              ))}
            </div>
          )}
        </Card>

        <div className="lg:col-span-2 space-y-6">
          {!selected ? (
            <Card>
              <div className="text-center py-12">
                <User size={32} className="mx-auto text-slate-300" />
                <p className="mt-3 text-sm text-slate-500">Зүүн талаас сурагч сонгоно уу.</p>
              </div>
            </Card>
          ) : (
            <>
              <Card title={`${selected.firstName} ${selected.lastName}`} subtitle={selected.email}>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3">
                    <p className="text-slate-500">Дундаж дүн</p>
                    <p className="text-lg font-semibold text-slate-900">{averagePercent != null ? `${averagePercent}%` : '—'}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3">
                    <p className="text-slate-500">Ирцийн хувь</p>
                    <p className="text-lg font-semibold text-slate-900">{presentRate != null ? `${presentRate}%` : '—'}</p>
                  </div>
                </div>
              </Card>

              <Card title="Даалгаврын түүх">
                {submissions.length === 0 ? (
                  <p className="text-sm text-slate-500">Илгээсэн ажил алга.</p>
                ) : (
                  <div className="space-y-2">
                    {submissions.map((s) => (
                      <div key={s.id} className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-200/80 px-3 py-2 text-xs">
                        <span className="text-slate-700">{s.assignment?.title}</span>
                        <span className="font-semibold text-slate-900">{s.grades?.[0] ? `${s.grades[0].score}/${s.assignment?.maxPoints}` : 'Хүлээгдэж буй'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card title="Ирцийн түүх">
                {attendance.length === 0 ? (
                  <p className="text-sm text-slate-500">Ирцийн бүртгэл алга.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {[...attendance].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 30).map((a) => (
                      <span key={a.id} className={`text-[10px] rounded-full px-2 py-1 font-semibold ${ATTENDANCE_STATUS_BADGE_TONE[a.status] || 'bg-slate-100 text-slate-600'}`}>
                        {formatDate(a.date)}: {ATTENDANCE_STATUS_LABELS[a.status] || a.status}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
