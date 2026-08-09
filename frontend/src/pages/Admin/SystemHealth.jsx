import { useQuery } from '@tanstack/react-query';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { queryKeys } from '../../services/queryKeys';
import { fetchSystemHealth } from '../../services/api';
import { CheckCircle2, XCircle, Server } from 'lucide-react';

const SERVICE_LABELS = {
  'academic-service': 'Academic Service',
  'auth-service': 'Auth Service',
  'organization-service': 'Organization Service',
  'notification-service': 'Notification Service',
};

export default function SystemHealth() {
  const { data, isLoading, isError, error, dataUpdatedAt, refetch } = useQuery({
    queryKey: queryKeys.systemHealth.all,
    queryFn: fetchSystemHealth,
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Системийн төлөв"
        subtitle="Бүх backend үйлчилгээний ажиллагааны байдал (30 секунд тутам шинэчлэгдэнэ)."
        right={
          <button onClick={() => refetch()} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50">
            Дахин шалгах
          </button>
        }
      />

      {isError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          {error?.response?.data?.message || 'Системийн төлөв шалгахад алдаа гарлаа'}
        </div>
      )}

      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center"><LoadingSpinner /></div>
      ) : (
        <>
          <div className={`rounded-3xl border p-5 flex items-center gap-3 ${data?.allOnline ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
            {data?.allOnline ? <CheckCircle2 className="text-emerald-600" size={24} /> : <XCircle className="text-rose-600" size={24} />}
            <div>
              <p className="text-sm font-bold text-slate-900">{data?.allOnline ? 'Бүх систем хэвийн ажиллаж байна' : 'Зарим үйлчилгээ хэвийн бус байна'}</p>
              <p className="text-xs text-slate-500 mt-0.5">Сүүлд шалгасан: {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('mn-MN') : '—'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(data?.services || []).map((s) => (
              <Card key={s.name}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-2xl p-3 ${s.online ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                      <Server size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{SERVICE_LABELS[s.name] || s.name}</p>
                      {typeof s.latencyMs === 'number' && <p className="text-xs text-slate-500">{s.latencyMs}ms</p>}
                    </div>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${s.online ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {s.online ? 'Онлайн' : 'Офлайн'}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
