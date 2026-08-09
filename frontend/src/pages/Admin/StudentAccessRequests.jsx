import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock3, Mail, Search, UserCheck, XCircle } from 'lucide-react';
import Card from '../../components/ui/Card';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { fetchStudentAccessRequests, reviewStudentAccessRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';

const statusLabels = {
  ALL: 'Бүгд',
  PENDING: 'Хүлээгдэж буй',
  APPROVED: 'Батлагдсан',
  REJECTED: 'Татгалзсан',
};

const statusTone = {
  PENDING: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-rose-50 text-rose-700',
  CANCELLED: 'bg-slate-100 text-slate-600',
};

export default function StudentAccessRequests() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('PENDING');
  const [search, setSearch] = useState('');
  const requestsQuery = useQuery({
    queryKey: ['student-access-requests', status],
    queryFn: () => fetchStudentAccessRequests({ status }),
  });
  const requests = requestsQuery.data?.items || [];
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return requests;
    return requests.filter((request) => [
      request.requesterName,
      request.requesterEmail,
      request.note,
      request.requesterUserId,
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle)));
  }, [requests, search]);

  const reviewMutation = useMutation({
    mutationFn: async ({ request, nextStatus }) => {
      return reviewStudentAccessRequest(request.id, { status: nextStatus });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['student-access-requests'] });
      showToast(variables.nextStatus === 'APPROVED' ? 'Сурагчийн эрх батлагдлаа.' : 'Хүсэлт татгалзлаа.', 'success');
    },
    onError: (error) => {
      showToast(error?.response?.data?.message || 'Хүсэлт шийдвэрлэхэд алдаа гарлаа.', 'error');
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Сурагчийн эрхийн хүсэлтүүд"
        subtitle="Энгийн хэрэглэгч сургуулиа сонгож илгээсэн хүсэлтийг эндээс батлах эсвэл татгалзана."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Хүлээгдэж буй">
          <div className="flex items-center gap-3">
            <Clock3 className="text-amber-600" size={24} />
            <p className="text-2xl font-bold text-slate-900">{requests.filter((item) => item.status === 'PENDING').length}</p>
          </div>
        </Card>
        <Card title="Батлах үйлдэл">
          <div className="flex items-center gap-3">
            <UserCheck className="text-emerald-600" size={24} />
            <p className="text-sm text-slate-600">Approve дарахад тухайн сургууль дээр сурагчийн membership үүснэ.</p>
          </div>
        </Card>
        <Card title="Мэдэгдэл">
          <div className="flex items-center gap-3">
            <Mail className="text-indigo-600" size={24} />
            <p className="text-sm text-slate-600">Шийдвэр гармагц хэрэглэгчид in-app мэдэгдэл очно.</p>
          </div>
        </Card>
      </div>

      <Card title="Хүсэлтийн жагсаалт">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setStatus(option)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  status === option ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {statusLabels[option]}
              </button>
            ))}
          </div>
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:w-72">
            <Search size={16} className="text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Нэр, имэйл, тайлбар хайх"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        {requestsQuery.isLoading ? (
          <div className="flex min-h-40 items-center justify-center"><LoadingSpinner /></div>
        ) : requestsQuery.isError ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Хүсэлтүүд ачаалахад алдаа гарлаа.</p>
        ) : filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">Илэрц олдсонгүй.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500">
                  <th className="px-3 py-3">Хэрэглэгч</th>
                  <th className="px-3 py-3">Тайлбар</th>
                  <th className="px-3 py-3">Төлөв</th>
                  <th className="px-3 py-3">Огноо</th>
                  <th className="px-3 py-3 text-right">Үйлдэл</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((request) => (
                  <tr key={request.id} className="align-top">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-900">{request.requesterName || 'Нэргүй хэрэглэгч'}</p>
                      <p className="text-xs text-slate-500">{request.requesterEmail || request.requesterUserId}</p>
                    </td>
                    <td className="max-w-md px-3 py-3 text-slate-600">{request.note || '-'}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[request.status] || statusTone.CANCELLED}`}>
                        {statusLabels[request.status] || request.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-500">{new Date(request.createdAt).toLocaleString('mn-MN')}</td>
                    <td className="px-3 py-3">
                      {request.status === 'PENDING' ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => reviewMutation.mutate({ request, nextStatus: 'APPROVED' })}
                            disabled={reviewMutation.isPending}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            <CheckCircle2 size={14} />
                            Батлах
                          </button>
                          <button
                            type="button"
                            onClick={() => reviewMutation.mutate({ request, nextStatus: 'REJECTED' })}
                            disabled={reviewMutation.isPending}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60"
                          >
                            <XCircle size={14} />
                            Татгалзах
                          </button>
                        </div>
                      ) : (
                        <p className="text-right text-xs text-slate-400">Шийдвэрлэсэн</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
