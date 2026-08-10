import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { queryKeys } from '../../services/queryKeys';
import {
  fetchCohorts,
  fetchCourses,
  fetchAvailableStudents,
  createCohort,
  createAnnouncement,
  enrollStudent,
  importCohortEnrollments,
  removeEnrollment,
  completeCohort,
  fetchAttendance,
  fetchAssignments,
  fetchSubmissions,
  fetchReportData,
} from '../../services/api';
import { Bell, BookOpen, CalendarDays, CheckCircle2, ClipboardCheck, FileText, GraduationCap, Plus, UserPlus, UserMinus, Users, X } from 'lucide-react';

const ATTENDANCE_LABELS = { PRESENT: 'Ирсэн', ABSENT: 'Тасалсан', LATE: 'Хоцорсон', EXCUSED: 'Чөлөөтэй' };
const IMPORT_STATUS_LABELS = {
  IMPORTED: 'Импортлогдсон',
  SKIPPED: 'Алгассан',
  ERROR: 'Алдаатай',
};
const IMPORT_STATUS_STYLES = {
  IMPORTED: 'bg-emerald-50 text-emerald-700',
  SKIPPED: 'bg-amber-50 text-amber-700',
  ERROR: 'bg-rose-50 text-rose-700',
};
const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
const downloadImportIssuesCsv = (results = []) => {
  const issueRows = results.filter(row => row.status !== 'IMPORTED');
  if (!issueRows.length) return;
  const csv = [
    ['row', 'status', 'message', 'email', 'studentId', 'userId'].map(csvCell).join(','),
    ...issueRows.map(row => [
      row.row,
      row.status,
      row.message,
      row.email || '',
      row.studentId || '',
      row.userId || '',
    ].map(csvCell).join(',')),
  ].join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `cohort-import-issues-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

function CohortAttendanceTab({ cohort }) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.attendance.list({ cohortId: cohort.id }),
    queryFn: () => fetchAttendance({ cohortId: cohort.id }),
  });
  const records = data || [];
  if (isLoading) return <div className="flex min-h-[15vh] items-center justify-center"><LoadingSpinner /></div>;
  if (!records.length) return <p className="text-sm text-slate-500">Энэ ангид ирц бүртгэгдээгүй байна.</p>;
  const counts = records.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});
  const recent = [...records].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Object.entries(ATTENDANCE_LABELS).map(([status, label]) => (
          <div key={status} className="rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-2 text-center">
            <p className="text-lg font-bold text-slate-900">{counts[status] || 0}</p>
            <p className="text-[11px] text-slate-500">{label}</p>
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        {recent.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-2 text-xs">
            <span className="text-slate-700">{new Date(r.date).toLocaleDateString('mn-MN')} — {r.student?.firstName} {r.student?.lastName}</span>
            <span className="font-semibold text-slate-600">{ATTENDANCE_LABELS[r.status] || r.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CohortAssignmentsTab({ cohort }) {
  const moduleIds = new Set((cohort.courseSnapshot?.modules || []).map((m) => m.id));
  const rosterIds = new Set((cohort.enrollments || []).map((e) => e.userId));
  const assignmentsQuery = useQuery({ queryKey: queryKeys.assignments.list, queryFn: fetchAssignments });
  const submissionsQuery = useQuery({ queryKey: queryKeys.submissions.list, queryFn: fetchSubmissions });
  if (assignmentsQuery.isLoading || submissionsQuery.isLoading) return <div className="flex min-h-[15vh] items-center justify-center"><LoadingSpinner /></div>;
  const assignments = (assignmentsQuery.data || []).filter((a) => moduleIds.has(a.moduleId));
  const submissions = submissionsQuery.data || [];
  if (!assignments.length) return <p className="text-sm text-slate-500">Энэ хичээлд даалгавар алга байна.</p>;
  return (
    <div className="space-y-2">
      {assignments.map((a) => {
        const submittedCount = submissions.filter((s) => s.assignmentId === a.id && s.isLatest && s.status === 'SUBMITTED' && rosterIds.has(s.studentId)).length;
        return (
          <div key={a.id} className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-2 text-xs">
            <div>
              <p className="font-semibold text-slate-800">{a.title}</p>
              <p className="text-slate-400 mt-0.5">Дуусах хугацаа: {new Date(a.dueDate).toLocaleDateString('mn-MN')}</p>
            </div>
            <span className="font-semibold text-slate-600">{submittedCount}/{rosterIds.size} илгээсэн</span>
          </div>
        );
      })}
    </div>
  );
}

function CohortGradesTab({ cohort }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'data', 'COHORT_PERFORMANCE', { cohortId: cohort.id }],
    queryFn: () => fetchReportData('COHORT_PERFORMANCE', { cohortId: cohort.id }),
  });
  if (isLoading) return <div className="flex min-h-[15vh] items-center justify-center"><LoadingSpinner /></div>;
  const row = data?.rows?.[0];
  if (isError || !row) return <p className="text-sm text-slate-500">Дүнгийн мэдээлэл олдсонгүй.</p>;
  const stats = [
    ['Ирцийн дундаж', row.attendancePct != null ? `${row.attendancePct}%` : '—'],
    ['Даалгаврын дүүргэлт', row.assignmentCompletionPct != null ? `${row.assignmentCompletionPct}%` : '—'],
    ['Шалгалтын дундаж', row.avgQuizScore != null ? row.avgQuizScore : '—'],
    ['Тэнцсэн хувь', row.passRatePct != null ? `${row.passRatePct}%` : '—'],
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {stats.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-2 text-center">
          <p className="text-lg font-bold text-slate-900">{value}</p>
          <p className="text-[11px] text-slate-500">{label}</p>
        </div>
      ))}
    </div>
  );
}

export default function Cohorts() {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCohortId, setSelectedCohortId] = useState(searchParams.get('cohortId'));
  const [studentToAdd, setStudentToAdd] = useState('');
  const [activeTab, setActiveTab] = useState('students');
  const [csvText, setCsvText] = useState('email,studentId\n');
  const [importResult, setImportResult] = useState(null);
  const [announcement, setAnnouncement] = useState({ title: '', body: '' });

  const cohortsQuery = useQuery({ queryKey: queryKeys.cohorts.list, queryFn: fetchCohorts });
  const coursesQuery = useQuery({ queryKey: ['courses', 'mine'], queryFn: () => fetchCourses({ limit: 100 }) });
  const availableStudentsQuery = useQuery({
    queryKey: ['students', 'available'],
    queryFn: fetchAvailableStudents,
    enabled: Boolean(selectedCohortId),
  });

  const cohorts = cohortsQuery.data || [];
  const courses = coursesQuery.data?.items || [];
  const selectedCohort = cohorts.find((c) => c.id === selectedCohortId) || null;

  useEffect(() => {
    const cohortId = searchParams.get('cohortId');
    if (cohortId) {
      queueMicrotask(() => setSelectedCohortId(cohortId));
    }
  }, [searchParams]);

  const invalidateCohorts = () => queryClient.invalidateQueries({ queryKey: queryKeys.cohorts.all });

  const createForm = useForm({ defaultValues: { courseId: '', name: '', startDate: '', endDate: '' } });
  const createMutation = useMutation({ mutationFn: createCohort, onSuccess: invalidateCohorts });
  const enrollMutation = useMutation({
    mutationFn: ({ cohortId, userId }) => enrollStudent(cohortId, userId),
    onSuccess: invalidateCohorts,
  });
  const importMutation = useMutation({ mutationFn: ({ cohortId, csv }) => importCohortEnrollments(cohortId, csv), onSuccess: invalidateCohorts });
  const announcementMutation = useMutation({ mutationFn: createAnnouncement });
  const removeMutation = useMutation({ mutationFn: removeEnrollment, onSuccess: invalidateCohorts });
  const completeMutation = useMutation({ mutationFn: completeCohort, onSuccess: invalidateCohorts });

  const onCreateSubmit = createForm.handleSubmit(async (values) => {
    try {
      await createMutation.mutateAsync({
        ...values,
        endDate: values.endDate || undefined,
      });
      setCreateOpen(false);
      createForm.reset({ courseId: '', name: '', startDate: '', endDate: '' });
      showToast('Анги амжилттай үүслээ.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Анги үүсгэхэд алдаа гарлаа', 'error');
    }
  });

  const handleAddStudent = async () => {
    if (!studentToAdd) return;
    try {
      await enrollMutation.mutateAsync({ cohortId: selectedCohortId, userId: studentToAdd });
      setStudentToAdd('');
      showToast('Сурагч ангид бүртгэгдлээ.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Бүртгэхэд алдаа гарлаа', 'error');
    }
  };

  const handleRemoveStudent = async (enrollmentId, name) => {
    const ok = await confirm({
      title: 'Бүртгэл цуцлах',
      message: `${name}-г энэ ангиас хасах уу?`,
      tone: 'destructive',
      confirmLabel: 'Хасах',
    });
    if (!ok) return;
    try {
      await removeMutation.mutateAsync(enrollmentId);
      showToast('Сурагчийг ангиас хаслаа.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Хасахад алдаа гарлаа', 'error');
    }
  };

  const handleImport = async () => {
    if (!selectedCohort) return;
    try {
      const response = await importMutation.mutateAsync({ cohortId: selectedCohort.id, csv: csvText });
      setImportResult(response.data);
      showToast(`${response.data.imported} сурагч import хийгдлээ.`, 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'CSV import хийхэд алдаа гарлаа', 'error');
    }
  };

  const handleAnnouncement = async () => {
    if (!selectedCohort || !announcement.title.trim() || !announcement.body.trim()) return;
    const targetUserIds = (selectedCohort.enrollments || []).map((e) => e.userId);
    if (targetUserIds.length === 0) {
      showToast('Энэ ангид зарлал авах сурагч алга.', 'error');
      return;
    }
    try {
      await announcementMutation.mutateAsync({
        title: announcement.title.trim(),
        body: announcement.body.trim(),
        priority: 'NORMAL',
        targetUserIds,
        targetRoles: ['STUDENT'],
      });
      setAnnouncement({ title: '', body: '' });
      showToast('Зарлал ангийн сурагчдад илгээгдлээ.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Зарлал илгээхэд алдаа гарлаа', 'error');
    }
  };

  const handleCompleteCohort = async () => {
    if (!selectedCohort) return;
    const ok = await confirm({
      title: 'Анги дуусгах',
      message: `"${selectedCohort.name}" ангийг дуусгаж, тэнцсэн сурагчдад автоматаар гэрчилгээ олгох уу?`,
      confirmLabel: 'Дуусгах',
    });
    if (!ok) return;
    try {
      const response = await completeMutation.mutateAsync(selectedCohort.id);
      const results = response.data?.results || [];
      const issued = results.filter((r) => r.outcome === 'issued').length;
      const already = results.filter((r) => r.outcome === 'already-issued').length;
      const notPassing = results.filter((r) => r.outcome === 'not-passing').length;
      showToast(`Анги дууслаа. ${issued} гэрчилгээ шинээр олгогдлоо, ${already} өмнө нь байсан, ${notPassing} тэнцээгүй.`, 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Анги дуусгахад алдаа гарлаа', 'error');
    }
  };

  const enrolledIds = new Set((selectedCohort?.enrollments || []).map((e) => e.userId));
  const availableStudents = (availableStudentsQuery.data || []).filter((s) => !enrolledIds.has(s.id));
  const importResults = importResult?.results || [];
  const importIssueCount = importResults.filter(row => row.status !== 'IMPORTED').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ангийн удирдлага"
        subtitle="Анги (cohort) үүсгэх, сурагч бүртгэх/хасах."
        right={
          <button onClick={() => setCreateOpen(true)} className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-indigo-700 transition">
            <Plus size={16} /><span>Анги үүсгэх</span>
          </button>
        }
      />

      {cohortsQuery.isError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          {cohortsQuery.error?.response?.data?.message || 'Ангиудыг ачаалахад алдаа гарлаа'}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Ангиудын жагсаалт">
          {cohortsQuery.isLoading ? (
            <div className="flex min-h-[20vh] items-center justify-center"><LoadingSpinner /></div>
          ) : cohorts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center">
              <Users size={32} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">Анги алга байна</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cohorts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCohortId(c.id)}
                  className={`w-full text-left rounded-2xl border px-4 py-3 text-xs transition ${selectedCohortId === c.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}
                >
                  <p className="font-semibold text-slate-900">{c.course?.title || 'Хичээл'} — {c.name}</p>
                  <p className="text-slate-500 mt-0.5">{(c.enrollments || []).length} сурагч</p>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card
          title={selectedCohort ? `${selectedCohort.name} — ангийн хуудас` : 'Ангийн хуудас'}
          right={selectedCohort && (
            <button
              onClick={handleCompleteCohort}
              disabled={completeMutation.isPending || selectedCohort.status === 'COMPLETED'}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              title="Ангийг дуусгаж, тэнцсэн сурагчдад гэрчилгээ автоматаар олгоно"
            >
              <CheckCircle2 size={14} />
              {selectedCohort.status === 'COMPLETED' ? 'Дууссан' : completeMutation.isPending ? 'Дуусгаж байна...' : 'Анги дуусгах'}
            </button>
          )}
        >
          {!selectedCohort ? (
            <p className="text-sm text-slate-500">Зүүн талаас анги сонгоно уу.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                {[
                  ['students', Users, 'Сурагчид'],
                  ['attendance', ClipboardCheck, 'Ирц'],
                  ['assignments', FileText, 'Даалгавар'],
                  ['grades', GraduationCap, 'Дүн'],
                  ['schedule', CalendarDays, 'Хуваарь'],
                  ['materials', BookOpen, 'Материал'],
                  ['announcements', Bell, 'Зарлал'],
                ].map(([key, Icon, label]) => (
                  <button key={key} type="button" onClick={() => setActiveTab(key)} className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 font-semibold ${activeTab === key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    <Icon size={14} />{label}
                  </button>
                ))}
              </div>

              {activeTab === 'students' && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <select value={studentToAdd} onChange={(e) => setStudentToAdd(e.target.value)} className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                      <option value="">Шинэ сурагч сонгох</option>
                      {availableStudents.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} — {s.email}</option>)}
                    </select>
                    <button onClick={handleAddStudent} disabled={!studentToAdd || enrollMutation.isPending} className="flex items-center gap-1.5 rounded-2xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                      <UserPlus size={14} />Нэмэх
                    </button>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-700"><FileText size={14} />CSV import</div>
                    <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={4} className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs" />
                    <button onClick={handleImport} disabled={importMutation.isPending} className="mt-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Import хийх</button>
                    {importResult && (
                      <div className="mt-3 space-y-3">
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-2 py-2">
                            <p className="text-base font-bold text-emerald-700">{importResult.imported}</p>
                            <p className="text-[11px] text-emerald-700">Амжилттай</p>
                          </div>
                          <div className="rounded-xl border border-amber-100 bg-amber-50 px-2 py-2">
                            <p className="text-base font-bold text-amber-700">{importResults.filter(row => row.status === 'SKIPPED').length}</p>
                            <p className="text-[11px] text-amber-700">Алгассан</p>
                          </div>
                          <div className="rounded-xl border border-rose-100 bg-rose-50 px-2 py-2">
                            <p className="text-base font-bold text-rose-700">{importResults.filter(row => row.status === 'ERROR').length}</p>
                            <p className="text-[11px] text-rose-700">Алдаа</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-slate-500">
                            {importResult.imported}/{importResult.total} мөр import хийгдсэн
                            {importResult.remainingSeats != null ? ` · үлдсэн суудал ${importResult.remainingSeats}` : ''}
                          </p>
                          {importIssueCount > 0 && (
                            <button
                              type="button"
                              onClick={() => downloadImportIssuesCsv(importResults)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              Алдаатай мөр татах
                            </button>
                          )}
                        </div>
                        {importIssueCount > 0 && (
                          <div className="max-h-52 overflow-auto rounded-xl border border-slate-200 bg-white">
                            <table className="min-w-full text-left text-xs">
                              <thead className="sticky top-0 bg-slate-100 text-[11px] uppercase text-slate-500">
                                <tr>
                                  <th className="px-3 py-2">Мөр</th>
                                  <th className="px-3 py-2">Төлөв</th>
                                  <th className="px-3 py-2">Имэйл / ID</th>
                                  <th className="px-3 py-2">Тайлбар</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {importResults.filter(row => row.status !== 'IMPORTED').map(row => (
                                  <tr key={`${row.row}-${row.status}-${row.message}`}>
                                    <td className="px-3 py-2 font-semibold text-slate-700">{row.row}</td>
                                    <td className="px-3 py-2">
                                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${IMPORT_STATUS_STYLES[row.status] || 'bg-slate-100 text-slate-600'}`}>
                                        {IMPORT_STATUS_LABELS[row.status] || row.status}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-slate-600">{row.email || row.studentId || '-'}</td>
                                    <td className="px-3 py-2 text-slate-500">{row.message}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {(selectedCohort.enrollments || []).length === 0 ? <p className="text-sm text-slate-500">Бүртгэлтэй сурагч алга.</p> : (
                    <div className="space-y-2">
                      {selectedCohort.enrollments.map((e) => (
                        <div key={e.id} className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-200/80 px-3 py-2 text-xs">
                          <span className="text-slate-700">{e.user?.firstName} {e.user?.lastName} — {e.user?.email}</span>
                          <button onClick={() => handleRemoveStudent(e.id, `${e.user?.firstName} ${e.user?.lastName}`)} className="text-rose-600 hover:text-rose-800"><UserMinus size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'attendance' && <CohortAttendanceTab cohort={selectedCohort} />}

              {activeTab === 'assignments' && <CohortAssignmentsTab cohort={selectedCohort} />}

              {activeTab === 'grades' && <CohortGradesTab cohort={selectedCohort} />}

              {activeTab === 'schedule' && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600"><pre className="whitespace-pre-wrap">{JSON.stringify(selectedCohort.scheduleJson || { startDate: selectedCohort.startDate, endDate: selectedCohort.endDate }, null, 2)}</pre></div>}

              {activeTab === 'materials' && <div className="space-y-3">{(selectedCohort.courseSnapshot?.modules || []).map((module) => <div key={module.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p className="font-semibold text-slate-900">{module.title}</p><ul className="mt-2 space-y-1 text-xs text-slate-600">{(module.lessons || []).map((lesson) => <li key={lesson.id}>• {lesson.title} <span className="text-slate-400">({lesson.unlockRule || 'SCHEDULED'})</span></li>)}</ul></div>)}{!(selectedCohort.courseSnapshot?.modules || []).length && <p className="text-sm text-slate-500">Snapshot материал алга.</p>}</div>}

              {activeTab === 'announcements' && <div className="space-y-3">
                <input value={announcement.title} onChange={(e) => setAnnouncement({ ...announcement, title: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs" placeholder="Зарлалын гарчиг" />
                <textarea value={announcement.body} onChange={(e) => setAnnouncement({ ...announcement, body: e.target.value })} rows={4} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs" placeholder="Ангийн сурагчдад илгээх зарлал" />
                <button onClick={handleAnnouncement} disabled={announcementMutation.isPending || !announcement.title.trim() || !announcement.body.trim()} className="rounded-2xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">Сурагчдад илгээх</button>
              </div>}
            </div>
          )}
        </Card>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-900">Анги үүсгэх</h3>
              <button onClick={() => setCreateOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <form onSubmit={onCreateSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Хичээл *</label>
                <select {...createForm.register('courseId', { required: true })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs">
                  <option value="">Хичээл сонгох</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ангийн нэр *</label>
                <input {...createForm.register('name', { required: true })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs" placeholder="ж: 2026 намар А" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Эхлэх огноо *</label>
                  <input type="date" {...createForm.register('startDate', { required: true })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Дуусах огноо</label>
                  <input type="date" {...createForm.register('endDate')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setCreateOpen(false)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Цуцлах</button>
                <button type="submit" disabled={createForm.formState.isSubmitting} className="rounded-2xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-md transition disabled:opacity-50">Үүсгэх</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
