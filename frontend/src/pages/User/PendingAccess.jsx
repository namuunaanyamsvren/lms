import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Building2, Clock3, Mail, Search, Send, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/ui/Card';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { fetchMyMemberships, fetchMyStudentAccessRequests, fetchPublicOrganizations, requestStudentAccess } from '../../services/api';
import { useToast } from '../../context/ToastContext';

export default function PendingAccess() {
  const { user, refreshUser, getRoleRedirectPath, switchOrganization } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [sentOrgIds, setSentOrgIds] = useState(() => new Set());
  const displayName = user ? `${user.lastName || ''} ${user.firstName || ''}`.trim() || user.email : 'Хэрэглэгч';
  const organizationsQuery = useQuery({
    queryKey: ['public-organizations', search],
    queryFn: () => fetchPublicOrganizations({ search }),
  });
  const requestsQuery = useQuery({
    queryKey: ['student-access-requests', 'me'],
    queryFn: fetchMyStudentAccessRequests,
  });
  const membershipsQuery = useQuery({
    queryKey: ['memberships', 'me'],
    queryFn: fetchMyMemberships,
  });
  const requestsByOrg = new Map((requestsQuery.data || []).map((request) => [request.organizationId, request]));
  const latestRequest = [...(requestsQuery.data || [])].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))[0];
  const requestMutation = useMutation({
    mutationFn: (organization) => requestStudentAccess({
      organizationId: organization.id,
      note: `${displayName} сурагчаар бүртгүүлэх хүсэлт илгээв.`,
    }),
    onSuccess: (_, organization) => {
      setSentOrgIds((current) => new Set([...current, organization.id]));
      requestsQuery.refetch();
      showToast(`${organization.name} сургуулийн менежерт хүсэлт илгээгдлээ.`, 'success');
    },
    onError: (error) => {
      showToast(error?.response?.data?.message || 'Хүсэлт илгээхэд алдаа гарлаа.', 'error');
    },
  });
  const approvedMemberships = (membershipsQuery.data || []).filter(membership => membership.role === 'STUDENT');
  const hasApprovedRequest = (requestsQuery.data || []).some((request) => request.status === 'APPROVED') || approvedMemberships.length > 0;
  const refreshAccessMutation = useMutation({
    mutationFn: async () => {
      const targetMembership = approvedMemberships[0];
      if (targetMembership) return switchOrganization(targetMembership.organizationId);
      const nextUser = await refreshUser();
      return { success: true, user: nextUser, redirectPath: getRoleRedirectPath(nextUser?.role) };
    },
    onSuccess: (result) => {
      if (!result?.success) {
        showToast(result?.message || 'Эрх шинэчлэхэд алдаа гарлаа. Дахин нэвтэрч орно уу.', 'error');
        return;
      }
      const path = result.redirectPath || getRoleRedirectPath(result.user?.role);
      showToast('Эрх шинэчлэгдлээ.', 'success');
      navigate(path, { replace: true });
    },
    onError: () => {
      showToast('Эрх шинэчлэхэд алдаа гарлаа. Дахин нэвтэрч орно уу.', 'error');
    },
  });
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Тавтай морил, ${displayName}`}
        subtitle="Таны бүртгэл идэвхтэй байна. Сонгосон сургуулийн менежер баталгаажуулсны дараа сургалтын хэсэг нээгдэнэ."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Бүртгэлийн төлөв">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
              <Clock3 size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Эрх хүлээгдэж байна</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Нээлттэй бүртгэлээр сурагч dashboard автоматаар нээгдэхгүй.
              </p>
            </div>
          </div>
        </Card>

        <Card title="Дараагийн алхам">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-700">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Баталгаажуулалт</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Сонгосон сургуулийн менежер батлахад тухайн сургууль дээр сурагчийн membership үүснэ.
              </p>
            </div>
          </div>
        </Card>

        <Card title="Холбоо барих">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <Mail size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Менежерт мэдэгдэх</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Доороос сургуулиа сонгоод хүсэлт илгээхэд тухайн сургуулийн менежерт мэдэгдэл очно.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Миний бүртгэл">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
            <UserRound size={19} />
          </span>
          <div>
            <p className="font-semibold text-slate-900">{displayName}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
          <span className="ml-auto rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Энгийн хэрэглэгч
          </span>
          {hasApprovedRequest && (
            <button
              type="button"
              onClick={() => refreshAccessMutation.mutate()}
              disabled={refreshAccessMutation.isPending}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {refreshAccessMutation.isPending ? 'Шинэчилж байна...' : 'Сурагчийн хэсэг рүү орох'}
            </button>
          )}
        </div>
        {approvedMemberships.length > 0 && (
          <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {approvedMemberships.length} сургуулийн сурагчийн membership баталгаажсан байна.
          </div>
        )}
      </Card>

      <Card title="Хүсэлтийн явц">
        {requestsQuery.isLoading ? (
          <div className="flex min-h-20 items-center justify-center"><LoadingSpinner /></div>
        ) : latestRequest ? (
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { label: 'Хүсэлт илгээсэн', active: true, detail: new Date(latestRequest.createdAt).toLocaleDateString('mn-MN') },
              { label: 'Менежер шалгаж байна', active: latestRequest.status === 'PENDING', detail: latestRequest.status === 'PENDING' ? 'Хүлээгдэж байна' : 'Дууссан' },
              {
                label: latestRequest.status === 'REJECTED' ? 'Татгалзсан' : 'Баталгаажсан',
                active: latestRequest.status !== 'PENDING',
                detail: latestRequest.reviewedAt ? new Date(latestRequest.reviewedAt).toLocaleDateString('mn-MN') : 'Шийдвэр гараагүй',
              },
            ].map((step, index) => (
              <div key={step.label} className={`rounded-2xl border p-4 ${step.active ? 'border-indigo-200 bg-indigo-50/60' : 'border-slate-200 bg-white'}`}>
                <div className={`mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${step.active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {index + 1}
                </div>
                <p className="text-sm font-semibold text-slate-900">{step.label}</p>
                <p className="mt-1 text-xs text-slate-500">{step.detail}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
            Доороос сургуулиа сонгож эхний хүсэлтээ илгээнэ үү.
          </p>
        )}
      </Card>

      <Card title="Сургууль сонгож хүсэлт илгээх">
        <p className="mb-3 text-xs text-slate-500">
          Хүсэлт зөвхөн таны сонгосон сургуулийн менежерүүдэд очно.
        </p>
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
          <Search size={16} className="text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full bg-transparent text-sm text-slate-700 outline-none"
            placeholder="Сургуулийн нэр, slug эсвэл domain хайх"
          />
        </div>

        {organizationsQuery.isLoading ? (
          <div className="flex min-h-32 items-center justify-center"><LoadingSpinner /></div>
        ) : organizationsQuery.isError ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Сургуулийн жагсаалт ачаалахад алдаа гарлаа.
          </p>
        ) : (organizationsQuery.data || []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            Илэрц олдсонгүй.
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {(organizationsQuery.data || []).map((organization) => {
              const request = requestsByOrg.get(organization.id);
              const sent = sentOrgIds.has(organization.id) || request?.status === 'PENDING';
              const approved = request?.status === 'APPROVED';
              const rejected = request?.status === 'REJECTED';
              return (
                <article key={organization.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
                    <Building2 size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{organization.name}</p>
                    <p className="truncate text-xs text-slate-500">{organization.slug}{organization.domain ? ` · ${organization.domain}` : ''}</p>
                  </div>
                  {request && (
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      approved ? 'bg-emerald-50 text-emerald-700' : rejected ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {approved ? 'Батлагдсан' : rejected ? 'Татгалзсан' : 'Хүлээгдэж байна'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => requestMutation.mutate(organization)}
                    disabled={sent || approved || requestMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    <Send size={13} />
                    {approved ? 'Батлагдсан' : sent ? 'Илгээгдсэн' : 'Хүсэлт'}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
