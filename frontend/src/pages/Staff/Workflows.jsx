import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { queryKeys } from '../../services/queryKeys';
import {
  fetchDocumentRequests,
  updateDocumentRequestStatus,
  fetchScholarshipRequests,
  updateScholarshipRequestStatus,
} from '../../services/api';
import { ClipboardList, Star, Check, X } from 'lucide-react';

const DOC_STATUS_LABELS = { PENDING: 'Хүлээгдэж буй', IN_REVIEW: 'Хянагдаж буй', APPROVED: 'Батлагдсан', REJECTED: 'Татгалзсан' };
const SCHOLARSHIP_STATUS_LABELS = { NEW: 'Шинэ', REVIEWED: 'Хянагдсан', APPROVED: 'Батлагдсан', REJECTED: 'Татгалзсан' };
const STATUS_TONE = {
  PENDING: 'bg-amber-100 text-amber-800',
  NEW: 'bg-amber-100 text-amber-800',
  IN_REVIEW: 'bg-sky-100 text-sky-800',
  REVIEWED: 'bg-sky-100 text-sky-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-rose-100 text-rose-800',
};

export default function StaffWorkflows() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('documents');

  const documentsQuery = useQuery({ queryKey: queryKeys.documentRequests.list(), queryFn: () => fetchDocumentRequests() });
  const scholarshipsQuery = useQuery({ queryKey: queryKeys.scholarshipRequests.list(), queryFn: () => fetchScholarshipRequests() });

  const docMutation = useMutation({
    mutationFn: ({ id, status }) => updateDocumentRequestStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.documentRequests.all }),
  });
  const scholarshipMutation = useMutation({
    mutationFn: ({ id, status }) => updateScholarshipRequestStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.scholarshipRequests.all }),
  });

  const respondDoc = async (id, status) => {
    try {
      await docMutation.mutateAsync({ id, status });
      showToast(status === 'APPROVED' ? 'Батлагдлаа.' : 'Татгалзлаа.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Алдаа гарлаа', 'error');
    }
  };

  const respondScholarship = async (id, status) => {
    try {
      await scholarshipMutation.mutateAsync({ id, status });
      showToast(status === 'APPROVED' ? 'Батлагдлаа.' : 'Татгалзлаа.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Алдаа гарлаа', 'error');
    }
  };

  const documents = documentsQuery.data || [];
  const scholarships = scholarshipsQuery.data || [];

  return (
    <div className="space-y-6">
      <PageHeader title="Хүсэлтийн урсгал" subtitle="Бичиг баримт, тэтгэлгийн хүсэлтийг батлах/татгалзах." />

      <Card>
        <div className="flex gap-2">
          <button onClick={() => setTab('documents')} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${tab === 'documents' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            <ClipboardList size={15} />Бичиг баримт ({documents.length})
          </button>
          <button onClick={() => setTab('scholarships')} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${tab === 'scholarships' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            <Star size={15} />Тэтгэлэг ({scholarships.length})
          </button>
        </div>
      </Card>

      {tab === 'documents' ? (
        <Card title="Бичиг баримтын хүсэлтүүд">
          {documentsQuery.isLoading ? (
            <div className="flex min-h-[30vh] items-center justify-center"><LoadingSpinner /></div>
          ) : documents.length === 0 ? (
            <p className="text-sm text-slate-500">Хүсэлт алга байна.</p>
          ) : (
            <div className="space-y-2">
              {documents.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-200/80 px-4 py-3 text-xs">
                  <div>
                    <p className="font-semibold text-slate-900">{d.title}</p>
                    <p className="text-slate-500 mt-0.5">{d.student?.firstName} {d.student?.lastName} — {d.student?.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_TONE[d.status]}`}>{DOC_STATUS_LABELS[d.status]}</span>
                    {['PENDING', 'IN_REVIEW'].includes(d.status) && (
                      <>
                        <button onClick={() => respondDoc(d.id, 'APPROVED')} className="rounded-xl border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100"><Check size={14} /></button>
                        <button onClick={() => respondDoc(d.id, 'REJECTED')} className="rounded-xl border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100"><X size={14} /></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <Card title="Тэтгэлгийн хүсэлтүүд">
          {scholarshipsQuery.isLoading ? (
            <div className="flex min-h-[30vh] items-center justify-center"><LoadingSpinner /></div>
          ) : scholarships.length === 0 ? (
            <p className="text-sm text-slate-500">Хүсэлт алга байна.</p>
          ) : (
            <div className="space-y-2">
              {scholarships.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-200/80 px-4 py-3 text-xs">
                  <div>
                    <p className="font-semibold text-slate-900">{s.program}</p>
                    <p className="text-slate-500 mt-0.5">{s.student?.firstName} {s.student?.lastName} — {s.student?.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_TONE[s.status]}`}>{SCHOLARSHIP_STATUS_LABELS[s.status]}</span>
                    {['NEW', 'REVIEWED'].includes(s.status) && (
                      <>
                        <button onClick={() => respondScholarship(s.id, 'APPROVED')} className="rounded-xl border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100"><Check size={14} /></button>
                        <button onClick={() => respondScholarship(s.id, 'REJECTED')} className="rounded-xl border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100"><X size={14} /></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
