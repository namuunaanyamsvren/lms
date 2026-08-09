import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { queryKeys } from '../services/queryKeys';
import { formatDateTime } from '../utils/formatDate';
import {
  fetchScholarshipRequests,
  createScholarshipRequest,
  cancelScholarshipRequest,
  fetchGuardianLinks,
} from '../services/api';
import { Award, Plus, X, ChevronDown, ChevronUp, Users } from 'lucide-react';

const STATUS_LABELS = { NEW: 'Шинэ', UNDER_REVIEW: 'Хянагдаж буй', REVIEWED: 'Хянагдсан', APPROVED: 'Батлагдсан', REJECTED: 'Татгалзсан', CANCELLED: 'Цуцлагдсан' };
const STATUS_TONE = {
  NEW: 'bg-amber-100 text-amber-800',
  UNDER_REVIEW: 'bg-sky-100 text-sky-800',
  REVIEWED: 'bg-sky-100 text-sky-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-rose-100 text-rose-800',
  CANCELLED: 'bg-slate-100 text-slate-600',
};
const CANCELLABLE = ['NEW', 'UNDER_REVIEW'];

function ApplyCard({ onCreated }) {
  const { showToast } = useToast();
  const form = useForm({ defaultValues: { program: '', gpa: '', statement: '' } });
  const createMutation = useMutation({ mutationFn: createScholarshipRequest });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await createMutation.mutateAsync({
        program: values.program.trim(),
        applicationData: {
          gpa: values.gpa.trim() || undefined,
          statement: values.statement.trim() || undefined,
        },
      });
      form.reset({ program: '', gpa: '', statement: '' });
      showToast('Хүсэлт илгээгдлээ.', 'success');
      onCreated();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Илгээхэд алдаа гарлаа', 'error');
    }
  });

  return (
    <Card title="Тэтгэлэгт хүсэлт гаргах">
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          {...form.register('program', { required: true })}
          placeholder="Тэтгэлгийн хөтөлбөрийн нэр"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          {...form.register('gpa')}
          placeholder="Голч дүн (GPA) — заавал биш"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <textarea
          {...form.register('statement')}
          rows={3}
          placeholder="Яагаад энэ тэтгэлэгт тэнцэх ёстойгоо бичнэ үү (заавал биш)"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-md transition disabled:opacity-50"
        >
          <Plus size={15} /><span>Хүсэлт илгээх</span>
        </button>
      </form>
    </Card>
  );
}

function RequestHistory({ history }) {
  if (!history?.length) return null;
  return (
    <div className="mt-3 space-y-1.5 border-t border-slate-200 pt-3 text-[11px] text-slate-500">
      {history.map((h) => (
        <div key={h.id} className="flex items-center justify-between">
          <span>{STATUS_LABELS[h.newStatus] || h.newStatus}{h.note ? ` — ${h.note}` : ''}</span>
          <span className="text-slate-400">{formatDateTime(h.changedAt)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Scholarships() {
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';
  const isParent = user?.role === 'PARENT';
  const { showToast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [studentId, setStudentId] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const guardiansQuery = useQuery({
    queryKey: ['guardians', 'approved'],
    queryFn: () => fetchGuardianLinks({ status: 'APPROVED' }),
    enabled: isParent,
  });
  const children = (guardiansQuery.data || []).map((link) => link.studentUser);
  const selectedChildId = studentId || children[0]?.id || '';

  const params = isParent ? { studentId: selectedChildId } : {};
  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.scholarshipRequests.list(params),
    queryFn: () => fetchScholarshipRequests(params),
    enabled: !isParent || !!selectedChildId,
  });
  const requests = data || [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.scholarshipRequests.all });
  const cancelMutation = useMutation({ mutationFn: cancelScholarshipRequest, onSuccess: invalidate });

  const cancel = async (request) => {
    const ok = await confirm({
      title: 'Хүсэлт цуцлах',
      message: `"${request.program}" тэтгэлгийн хүсэлтийг цуцлах уу?`,
      tone: 'destructive',
      confirmLabel: 'Цуцлах',
    });
    if (!ok) return;
    try {
      await cancelMutation.mutateAsync(request.id);
      showToast('Хүсэлт цуцлагдлаа.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Алдаа гарлаа', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Тэтгэлэг"
        subtitle={isStudent ? 'Тэтгэлэгт хүсэлт гаргах, төлөвийг хянах.' : isParent ? 'Хүүхдийн тэтгэлгийн хүсэлтийн явцыг харах.' : 'Тэтгэлгийн хүсэлтүүд.'}
      />

      {isStudent && <ApplyCard onCreated={invalidate} />}

      {isParent && (
        <Card>
          {guardiansQuery.isLoading ? (
            <div className="flex min-h-[10vh] items-center justify-center"><LoadingSpinner /></div>
          ) : children.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-8 text-center">
              <Users size={32} className="mx-auto text-slate-300" />
              <p className="mt-2 text-xs font-semibold text-slate-700">Холбогдсон хүүхэд алга</p>
            </div>
          ) : (
            <select value={selectedChildId} onChange={(e) => setStudentId(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              {children.map((child) => <option key={child.id} value={child.id}>{child.firstName} {child.lastName}</option>)}
            </select>
          )}
        </Card>
      )}

      <Card title={isStudent ? 'Миний хүсэлтүүд' : 'Хүсэлтийн жагсаалт'}>
        {isError && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
            {error?.response?.data?.message || error?.message || 'Мэдээлэл ачаалахад алдаа гарлаа'}
          </div>
        )}
        {isLoading ? (
          <div className="flex min-h-[20vh] items-center justify-center"><LoadingSpinner /></div>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
            <Award size={36} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">Хүсэлт алга байна</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <div key={request.id} className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">{request.program}</p>
                    {request.applicationData?.statement && (
                      <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{request.applicationData.statement}</p>
                    )}
                    <p className="mt-1 text-[10px] text-slate-400">
                      {!isStudent && request.student ? `${request.student.firstName} ${request.student.lastName} · ` : ''}
                      Хүссэн: {formatDateTime(request.requestedAt)}
                    </p>
                    {request.rejectionReason && <p className="mt-1 text-[11px] text-rose-600">Шалтгаан: {request.rejectionReason}</p>}
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_TONE[request.status] || 'bg-slate-100 text-slate-700'}`}>
                    {STATUS_LABELS[request.status] || request.status}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <button onClick={() => setExpandedId(expandedId === request.id ? null : request.id)} className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100">
                    {expandedId === request.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}Түүх
                  </button>
                  {isStudent && CANCELLABLE.includes(request.status) && (
                    <button onClick={() => cancel(request)} className="flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100">
                      <X size={13} />Цуцлах
                    </button>
                  )}
                </div>

                {expandedId === request.id && <RequestHistory history={request.history} />}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
