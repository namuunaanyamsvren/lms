import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { queryKeys } from '../services/queryKeys';
import {
  fetchGuardianLinks,
  createGuardianLink,
  respondToGuardianLink,
  updateGuardianLink,
  revokeGuardianLink,
} from '../services/api';
import { UserPlus, Check, X, Trash2 } from 'lucide-react';

const RELATIONSHIP_LABELS = {
  FATHER: 'Эцэг',
  MOTHER: 'Эх',
  LEGAL_GUARDIAN: 'Асран хамгаалагч',
  GRANDPARENT: 'Өвөө/Эмээ',
  OTHER: 'Бусад',
};
const PERMISSION_LABELS = {
  VIEW_SCHEDULE: 'Хуваарь харах',
  VIEW_GRADES: 'Дүн харах',
  VIEW_ATTENDANCE: 'Ирц харах',
};
const STATUS_LABELS = {
  INVITED: 'Урьсан',
  PENDING: 'Хүлээгдэж буй',
  APPROVED: 'Батлагдсан',
  REJECTED: 'Татгалзсан',
  REVOKED: 'Цуцлагдсан',
};
const STATUS_TONE = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-rose-100 text-rose-800',
  REVOKED: 'bg-slate-100 text-slate-600',
  INVITED: 'bg-sky-100 text-sky-800',
};

export default function Guardians() {
  const { user } = useAuth();
  const isElevated = ['STAFF', 'ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL'].includes(user?.role);
  const { showToast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') || (isElevated ? 'PENDING' : 'ALL');

  const setStatusFilter = (value) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'ALL') next.delete('status'); else next.set('status', value);
    setSearchParams(next, { replace: true });
  };

  const params = statusFilter === 'ALL' ? {} : { status: statusFilter };
  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.guardians.list(params),
    queryFn: ({ signal }) => fetchGuardianLinks(params, signal),
  });
  const links = data || [];

  const invalidateGuardians = () => queryClient.invalidateQueries({ queryKey: queryKeys.guardians.all });

  const createMutation = useMutation({ mutationFn: createGuardianLink, onSuccess: invalidateGuardians });
  const respondMutation = useMutation({
    mutationFn: ({ id, status }) => respondToGuardianLink(id, status),
    onSuccess: invalidateGuardians,
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateGuardianLink(id, payload),
    onSuccess: invalidateGuardians,
  });
  const revokeMutation = useMutation({ mutationFn: revokeGuardianLink, onSuccess: invalidateGuardians });

  const requestForm = useForm({ defaultValues: { studentCode: '', guardianLinkCode: '' } });

  const onRequestSubmit = requestForm.handleSubmit(async ({ studentCode, guardianLinkCode }) => {
    try {
      const response = await createMutation.mutateAsync({
        studentCode: studentCode.trim(),
        guardianLinkCode: guardianLinkCode.trim() || undefined,
      });
      requestForm.reset({ studentCode: '', guardianLinkCode: '' });
      const approved = response?.data?.status === 'APPROVED';
      showToast(approved ? 'Хүүхдийн холбоос батлагдлаа.' : 'Хүсэлт илгээгдлээ. Сургуулийн зөвшөөрлийг хүлээнэ үү.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Хүсэлт илгээхэд алдаа гарлаа', 'error');
    }
  });

  const respond = async (id, status) => {
    try {
      await respondMutation.mutateAsync({ id, status });
      showToast(status === 'APPROVED' ? 'Батлагдлаа.' : 'Татгалзлаа.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Алдаа гарлаа', 'error');
    }
  };

  const togglePermission = async (link, permission) => {
    const has = link.permissions.includes(permission);
    const permissions = has ? link.permissions.filter((p) => p !== permission) : [...link.permissions, permission];
    try {
      await updateMutation.mutateAsync({ id: link.id, payload: { permissions } });
    } catch (err) {
      showToast(err?.response?.data?.message || 'Алдаа гарлаа', 'error');
    }
  };

  const revoke = async (id) => {
    const ok = await confirm({
      title: 'Холбоос цуцлах',
      message: 'Энэ асран хамгаалагчийн холбоосыг цуцлах уу?',
      tone: 'destructive',
      confirmLabel: 'Цуцлах',
    });
    if (!ok) return;
    try {
      await revokeMutation.mutateAsync(id);
      showToast('Холбоос цуцлагдлаа.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Алдаа гарлаа', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Асран хамгаалагч–сурагчийн холбоос"
        subtitle={isElevated
          ? 'Эцэг эхийн холбох хүсэлтийг батлах, эрх тохируулах.'
          : 'Хүүхэдтэйгээ холбогдох хүсэлт илгээх, батлагдсан холбоосуудаа харах.'}
      />

      {isError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          {error?.response?.data?.message || error?.message || 'Мэдээлэл ачаалахад алдаа гарлаа'}
        </div>
      )}

      {!isElevated && (
        <Card title="Хүүхэд холбох хүсэлт">
          <form onSubmit={onRequestSubmit} className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-slate-600">Сурагчийн код</span>
              <input
                {...requestForm.register('studentCode', { required: true })}
                placeholder="Жишээ: STU-2026-001"
                autoComplete="off"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-slate-600">Эцэг эх холбох код</span>
              <input
                {...requestForm.register('guardianLinkCode')}
                placeholder="Сургуулиас өгсөн код"
                autoComplete="off"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={requestForm.formState.isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-50 lg:w-auto"
              >
                <UserPlus size={15} /><span>Холбох</span>
              </button>
            </div>
          </form>
          <p className="mt-3 text-[11px] leading-5 text-slate-500">
            Холбох код зөв бол шууд батлагдана. Код байхгүй бол хүсэлт сургуулийн ажилтнаар баталгаажна.
          </p>
        </Card>
      )}

      <Card title={isElevated ? 'Холбоосын жагсаалт' : 'Миний холбоосууд'}>
        <div className="mb-4 flex items-center gap-1.5 overflow-x-auto pb-1">
          {['ALL', ...Object.keys(STATUS_LABELS)].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${statusFilter === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {s === 'ALL' ? 'Бүгд' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex min-h-[20vh] items-center justify-center"><LoadingSpinner /></div>
        ) : links.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
            Холбоос олдсонгүй.
          </div>
        ) : (
          <div className="space-y-3">
            {links.map((link) => (
              <div key={link.id} className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">
                      {link.parentUser.lastName} {link.parentUser.firstName} → {link.studentUser.lastName} {link.studentUser.firstName}
                      {link.studentUser.studentId ? ` (${link.studentUser.studentId})` : ''}
                    </p>
                    <p className="text-[10px] text-slate-400">{link.parentUser.email} · {link.studentUser.email}</p>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_TONE[link.status] || 'bg-slate-100 text-slate-700'}`}>
                    {STATUS_LABELS[link.status] || link.status}
                  </span>
                </div>

                {isElevated && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] text-slate-500">{RELATIONSHIP_LABELS[link.relationship] || link.relationship}</span>
                    {Object.keys(PERMISSION_LABELS).map((p) => (
                      <button
                        key={p}
                        onClick={() => togglePermission(link, p)}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${link.permissions.includes(p) ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}
                      >
                        {PERMISSION_LABELS[p]}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-end gap-2">
                  {isElevated && link.status === 'PENDING' && (
                    <>
                      <button onClick={() => respond(link.id, 'APPROVED')} className="flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100">
                        <Check size={13} />Батлах
                      </button>
                      <button onClick={() => respond(link.id, 'REJECTED')} className="flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100">
                        <X size={13} />Татгалзах
                      </button>
                    </>
                  )}
                  {link.status !== 'REVOKED' && (
                    <button onClick={() => revoke(link.id)} className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100">
                      <Trash2 size={13} />Цуцлах
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
