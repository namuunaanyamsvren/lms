import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { queryKeys } from '../../services/queryKeys';
import { fetchAssignments, fetchCourses, fetchCourseById, createAssignment, updateAssignment } from '../../services/api';
import { Plus, Pencil, X, FileCheck2 } from 'lucide-react';

const toDateTimeLocal = (value) => (value ? new Date(value).toISOString().slice(0, 16) : '');
const formatDate = (value) => new Date(value).toLocaleString('mn-MN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

function AssignmentModal({ initial, onClose }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = Boolean(initial?.id);
  const [courseId, setCourseId] = useState('');
  const [modules, setModules] = useState([]);

  const coursesQuery = useQuery({ queryKey: ['courses', 'mine'], queryFn: () => fetchCourses({ limit: 100 }) });
  const courses = coursesQuery.data?.items || [];

  const form = useForm({
    defaultValues: {
      moduleId: initial?.moduleId || '',
      title: initial?.title || '',
      description: initial?.description || '',
      dueDate: toDateTimeLocal(initial?.dueDate),
      maxPoints: initial?.maxPoints ?? 100,
    },
  });

  const loadModules = async (id) => {
    setCourseId(id);
    if (!id) return setModules([]);
    const course = await fetchCourseById(id);
    setModules(course.modules || []);
  };

  const mutation = useMutation({
    mutationFn: (payload) => (isEdit ? updateAssignment(initial.id, payload) : createAssignment(payload)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all }),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const payload = { ...values, maxPoints: Number(values.maxPoints), dueDate: new Date(values.dueDate).toISOString() };
    if (isEdit) delete payload.moduleId;
    try {
      await mutation.mutateAsync(payload);
      showToast(isEdit ? 'Даалгавар шинэчлэгдлээ.' : 'Даалгавар үүслээ.', 'success');
      onClose();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Хадгалахад алдаа гарлаа', 'error');
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h3 className="text-base font-bold text-slate-900">{isEdit ? 'Даалгавар засах' : 'Даалгавар үүсгэх'}</h3>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <form onSubmit={onSubmit} className="mt-4 space-y-4 text-xs">
          {!isEdit && (
            <>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Хичээл *</label>
                <select value={courseId} onChange={(e) => loadModules(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs">
                  <option value="">Хичээл сонгох</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Бүлэг сэдэв *</label>
                <select {...form.register('moduleId', { required: true })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs">
                  <option value="">Бүлэг сэдэв сонгох</option>
                  {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </div>
            </>
          )}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Гарчиг *</label>
            <input {...form.register('title', { required: true })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs" />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Тайлбар *</label>
            <textarea rows={3} {...form.register('description', { required: true })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Дуусах хугацаа *</label>
              <input type="datetime-local" {...form.register('dueDate', { required: true })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Дээд оноо *</label>
              <input type="number" min="1" {...form.register('maxPoints', { required: true })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs" />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Цуцлах</button>
            <button type="submit" disabled={form.formState.isSubmitting} className="rounded-2xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-md transition disabled:opacity-50">Хадгалах</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TeacherAssignments() {
  const [modalTarget, setModalTarget] = useState(undefined);
  const { data, isLoading, isError, error } = useQuery({ queryKey: queryKeys.assignments.list, queryFn: fetchAssignments });
  const assignments = [...(data || [])].sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Даалгаврын менежмент"
        subtitle="Даалгавар үүсгэх, засах."
        right={
          <button onClick={() => setModalTarget(null)} className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-indigo-700 transition">
            <Plus size={16} /><span>Даалгавар үүсгэх</span>
          </button>
        }
      />

      {isError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          {error?.response?.data?.message || 'Даалгавруудыг ачаалахад алдаа гарлаа'}
        </div>
      )}

      <Card title="Даалгаврууд">
        {isLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center"><LoadingSpinner /></div>
        ) : assignments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
            <FileCheck2 size={36} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">Даалгавар алга байна</p>
          </div>
        ) : (
          <div className="space-y-2">
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-200/80 px-4 py-3 text-xs">
                <div>
                  <p className="font-semibold text-slate-900">{a.title}</p>
                  <p className="text-slate-500 mt-0.5">Хугацаа: {formatDate(a.dueDate)} · {a.maxPoints} оноо</p>
                </div>
                <button onClick={() => setModalTarget(a)} className="rounded-xl border border-slate-200 p-1.5 hover:bg-slate-100"><Pencil size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {modalTarget !== undefined && <AssignmentModal initial={modalTarget} onClose={() => setModalTarget(undefined)} />}
    </div>
  );
}
