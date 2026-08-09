import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { queryKeys } from '../../services/queryKeys';
import {
  fetchReportCatalog,
  fetchReportData,
  exportReportFile,
  createReportJob,
  fetchReportJobs,
  fetchReportJobDownload,
  createReportSchedule,
  fetchReportSchedules,
  updateReportSchedule,
  deleteReportSchedule,
  getSignedFileUrl,
  fetchCourses,
  fetchCohorts,
} from '../../services/api';
import { FileBarChart2, Download, Clock, Trash2, Play, Pause, ListChecks } from 'lucide-react';

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const JOB_STATUS_LABELS = { PENDING: 'Хүлээгдэж буй', PROCESSING: 'Боловсруулж буй', COMPLETED: 'Бэлэн', FAILED: 'Амжилтгүй' };
const JOB_STATUS_TONE = {
  PENDING: 'bg-amber-100 text-amber-800',
  PROCESSING: 'bg-sky-100 text-sky-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-rose-100 text-rose-800',
};
const FREQUENCY_LABELS = { DAILY: 'Өдөр бүр', WEEKLY: 'Долоо хоног бүр', MONTHLY: 'Сар бүр' };

function ReportPreview({ type, filters }) {
  const { user } = useAuth();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.reports.data(type, filters),
    queryFn: () => fetchReportData(type, filters),
  });

  if (isLoading) return <div className="flex min-h-[20vh] items-center justify-center"><LoadingSpinner /></div>;
  if (isError) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">{error?.response?.data?.message || error?.message || 'Мэдээлэл ачаалахад алдаа гарлаа'}</div>;
  if (!data?.rows?.length) return <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-500">Мэдээлэл алга байна.</div>;

  const cohortDrillPath = (cohortId) => {
    if (type !== 'COHORT_PERFORMANCE' || !cohortId) return null;
    if (user?.role === 'INSTRUCTOR') return `/teacher/cohorts?cohortId=${cohortId}`;
    if (['ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL', 'STAFF'].includes(user?.role)) {
      return `/admin/course-oversight?tab=cohorts&cohortId=${cohortId}`;
    }
    return null;
  };

  const previewRows = data.rows.slice(0, 50);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs text-slate-600">
        <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <tr>{data.columns.map((c) => <th key={c.key} className="whitespace-nowrap px-3 py-2">{c.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {previewRows.map((row, i) => (
            <tr key={i}>
              {data.columns.map((c) => (
                <td key={c.key} className="whitespace-nowrap px-3 py-2">
                  {c.key === 'cohort' && cohortDrillPath(row.cohortId) ? (
                    <Link to={cohortDrillPath(row.cohortId)} className="text-indigo-600 hover:underline">{row[c.key]}</Link>
                  ) : (row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.rows.length > previewRows.length && (
        <p className="mt-2 text-[11px] text-slate-400">Эхний {previewRows.length} мөрийг харуулж байна ({data.rows.length} нийт). Бүрэн мэдээллийг татаж авна уу.</p>
      )}
    </div>
  );
}

function JobsCard() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const jobsQuery = useQuery({ queryKey: queryKeys.reports.jobs, queryFn: fetchReportJobs, refetchInterval: 10_000 });
  const jobs = jobsQuery.data || [];

  const download = async (job) => {
    try {
      const info = await fetchReportJobDownload(job.id);
      const { url } = await getSignedFileUrl(info.storageKey);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Татаж авахад алдаа гарлаа', 'error');
    }
  };

  return (
    <Card title="Том тайлангийн ажлууд">
      {jobsQuery.isLoading ? (
        <div className="flex min-h-[15vh] items-center justify-center"><LoadingSpinner /></div>
      ) : jobs.length === 0 ? (
        <p className="text-xs text-slate-500">Одоогоор ажил алга байна.</p>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <div key={job.id} className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-200/80 px-4 py-2.5 text-xs">
              <div>
                <p className="font-semibold text-slate-900">{job.reportType} · {job.format}</p>
                <p className="text-slate-400 mt-0.5">{new Date(job.createdAt).toLocaleString('mn-MN')}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${JOB_STATUS_TONE[job.status] || 'bg-slate-100 text-slate-700'}`}>
                  {JOB_STATUS_LABELS[job.status] || job.status}
                </span>
                {job.status === 'COMPLETED' && (
                  <button onClick={() => download(job)} className="flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100">
                    <Download size={12} />Татах
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <button onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.reports.jobs })} className="mt-3 text-[11px] font-semibold text-indigo-600 hover:underline">
        Шинэчлэх
      </button>
    </Card>
  );
}

function SchedulesCard({ catalog }) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ reportType: catalog[0]?.type || '', format: 'CSV', frequency: 'WEEKLY' });

  const schedulesQuery = useQuery({ queryKey: queryKeys.reports.schedules, queryFn: fetchReportSchedules });
  const schedules = schedulesQuery.data || [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.reports.schedules });
  const createMutation = useMutation({ mutationFn: () => createReportSchedule(form), onSuccess: invalidate });
  const toggleMutation = useMutation({ mutationFn: ({ id, isActive }) => updateReportSchedule(id, { isActive }), onSuccess: invalidate });
  const deleteMutation = useMutation({ mutationFn: deleteReportSchedule, onSuccess: invalidate });

  const create = async () => {
    if (!form.reportType) return;
    try {
      await createMutation.mutateAsync();
      showToast('Тогтмол тайлан тохирууллаа.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Тохируулахад алдаа гарлаа', 'error');
    }
  };

  const remove = async (schedule) => {
    const ok = await confirm({ title: 'Тогтмол тайлан устгах', message: 'Энэ тохиргоог устгах уу?', tone: 'destructive', confirmLabel: 'Устгах' });
    if (!ok) return;
    try {
      await deleteMutation.mutateAsync(schedule.id);
      showToast('Устгагдлаа.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Алдаа гарлаа', 'error');
    }
  };

  return (
    <Card title="И-мэйлээр тогтмол тайлан авах">
      <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 pb-4">
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          Тайлан
          <select value={form.reportType} onChange={(e) => setForm((f) => ({ ...f, reportType: e.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs">
            {catalog.map((c) => <option key={c.type} value={c.type}>{c.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          Давтамж
          <select value={form.frequency} onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs">
            {Object.entries(FREQUENCY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          Формат
          <select value={form.format} onChange={(e) => setForm((f) => ({ ...f, format: e.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs">
            <option value="CSV">CSV</option>
            <option value="PDF">PDF</option>
          </select>
        </label>
        <button onClick={create} disabled={createMutation.isPending} className="flex items-center gap-1.5 rounded-2xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          <Clock size={13} />Тохируулах
        </button>
      </div>

      {schedulesQuery.isLoading ? (
        <div className="flex min-h-[10vh] items-center justify-center"><LoadingSpinner /></div>
      ) : schedules.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">Тогтмол тайлан алга байна.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {schedules.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-200/80 px-4 py-2.5 text-xs">
              <div>
                <p className="font-semibold text-slate-900">{catalog.find((c) => c.type === s.reportType)?.label || s.reportType}</p>
                <p className="text-slate-400 mt-0.5">{FREQUENCY_LABELS[s.frequency]} · {s.format}{s.lastRunAt ? ` · Сүүлд: ${new Date(s.lastRunAt).toLocaleDateString('mn-MN')}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleMutation.mutate({ id: s.id, isActive: !s.isActive })} className={`flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-semibold ${s.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}>
                  {s.isActive ? <Pause size={12} /> : <Play size={12} />}{s.isActive ? 'Идэвхтэй' : 'Идэвхгүй'}
                </button>
                <button onClick={() => remove(s)} className="rounded-xl border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function Reports() {
  const { showToast } = useToast();
  const [selectedType, setSelectedType] = useState('');
  const [filters, setFilters] = useState({ from: '', to: '', courseId: '', cohortId: '' });
  const [showPreview, setShowPreview] = useState(false);

  const catalogQuery = useQuery({ queryKey: queryKeys.reports.catalog, queryFn: fetchReportCatalog });
  const catalog = catalogQuery.data || [];
  const activeType = selectedType || catalog[0]?.type || '';

  const coursesQuery = useQuery({ queryKey: ['courses', 'reports'], queryFn: () => fetchCourses({ limit: 200 }) });
  const courses = coursesQuery.data?.items || [];
  const cohortsQuery = useQuery({ queryKey: queryKeys.cohorts.list, queryFn: fetchCohorts });
  const cohorts = (cohortsQuery.data || []).filter((c) => !filters.courseId || c.courseId === filters.courseId);
  const isCohortReport = activeType === 'COHORT_PERFORMANCE';

  const exportMutation = useMutation({
    mutationFn: ({ format }) => exportReportFile(activeType, filters, format),
  });
  const jobMutation = useMutation({
    mutationFn: ({ format }) => createReportJob(activeType, { format, filters }),
  });

  const exportFile = async (format) => {
    try {
      const blob = await exportMutation.mutateAsync({ format });
      downloadBlob(blob, `${activeType.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.${format}`);
    } catch (err) {
      showToast(err?.response?.data?.message || 'Татаж авахад алдаа гарлаа', 'error');
    }
  };

  const requestBackgroundJob = async (format) => {
    try {
      await jobMutation.mutateAsync({ format });
      showToast('Тайлан үүсгэж эхлэлээ. Доорх жагсаалтаас хянана уу.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Ажил үүсгэхэд алдаа гарлаа', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Тайлан" subtitle="Тайлангийн каталогоос сонгож харах, татаж авах, тогтмол авах." />

      <Card title="Тайлангийн каталог">
        {catalogQuery.isLoading ? (
          <div className="flex min-h-[15vh] items-center justify-center"><LoadingSpinner /></div>
        ) : catalog.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center">
            <FileBarChart2 size={32} className="mx-auto text-slate-300" />
            <p className="mt-2 text-xs font-semibold text-slate-700">Танд харах тайлан алга байна</p>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.map((entry) => (
              <button
                key={entry.type}
                onClick={() => { setSelectedType(entry.type); setShowPreview(false); }}
                className={`rounded-2xl border p-3.5 text-left text-xs transition ${activeType === entry.type ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <p className="font-semibold text-slate-900">{entry.label}</p>
                <p className="mt-1 text-[11px] text-slate-500">{entry.description}</p>
              </button>
            ))}
          </div>
        )}
      </Card>

      {activeType && (
        <Card title={catalog.find((c) => c.type === activeType)?.label || activeType}>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Хичээл
              <select
                value={filters.courseId}
                onChange={(e) => setFilters((f) => ({ ...f, courseId: e.target.value, cohortId: '' }))}
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs"
              >
                <option value="">Бүх хичээл</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>
            {isCohortReport && (
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Анги
                <select
                  value={filters.cohortId}
                  onChange={(e) => setFilters((f) => ({ ...f, cohortId: e.target.value }))}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs"
                >
                  <option value="">Бүх анги</option>
                  {cohorts.map((c) => <option key={c.id} value={c.id}>{c.course?.title ? `${c.course.title} — ${c.name}` : c.name}</option>)}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Эхлэх огноо
              <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value ? new Date(e.target.value).toISOString() : '' }))} className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Дуусах огноо
              <input type="date" value={filters.to ? filters.to.slice(0, 10) : ''} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value ? new Date(e.target.value).toISOString() : '' }))} className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs" />
            </label>
            <button onClick={() => setShowPreview(true)} className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <ListChecks size={13} />Харах
            </button>
            <button onClick={() => exportFile('csv')} disabled={exportMutation.isPending} className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <Download size={13} />CSV татах
            </button>
            <button onClick={() => exportFile('pdf')} disabled={exportMutation.isPending} className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <Download size={13} />PDF татах
            </button>
            <button onClick={() => requestBackgroundJob('CSV')} disabled={jobMutation.isPending} className="flex items-center gap-1.5 rounded-2xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              <Clock size={13} />Том тайлан үүсгэх
            </button>
          </div>

          {showPreview && (
            <div className="mt-4 border-t border-slate-200 pt-4">
              <ReportPreview type={activeType} filters={filters} />
            </div>
          )}
        </Card>
      )}

      <JobsCard />
      {catalog.length > 0 && <SchedulesCard catalog={catalog} />}
    </div>
  );
}
