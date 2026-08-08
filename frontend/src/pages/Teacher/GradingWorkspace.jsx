import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { queryKeys } from '../../services/queryKeys';
import { fetchSubmissions, createGrade } from '../../services/api';
import { AttachmentChip } from '../../components/ui';
import { CheckCircle2 } from 'lucide-react';

const formatDate = (value) => new Date(value).toLocaleString('mn-MN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

function GradeRow({ submission, onGraded }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState } = useForm({
    defaultValues: { score: '', feedback: '', requestResubmit: false, resubmitReason: '' },
  });

  const mutation = useMutation({
    mutationFn: (payload) => createGrade(submission.id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.submissions.all }),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({
        score: Number(values.score),
        ...(values.feedback ? { feedback: values.feedback } : {}),
        requestResubmit: Boolean(values.requestResubmit),
        ...(values.resubmitReason ? { resubmitReason: values.resubmitReason } : {}),
      });
      showToast('Дүн амжилттай нийтлэгдлээ.', 'success');
      onGraded?.();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Дүгнэхэд алдаа гарлаа', 'error');
    }
  });

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-slate-900">{submission.student?.firstName} {submission.student?.lastName}</p>
          <p className="text-slate-500 mt-0.5">{submission.assignment?.title} · Илгээсэн: {formatDate(submission.submittedAt)}</p>
        </div>
        <span className="text-slate-400">Дээд оноо: {submission.assignment?.maxPoints}</span>
      </div>
      {submission.content && <p className="mt-2 text-slate-600 whitespace-pre-wrap">{submission.content}</p>}
      {submission.fileUrl && <a href={submission.fileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-indigo-600 underline">Хавсралт холбоос</a>}
      {submission.repoUrl && <a href={submission.repoUrl} target="_blank" rel="noreferrer" className="mt-2 ml-3 inline-block text-indigo-600 underline">GitHub repo</a>}
      {submission.commitHash && <span className="mt-2 ml-3 inline-block font-mono text-slate-500">@{submission.commitHash.slice(0, 10)}</span>}
      {submission.attachments?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {submission.attachments.map((att) => <AttachmentChip key={att.id} attachment={att} />)}
        </div>
      )}
      {submission.attemptNumber > 1 && (
        <p className="mt-2 text-slate-400">Хувилбар #{submission.attemptNumber}{submission.isLate ? ` · Хоцорсон (${submission.daysLate} өдөр)` : ''}</p>
      )}
      <form onSubmit={onSubmit} className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Оноо</label>
          <input type="number" min="0" step="0.01" {...register('score', { required: true })} className="w-24 rounded-xl border border-slate-200 bg-white p-2 text-xs" />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block font-semibold text-slate-700 mb-1">Санал</label>
          <input {...register('feedback')} className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs" />
        </div>
        <label className="flex min-h-[34px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
          <input type="checkbox" {...register('requestResubmit')} className="h-3.5 w-3.5 rounded border-slate-300" />
          Дахин илгээх
        </label>
        <div className="min-w-[180px] flex-1">
          <label className="block font-semibold text-slate-700 mb-1">Дахин илгээх тайлбар</label>
          <input {...register('resubmitReason')} className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs" />
        </div>
        <button type="submit" disabled={formState.isSubmitting} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          Дүгнэх
        </button>
      </form>
    </div>
  );
}

export default function GradingWorkspace() {
  const [showGraded, setShowGraded] = useState(false);
  const { data, isLoading, isError, error } = useQuery({ queryKey: queryKeys.submissions.list, queryFn: fetchSubmissions });
  const submissions = data || [];
  const pending = submissions.filter((s) => !s.grades?.length).sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
  const graded = submissions.filter((s) => s.grades?.length);

  return (
    <div className="space-y-6">
      <PageHeader title="Дүгнэх ажлын талбар" subtitle="Илгээсэн ажлуудыг дүгнэх." />

      {isError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          {error?.response?.data?.message || 'Илгээсэн ажлуудыг ачаалахад алдаа гарлаа'}
        </div>
      )}

      <Card title={`Дүгнэх ёстой (${pending.length})`}>
        {isLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center"><LoadingSpinner /></div>
        ) : pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
            <CheckCircle2 size={36} className="mx-auto text-emerald-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">Бүгд дүгнэгдсэн байна</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((s) => <GradeRow key={s.id} submission={s} />)}
          </div>
        )}
      </Card>

      <Card
        title={`Дүгнэгдсэн (${graded.length})`}
        right={<button onClick={() => setShowGraded((v) => !v)} className="text-xs font-semibold text-indigo-600">{showGraded ? 'Нуух' : 'Харах'}</button>}
      >
        {!showGraded ? (
          <p className="text-sm text-slate-500">Дүгнэгдсэн ажлуудыг харахын тулд "Харах" дарна уу.</p>
        ) : graded.length === 0 ? (
          <p className="text-sm text-slate-500">Одоогоор дүгнэгдсэн ажил алга.</p>
        ) : (
          <div className="space-y-2">
            {graded.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-200/80 px-4 py-2.5 text-xs">
                <span className="text-slate-700">{s.student?.firstName} {s.student?.lastName} — {s.assignment?.title}</span>
                <span className="font-semibold text-emerald-700">{s.grades[0].score}/{s.assignment?.maxPoints}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
