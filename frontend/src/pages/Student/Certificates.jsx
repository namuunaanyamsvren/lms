import { useQuery } from '@tanstack/react-query';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { queryKeys } from '../../services/queryKeys';
import { fetchCertificates, downloadCertificate } from '../../services/api';
import { Award, Download } from 'lucide-react';

const formatDate = (value) => new Date(value).toLocaleDateString('mn-MN', { year: 'numeric', month: 'long', day: 'numeric' });

export default function Certificates() {
  const certificatesQuery = useQuery({ queryKey: queryKeys.certificates.list, queryFn: fetchCertificates });
  const isLoading = certificatesQuery.isLoading;
  const certificates = certificatesQuery.data || [];

  return (
    <div className="space-y-6">
      <PageHeader title="Гэрчилгээнүүд" subtitle="Амжилттай дүүргэсэн хичээлийн гэрчилгээнүүд." />

      <Card title="Миний гэрчилгээнүүд">
        {isLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center"><LoadingSpinner /></div>
        ) : certificates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
            <Award size={36} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">Гэрчилгээ одоогоор алга</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {certificates.map((cert) => (
              <div key={cert.id} className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
                <Award size={24} className="text-indigo-600" />
                <p className="mt-2 text-sm font-semibold text-slate-900">{cert.courseTitle}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Олгосон огноо: {formatDate(cert.issuedAt)}</p>
                <p className="mt-1 font-mono text-[10px] text-slate-500">{cert.verificationCode}</p>
                {cert.revokedAt && <p className="mt-2 text-xs font-semibold text-red-600">Хүчингүй болгосон</p>}
                <button
                  onClick={() => downloadCertificate(cert.id)} disabled={Boolean(cert.revokedAt)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50"
                >
                  <Download size={13} />Татах
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
