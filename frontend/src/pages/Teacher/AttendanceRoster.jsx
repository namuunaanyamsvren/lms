import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { queryKeys } from '../../services/queryKeys';
import { fetchCohorts, fetchAttendance, batchRecordAttendance, exportAttendanceCsv } from '../../services/api';
import { ATTENDANCE_STATUS_OPTIONS, ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_TONE } from '../../utils/attendanceStatus';
import { CalendarCheck } from 'lucide-react';

// Builds YYYY-MM-DD from local date parts, not toISOString() (which is UTC and
// reports "yesterday" during early-morning hours in timezones ahead of UTC,
// e.g. Asia/Ulaanbaatar UTC+8) — must stay consistent with sameDay's local toDateString().
const todayISO = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

const downloadBlob = async (blobPromise, filename) => {
  const blob = await blobPromise;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default function AttendanceRoster() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [cohortId, setCohortId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [draft, setDraft] = useState({});
  const [notes, setNotes] = useState({});
  const [saving, setSaving] = useState(false);

  const cohortsQuery = useQuery({ queryKey: queryKeys.cohorts.list, queryFn: fetchCohorts });
  const attendanceQuery = useQuery({
    queryKey: queryKeys.attendance.list({ cohortId }),
    queryFn: () => fetchAttendance({ cohortId }),
    enabled: !!cohortId,
  });

  const cohorts = cohortsQuery.data || [];
  const cohort = cohorts.find((c) => c.id === cohortId) || null;
  const existingForDate = (attendanceQuery.data || []).filter((r) => sameDay(r.date, date));
  const existingByStudent = Object.fromEntries(existingForDate.map((r) => [r.studentId, r]));

  const statusFor = (studentId) => draft[studentId] || existingByStudent[studentId]?.status || 'PRESENT';
  const noteFor = (studentId) => notes[studentId] ?? existingByStudent[studentId]?.note ?? '';

  const saveAll = async () => {
    if (!cohort) return;
    setSaving(true);
    try {
      const records = cohort.enrollments.map((e) => ({
        studentId: e.userId,
        status: statusFor(e.userId),
        ...(noteFor(e.userId) ? { note: noteFor(e.userId) } : {}),
      }));
      await batchRecordAttendance({ cohortId, date, records });
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
      setDraft({});
      setNotes({});
      showToast('Ирц амжилттай хадгалагдлаа.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Хадгалахад алдаа гарлаа', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    if (!cohortId) return;
    downloadBlob(exportAttendanceCsv({ cohortId }), `attendance-${cohortId}-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Бүлгээр ирц бүртгэх" subtitle="Анги, огноо сонгоод бүх сурагчийн ирцийг нэг дор бүртгэнэ." />

      <Card>
        <div className="grid gap-3 sm:grid-cols-3 max-w-2xl">
          <div>
            <label className="block font-semibold text-slate-700 mb-1 text-xs">Анги</label>
            <select value={cohortId} onChange={(e) => { setCohortId(e.target.value); setDraft({}); setNotes({}); }} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs">
              <option value="">Анги сонгох</option>
              {cohorts.map((c) => <option key={c.id} value={c.id}>{c.course?.title || 'Хичээл'} — {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1 text-xs">Огноо</label>
            <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setDraft({}); setNotes({}); }} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs" />
          </div>
          <div className="flex items-end">
            <button onClick={handleExport} disabled={!cohortId} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              CSV экспорт
            </button>
          </div>
        </div>
      </Card>

      <Card title={cohort ? `${cohort.name} — ирцийн бүртгэл` : 'Сурагчид'}>
        {cohortsQuery.isLoading || attendanceQuery.isLoading ? (
          <div className="flex min-h-[20vh] items-center justify-center"><LoadingSpinner /></div>
        ) : !cohort ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center">
            <CalendarCheck size={32} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">Эхлээд анги сонгоно уу</p>
          </div>
        ) : cohort.enrollments.length === 0 ? (
          <p className="text-sm text-slate-500">Энэ ангид бүртгэлтэй сурагч алга.</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              {cohort.enrollments.map((e) => (
                <div key={e.userId} className="rounded-2xl bg-slate-50 border border-slate-200/80 px-4 py-2.5 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-700 font-medium">{e.user?.firstName} {e.user?.lastName}</span>
                    <div className="flex gap-1.5">
                      {ATTENDANCE_STATUS_OPTIONS.map((status) => (
                        <button
                          key={status}
                          onClick={() => setDraft((d) => ({ ...d, [e.userId]: status }))}
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition ${statusFor(e.userId) === status ? ATTENDANCE_STATUS_TONE[status] : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        >
                          {ATTENDANCE_STATUS_LABELS[status]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Тэмдэглэл (шаардлагатай бол)"
                    value={noteFor(e.userId)}
                    onChange={(ev) => setNotes((n) => ({ ...n, [e.userId]: ev.target.value }))}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button onClick={saveAll} disabled={saving} className="rounded-2xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-md transition disabled:opacity-50">
                {saving ? 'Хадгалж байна...' : 'Ирц хадгалах'}
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
