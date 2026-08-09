import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { AttachmentChip } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { queryKeys } from '../../services/queryKeys';
import {
  fetchAssignments,
  fetchSubmissions,
  submitAssignment,
  updateSubmission,
  uploadSubmissionFile,
  addSubmissionAttachment,
  removeSubmissionAttachment,
} from '../../services/api';
import { ChevronDown, ChevronUp, FileCheck2, Clock, AlertCircle, Paperclip, X, RefreshCw } from 'lucide-react';

const formatDate = (value) => new Date(value).toLocaleDateString('mn-MN', { year: 'numeric', month: 'short', day: 'numeric' });
const formatDateTime = (value) => new Date(value).toLocaleString('mn-MN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

function attemptsFor(assignment, submissions) {
  return submissions
    .filter((s) => s.assignmentId === assignment.id)
    .sort((a, b) => b.attemptNumber - a.attemptNumber);
}

function statusFor(assignment, submissions) {
  const attempts = attemptsFor(assignment, submissions);
  const current = attempts.find((s) => s.isLatest) || null;
  if (!current) {
    const overdue = new Date(assignment.dueDate) < new Date();
    return { key: overdue ? 'OVERDUE' : 'PENDING', current: null, attempts };
  }
  if (current.status === 'DRAFT') return { key: 'DRAFT', current, attempts };
  if (current.grades?.length) return { key: 'GRADED', current, grade: current.grades[0], attempts };
  return { key: 'SUBMITTED', current, attempts };
}

const STATUS_LABELS = {
  PENDING: 'Илгээгээгүй',
  OVERDUE: 'Хугацаа хэтэрсэн',
  DRAFT: 'Ноорог',
  SUBMITTED: 'Илгээсэн',
  GRADED: 'Дүгнэгдсэн',
};
const STATUS_TONE = {
  PENDING: 'bg-slate-100 text-slate-600',
  OVERDUE: 'bg-rose-100 text-rose-800',
  DRAFT: 'bg-amber-100 text-amber-800',
  SUBMITTED: 'bg-sky-100 text-sky-800',
  GRADED: 'bg-emerald-100 text-emerald-800',
};

function DraftEditor({ draft }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const { register, handleSubmit, getValues } = useForm({
    defaultValues: { content: draft.content || '', fileUrl: draft.fileUrl || '', repoUrl: draft.repoUrl || '', commitHash: draft.commitHash || '' },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.submissions.all });

  const saveMutation = useMutation({
    mutationFn: (status) => updateSubmission(draft.id, {
      content: getValues('content') || undefined,
      fileUrl: getValues('fileUrl') || undefined,
      repoUrl: getValues('repoUrl') || undefined,
      commitHash: getValues('repoUrl') ? (getValues('commitHash') || undefined) : undefined,
      status,
    }),
    onSuccess: (_, status) => {
      invalidate();
      showToast(status === 'SUBMITTED' ? 'Даалгавар амжилттай илгээгдлээ.' : 'Ноорог хадгалагдлаа.', 'success');
    },
  });

  const onFilePick = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const uploaded = await uploadSubmissionFile(file);
        await addSubmissionAttachment(draft.id, uploaded.assetId);
      }
      invalidate();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Файл хавсаргахад алдаа гарлаа', 'error');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = async (attachment) => {
    try {
      await removeSubmissionAttachment(draft.id, attachment.id);
      invalidate();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Файл устгахад алдаа гарлаа', 'error');
    }
  };

  const onSave = handleSubmit(async () => {
    try {
      await saveMutation.mutateAsync('DRAFT');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Хадгалахад алдаа гарлаа', 'error');
    }
  });

  const onSubmitFinal = handleSubmit(async () => {
    if (!getValues('content')?.trim() && !getValues('fileUrl')?.trim() && !getValues('repoUrl')?.trim() && !draft.attachments?.length) {
      showToast('Хариулт, холбоос эсвэл файл оруулна уу.', 'error');
      return;
    }
    try {
      await saveMutation.mutateAsync('SUBMITTED');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Илгээхэд алдаа гарлаа', 'error');
    }
  });

  return (
    <div className="mt-3 space-y-3 rounded-2xl bg-slate-50 border border-slate-200 p-4 text-xs">
      <div>
        <label className="block font-semibold text-slate-700 mb-1">Хариулт</label>
        <textarea rows={4} {...register('content')} className="w-full rounded-2xl border border-slate-200 bg-white p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Даалгаврын хариултаа энд бичнэ үү..." />
      </div>
      <div>
        <label className="block font-semibold text-slate-700 mb-1">Файлын холбоос (заавал биш)</label>
        <input type="url" {...register('fileUrl')} className="w-full rounded-2xl border border-slate-200 bg-white p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="https://..." />
      </div>
      <div>
        <label className="block font-semibold text-slate-700 mb-1">GitHub repository холбоос (заавал биш)</label>
        <input type="url" {...register('repoUrl')} className="w-full rounded-2xl border border-slate-200 bg-white p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="https://github.com/..." />
      </div>
      <div>
        <label className="block font-semibold text-slate-700 mb-1">Commit hash (repo холбоос өгсөн бол, заавал биш)</label>
        <input {...register('commitHash')} className="w-full rounded-2xl border border-slate-200 bg-white p-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="a1b2c3d" />
      </div>
      <div>
        <label className="block font-semibold text-slate-700 mb-1">Хавсралт файл</label>
        <div className="flex flex-wrap items-center gap-2">
          {(draft.attachments || []).map((att) => (
            <span key={att.id} className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2.5 py-1 text-[11px] text-slate-700">
              <Paperclip size={11} /> {att.fileAsset.originalName}
              <button type="button" onClick={() => removeFile(att)} className="text-slate-400 hover:text-rose-600"><X size={12} /></button>
            </span>
          ))}
          <label className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-[11px] text-slate-500 hover:bg-slate-100 cursor-pointer">
            {uploading ? 'Байршуулж байна...' : '+ Файл нэмэх'}
            <input type="file" multiple className="hidden" onChange={onFilePick} disabled={uploading} />
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onSave} disabled={saveMutation.isPending} className="rounded-2xl bg-white border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50">
          Ноорог хадгалах
        </button>
        <button type="button" onClick={onSubmitFinal} disabled={saveMutation.isPending} className="rounded-2xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-md transition disabled:opacity-50">
          Илгээх
        </button>
      </div>
    </div>
  );
}

function StartAttemptButton({ assignment, label, primary }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => submitAssignment(assignment.id, { status: 'DRAFT' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.submissions.all }),
  });
  const start = async () => {
    try {
      await mutation.mutateAsync();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Эхлүүлэхэд алдаа гарлаа', 'error');
    }
  };
  const className = primary
    ? 'mt-3 rounded-2xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-md transition disabled:opacity-50'
    : 'mt-3 inline-flex items-center gap-1.5 rounded-2xl bg-white border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50';
  return (
    <button onClick={start} disabled={mutation.isPending} className={className}>
      {!primary && <RefreshCw size={13} />} {mutation.isPending ? 'Бэлдэж байна...' : label}
    </button>
  );
}

function AttemptHistory({ attempts }) {
  if (attempts.length <= 1) return null;
  return (
    <div className="mt-3 space-y-2">
      <p className="font-semibold text-slate-600">Өмнөх оролтууд:</p>
      {attempts.map((s) => (
        <div key={s.id} className="rounded-xl bg-white border border-slate-200 px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
          <div>
            <span className="font-semibold text-slate-700">#{s.attemptNumber}</span>{' '}
            <span className="text-slate-500">{s.status === 'DRAFT' ? 'Ноорог' : formatDateTime(s.submittedAt)}</span>
            {s.isLate && <span className="ml-2 text-rose-600">Хоцорсон ({s.daysLate} өдөр)</span>}
          </div>
          {s.grades?.[0] && <span className="font-semibold text-emerald-700">{s.grades[0].score} оноо</span>}
        </div>
      ))}
    </div>
  );
}

export default function Assignments() {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('assignmentId');
  const [expandedId, setExpandedId] = useState(highlightId);

  const assignmentsQuery = useQuery({ queryKey: queryKeys.assignments.list, queryFn: fetchAssignments });
  const submissionsQuery = useQuery({ queryKey: queryKeys.submissions.list, queryFn: fetchSubmissions });

  const isLoading = assignmentsQuery.isLoading || submissionsQuery.isLoading;
  const assignments = [...(assignmentsQuery.data || [])].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const submissions = submissionsQuery.data || [];

  useEffect(() => {
    if (!highlightId || isLoading) return;
    const el = document.getElementById(`assignment-${highlightId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightId, isLoading]);

  return (
    <div className="space-y-6">
      <PageHeader title="Даалгаврууд" subtitle="Идэвхтэй даалгавруудаа харах, хариулт илгээх." />

      <Card title="Даалгаврын жагсаалт">
        {isLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center"><LoadingSpinner /></div>
        ) : assignments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
            <FileCheck2 size={36} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">Одоогоор даалгавар алга</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment) => {
              const status = statusFor(assignment, submissions);
              const olderAttempts = status.attempts.filter((s) => s.id !== status.current?.id);
              const open = expandedId === assignment.id;
              return (
                <div key={assignment.id} id={`assignment-${assignment.id}`} className={`rounded-2xl border overflow-hidden ${highlightId === assignment.id ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200/80'}`}>
                  <button
                    onClick={() => setExpandedId(open ? null : assignment.id)}
                    className="w-full flex items-center justify-between gap-3 bg-slate-50 hover:bg-slate-100 px-4 py-3 text-left transition"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{assignment.title}</p>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock size={12} /> {formatDate(assignment.dueDate)} · {assignment.maxPoints} оноо
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_TONE[status.key]}`}>
                        {STATUS_LABELS[status.key]}
                        {status.key === 'GRADED' && `: ${status.grade.score}/${assignment.maxPoints}`}
                      </span>
                      {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                  </button>
                  {open && (
                    <div className="p-4 text-xs">
                      <p className="text-slate-600 whitespace-pre-wrap">{assignment.description}</p>

                      {status.current && status.current.status !== 'DRAFT' && (
                        <div className="mt-3 rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-emerald-800">
                          <p className="font-semibold">Илгээсэн хариулт (#{status.current.attemptNumber}):</p>
                          {status.current.content && <p className="mt-1 whitespace-pre-wrap">{status.current.content}</p>}
                          {status.current.fileUrl && <a href={status.current.fileUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block underline">Хавсралт холбоос</a>}
                          {status.current.repoUrl && <a href={status.current.repoUrl} target="_blank" rel="noreferrer" className="mt-1 ml-3 inline-block underline">GitHub repo</a>}
                          {status.current.commitHash && <span className="mt-1 ml-3 inline-block font-mono text-emerald-700">@{status.current.commitHash.slice(0, 10)}</span>}
                          {status.current.attachments?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {status.current.attachments.map((att) => <AttachmentChip key={att.id} attachment={att} />)}
                            </div>
                          )}
                          {status.current.resubmitRequested && (
                            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                              Дахин илгээх шаардлагатай{status.current.resubmitReason ? `: ${status.current.resubmitReason}` : '.'}
                            </p>
                          )}
                          {status.current.isLate && (
                            <p className="mt-2 flex items-center gap-1 text-rose-700"><AlertCircle size={13} />Хугацаа хэтэрч илгээсэн ({status.current.daysLate} өдөр).</p>
                          )}
                          {status.grade && (
                            <p className="mt-2 font-semibold">Оноо: {status.grade.score}/{assignment.maxPoints}{status.grade.feedback ? ` — ${status.grade.feedback}` : ''}</p>
                          )}
                        </div>
                      )}

                      {status.current?.status === 'DRAFT' && (
                        <DraftEditor draft={status.current} />
                      )}

                      {!status.current && (
                        <StartAttemptButton assignment={assignment} label="Хариулт бэлтгэж эхлэх" primary />
                      )}

                      {status.current && status.current.status !== 'DRAFT' && (
                        <StartAttemptButton assignment={assignment} label="Шинэ хувилбар илгээх" />
                      )}

                      <AttemptHistory attempts={olderAttempts} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
