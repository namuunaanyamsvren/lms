import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { queryKeys } from '../../services/queryKeys';
import {
  fetchCourses,
  fetchAssignments,
  fetchCourseGradebook,
  fetchAtRiskStudents,
  fetchGradeCategories,
  createGradeCategory,
  deleteGradeCategory,
  createManualGrade,
  fetchGradeAppeals,
  resolveGradeAppeal,
  downloadGradeImportTemplate,
  bulkImportGrades,
  exportGradesCsv,
} from '../../services/api';
import { GraduationCap, Trash2, AlertTriangle } from 'lucide-react';

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

function CategoryManager({ courseId }) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState } = useForm({ defaultValues: { name: '', weightPercent: '', source: 'MANUAL' } });
  const categoriesQuery = useQuery({ queryKey: queryKeys.gradeCategories.list(courseId), queryFn: () => fetchGradeCategories(courseId), enabled: !!courseId });
  const categories = categoriesQuery.data || [];
  const weightSum = categories.reduce((sum, c) => sum + c.weightPercent, 0);

  const invalidateComputedGrades = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.gradeCategories.list(courseId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.courseGradebook.detail(courseId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.atRiskStudents.detail(courseId) });
  };
  const createMutation = useMutation({
    mutationFn: (payload) => createGradeCategory(courseId, payload),
    onSuccess: () => { invalidateComputedGrades(); reset(); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => deleteGradeCategory(id),
    onSuccess: invalidateComputedGrades,
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createMutation.mutateAsync({ name: values.name, weightPercent: Number(values.weightPercent), source: values.source });
      showToast('Ангилал нэмэгдлээ.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Ангилал нэмэхэд алдаа гарлаа', 'error');
    }
  });

  const handleDelete = async (category) => {
    const ok = await confirm({ title: 'Ангилал устгах', message: `"${category.name}" ангиллыг устгах уу?`, tone: 'destructive', confirmLabel: 'Устгах' });
    if (ok) deleteMutation.mutate(category.id);
  };

  return (
    <Card title="Жингийн ангилал">
      {weightSum !== 0 && weightSum !== 100 && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Нийт жин {weightSum}% байна (100% байх ёстой).
        </div>
      )}
      {categoriesQuery.isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-2">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-200/80 px-4 py-2.5 text-xs">
              <span className="font-semibold text-slate-800">
                {category.name}
                {category.source === 'ATTENDANCE' && (
                  <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">Ирцээс автоматаар</span>
                )}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-slate-500">{category.weightPercent}%</span>
                <button onClick={() => handleDelete(category)} className="text-rose-500 hover:text-rose-700"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {categories.length === 0 && <p className="text-slate-500">Одоогоор ангилал алга.</p>}
        </div>
      )}
      <form onSubmit={onSubmit} className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <label className="block font-semibold text-slate-700 mb-1 text-xs">Нэр</label>
          <input {...register('name', { required: true })} className="w-40 rounded-xl border border-slate-200 bg-white p-2 text-xs" />
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1 text-xs">Жин (%)</label>
          <input type="number" min="0" max="100" {...register('weightPercent', { required: true })} className="w-24 rounded-xl border border-slate-200 bg-white p-2 text-xs" />
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1 text-xs">Эх сурвалж</label>
          <select {...register('source')} className="rounded-xl border border-slate-200 bg-white p-2 text-xs">
            <option value="MANUAL">Гар аргаар (даалгавар/шалгалт)</option>
            <option value="ATTENDANCE">Ирц (автоматаар тооцоологдоно)</option>
          </select>
        </div>
        <button type="submit" disabled={formState.isSubmitting} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          Нэмэх
        </button>
      </form>
    </Card>
  );
}

function ManualGradeForm({ courseId, categories }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState } = useForm({ defaultValues: { studentId: '', categoryId: '', score: '', feedback: '', status: 'DRAFT' } });

  const mutation = useMutation({
    mutationFn: (payload) => createManualGrade(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courseGradebook.detail(courseId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.atRiskStudents.detail(courseId) });
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({
        courseId,
        studentId: values.studentId,
        categoryId: values.categoryId || undefined,
        score: Number(values.score),
        feedback: values.feedback || undefined,
        status: values.status,
      });
      showToast('Гар аргаар дүн нэмэгдлээ.', 'success');
      reset();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Дүн нэмэхэд алдаа гарлаа', 'error');
    }
  });

  return (
    <Card title="Гар аргаар дүн нэмэх">
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2 text-xs">
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Сурагчийн ID</label>
          <input {...register('studentId', { required: true })} className="w-56 rounded-xl border border-slate-200 bg-white p-2" />
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Ангилал</label>
          <select {...register('categoryId')} className="rounded-xl border border-slate-200 bg-white p-2">
            <option value="">Ангилалгүй</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Оноо (%)</label>
          <input type="number" min="0" max="100" {...register('score', { required: true })} className="w-24 rounded-xl border border-slate-200 bg-white p-2" />
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Санал</label>
          <input {...register('feedback')} className="w-40 rounded-xl border border-slate-200 bg-white p-2" />
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Төлөв</label>
          <select {...register('status')} className="rounded-xl border border-slate-200 bg-white p-2">
            <option value="DRAFT">Ноорог</option>
            <option value="PUBLISHED">Нийтэлсэн</option>
          </select>
        </div>
        <button type="submit" disabled={formState.isSubmitting} className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          Хадгалах
        </button>
      </form>
    </Card>
  );
}

function AtRiskStudents({ courseId }) {
  const query = useQuery({
    queryKey: queryKeys.atRiskStudents.detail(courseId),
    queryFn: () => fetchAtRiskStudents(courseId),
    enabled: !!courseId,
  });
  const students = query.data || [];

  return (
    <Card title={`Эрсдэлтэй сурагчид (${students.length})`}>
      {query.isLoading ? (
        <LoadingSpinner />
      ) : students.length === 0 ? (
        <p className="text-xs text-slate-500">Одоогоор эрсдэлтэй сурагч илрээгүй байна.</p>
      ) : (
        <div className="space-y-2">
          {students.map((row) => (
            <div key={row.student.id} className="rounded-2xl bg-rose-50 border border-rose-200/80 px-4 py-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-rose-600" />
                  {row.student.firstName} {row.student.lastName}
                </span>
                <span className="text-slate-500">{row.percent != null ? `${row.percent}%` : '—'}{row.letter ? ` (${row.letter})` : ''}</span>
              </div>
              <ul className="mt-1.5 space-y-0.5 text-rose-700">
                {row.reasons.map((reason) => <li key={reason}>· {reason}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function AppealsInbox() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const appealsQuery = useQuery({ queryKey: queryKeys.gradeAppeals.list, queryFn: fetchGradeAppeals });
  const appeals = (appealsQuery.data || []).filter((a) => a.status === 'PENDING');

  const resolveMutation = useMutation({
    mutationFn: ({ id, status }) => resolveGradeAppeal(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.gradeAppeals.list }),
  });

  const handleResolve = async (id, status) => {
    try {
      await resolveMutation.mutateAsync({ id, status });
      showToast(status === 'APPROVED' ? 'Гомдол зөвшөөрөгдлөө.' : 'Гомдол татгалзагдлаа.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Гомдол шийдвэрлэхэд алдаа гарлаа', 'error');
    }
  };

  return (
    <Card title={`Дүнгийн гомдол (${appeals.length})`}>
      {appealsQuery.isLoading ? (
        <LoadingSpinner />
      ) : appeals.length === 0 ? (
        <p className="text-xs text-slate-500">Шийдвэрлэх гомдол алга.</p>
      ) : (
        <div className="space-y-2">
          {appeals.map((appeal) => (
            <div key={appeal.id} className="rounded-2xl bg-slate-50 border border-slate-200/80 px-4 py-3 text-xs">
              <p className="text-slate-700">{appeal.reason}</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => handleResolve(appeal.id, 'APPROVED')} className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700">Зөвшөөрөх</button>
                <button onClick={() => handleResolve(appeal.id, 'REJECTED')} className="rounded-lg bg-rose-100 px-3 py-1.5 font-semibold text-rose-700 hover:bg-rose-200">Татгалзах</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function TeacherGradebook() {
  const { showToast } = useToast();
  const [courseId, setCourseId] = useState('');
  const [assignmentId, setAssignmentId] = useState('');
  const [importSummary, setImportSummary] = useState(null);

  const coursesQuery = useQuery({ queryKey: ['courses', 'mine'], queryFn: () => fetchCourses({ limit: 100 }) });
  const courses = coursesQuery.data?.items || [];
  const assignmentsQuery = useQuery({ queryKey: queryKeys.assignments.list, queryFn: fetchAssignments });
  const assignments = assignmentsQuery.data || [];

  const gradebookQuery = useQuery({
    queryKey: queryKeys.courseGradebook.detail(courseId),
    queryFn: () => fetchCourseGradebook(courseId),
    enabled: !!courseId,
  });
  const gradebook = gradebookQuery.data || { categories: [], students: [] };

  const handleDownloadTemplate = () => downloadBlob(downloadGradeImportTemplate(), 'grade-import-template.csv');

  const handleExport = () => {
    if (!assignmentId) return;
    downloadBlob(exportGradesCsv(assignmentId), `grades-${assignmentId}.csv`);
  };

  const handleImportFile = async (file) => {
    if (!file || !assignmentId) return;
    const text = await file.text();
    try {
      const res = await bulkImportGrades(assignmentId, text);
      setImportSummary(res.data);
    } catch (err) {
      showToast(err?.response?.data?.message || 'CSV импортлоход алдаа гарлаа', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Дүнгийн журнал" subtitle="Ангилал, жин, дүн нийтлэх, гомдол шийдвэрлэх." />

      <Card>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <option value="">Хичээл сонгох</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
      </Card>

      {courseId && <CategoryManager courseId={courseId} />}
      {courseId && <ManualGradeForm courseId={courseId} categories={gradebook.categories} />}

      {courseId && (
        <Card title="Ерөнхий дүнгийн жагсаалт">
          {gradebookQuery.isLoading ? (
            <div className="flex min-h-[30vh] items-center justify-center"><LoadingSpinner /></div>
          ) : gradebook.students.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
              <GraduationCap size={36} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">Бүртгэлтэй сурагч алга</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Сурагч</th>
                    <th className="px-4 py-3">Хувь</th>
                    <th className="px-4 py-3">Үсэг</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {gradebook.students.map((row) => (
                    <tr key={row.student.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900">{row.student.firstName} {row.student.lastName}</td>
                      <td className="px-4 py-3">{row.hasGrades ? `${row.percent}%` : '—'}</td>
                      <td className="px-4 py-3">{row.letter || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {courseId && <AtRiskStudents courseId={courseId} />}

      <Card title="Bulk импорт/экспорт (даалгавраар)">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <select value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <option value="">Даалгавар сонгох</option>
            {assignments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
          <button onClick={handleDownloadTemplate} className="rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50">Загвар татах</button>
          <button onClick={handleExport} disabled={!assignmentId} className="rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Экспорт</button>
          <label className={`rounded-xl border border-dashed border-slate-300 px-3 py-2 font-semibold text-slate-700 ${assignmentId ? 'cursor-pointer hover:bg-slate-50' : 'opacity-50'}`}>
            CSV импорт
            <input type="file" accept=".csv,text/csv" disabled={!assignmentId} onChange={(e) => handleImportFile(e.target.files?.[0])} className="hidden" />
          </label>
        </div>
        {importSummary && (
          <div className="mt-3 space-y-1 text-xs">
            {importSummary.map((row) => (
              <p key={row.rowNumber} className={row.status === 'error' ? 'text-rose-600' : 'text-emerald-700'}>
                Мөр {row.rowNumber}: {row.status === 'error' ? row.message : row.status === 'created' ? 'үүслээ' : 'шинэчлэгдлээ'}
              </p>
            ))}
          </div>
        )}
      </Card>

      <AppealsInbox />
    </div>
  );
}
