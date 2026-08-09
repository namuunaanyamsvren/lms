import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { queryKeys } from '../../services/queryKeys';
import { fetchAuditLogs } from '../../services/api';
import { Search, FileText } from 'lucide-react';

const formatDateTime = (value) => new Date(value).toLocaleString('mn-MN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function AuditLog() {
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, error } = useQuery({ queryKey: queryKeys.auditLogs.list, queryFn: fetchAuditLogs });
  const logs = (data || []).filter((log) => {
    if (!search) return true;
    const haystack = `${log.action} ${log.entity} ${log.user?.firstName || ''} ${log.user?.lastName || ''} ${log.user?.email || ''}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Аудитын лог" subtitle="Системд хийгдсэн үйлдлүүдийн бүртгэл." />

      {isError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          {error?.response?.data?.message || 'Аудитын логыг ачаалахад алдаа гарлаа'}
        </div>
      )}

      <Card title="Үйлдлийн жагсаалт">
        <div className="relative mb-4 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Үйлдэл, хэрэглэгчээр хайх..."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-4 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {isLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center"><LoadingSpinner /></div>
        ) : logs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
            <FileText size={36} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">Бүртгэл олдсонгүй</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Үйлдэл</th>
                  <th className="px-4 py-3">Обьект</th>
                  <th className="px-4 py-3">Хэрэглэгч</th>
                  <th className="px-4 py-3">Огноо</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">{log.action}</td>
                    <td className="px-4 py-3">{log.entity}{log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ''}</td>
                    <td className="px-4 py-3 text-slate-500">{log.user ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || log.user.email : 'Систем'}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(log.createdAt)}</td>
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
