import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';
import { queryKeys } from '../../services/queryKeys';
import { fetchSubmissions, fetchTranscript, createGradeAppeal } from '../../services/api';
import { GraduationCap, TrendingUp, FileText } from 'lucide-react';

const formatDate = (value) => new Date(value).toLocaleDateString('mn-MN', { year: 'numeric', month: 'short', day: 'numeric' });

function AppealModal({ grade, onClose }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState } = useForm({ defaultValues: { reason: '' } });

  const mutation = useMutation({
    mutationFn: (payload) => createGradeAppeal(grade.id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.gradeAppeals.list }),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({ reason: values.reason });
      showToast('Гомдол илгээгдлээ.', 'success');
      onClose();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Гомдол илгээхэд алдаа гарлаа', 'error');
    }
  });

  return (
    <Modal open title="Дүнгийн гомдол гаргах" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3 text-sm">
        <p className="text-slate-500">Оноо: {grade.score}</p>
        <div>
          <label className="block font-semibold text-slate-700 mb-1 text-xs">Шалтгаан</label>
          <textarea {...register('reason', { required: true })} rows={4} className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs" />
        </div>
        <button type="submit" disabled={formState.isSubmitting} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          Илгээх
        </button>
      </form>
    </Modal>
  );
}

export default function Gradebook() {
  const [appealGrade, setAppealGrade] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: queryKeys.submissions.list, queryFn: fetchSubmissions });
  const transcriptQuery = useQuery({ queryKey: queryKeys.transcript.detail('me'), queryFn: () => fetchTranscript('me') });
  const submissions = data || [];
  const graded = submissions
    .filter((s) => s.grades?.length)
    .map((s) => ({ ...s, grade: s.grades[0] }))
    .sort((a, b) => new Date(b.grade.gradedAt) - new Date(a.grade.gradedAt));

  const averagePercent = graded.length
    ? Math.round(
        (graded.reduce((sum, g) => sum + g.grade.score / (g.assignment?.maxPoints || 100), 0) / graded.length) * 100,
      )
    : null;

  const transcript = transcriptQuery.data || { courses: [], terms: [], cumulativeGpa: null };

  return (
    <div className="space-y-6">
      <PageHeader title="Дүнгийн тайлан" subtitle="Дүгнэгдсэн даалгавруудын оноо, курсын дүн, GPA." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Дүгнэгдсэн даалгавар" value={graded.length} icon={FileText} />
        <StatCard title="Дундаж хувь" value={averagePercent != null ? `${averagePercent}%` : '—'} icon={TrendingUp} />
        <StatCard title="Голч дүн (GPA)" value={transcript.cumulativeGpa != null ? transcript.cumulativeGpa.toFixed(2) : '—'} icon={GraduationCap} />
      </div>

      <Card title="Курс тус бүрийн дүн">
        {transcriptQuery.isLoading ? (
          <div className="flex min-h-[20vh] items-center justify-center"><LoadingSpinner /></div>
        ) : transcript.courses.length === 0 ? (
          <p className="text-xs text-slate-500">Одоогоор тооцоолсон курсын дүн алга.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Курс</th>
                  <th className="px-4 py-3">Хувь</th>
                  <th className="px-4 py-3">Үсэг</th>
                  <th className="px-4 py-3">Кредит</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {transcript.courses.map((course) => (
                  <tr key={course.courseId}>
                    <td className="px-4 py-3 font-semibold text-slate-900">{course.courseTitle} ({course.courseCode})</td>
                    <td className="px-4 py-3">{course.hasGrades ? `${course.percent}%` : '—'}</td>
                    <td className="px-4 py-3">{course.letter || '—'}</td>
                    <td className="px-4 py-3">{course.credits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Дэлгэрэнгүй дүн">
        {isLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center"><LoadingSpinner /></div>
        ) : graded.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
            <GraduationCap size={36} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">Дүгнэгдсэн даалгавар алга</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Даалгавар</th>
                  <th className="px-4 py-3">Оноо</th>
                  <th className="px-4 py-3">Санал</th>
                  <th className="px-4 py-3">Дүгнэсэн огноо</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {graded.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">{s.assignment?.title || '—'}</td>
                    <td className="px-4 py-3">{s.grade.score}/{s.assignment?.maxPoints ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{s.grade.feedback || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(s.grade.gradedAt)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setAppealGrade(s.grade)} className="text-indigo-600 font-semibold hover:underline">Гомдол гаргах</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {appealGrade && <AppealModal grade={appealGrade} onClose={() => setAppealGrade(null)} />}
    </div>
  );
}
