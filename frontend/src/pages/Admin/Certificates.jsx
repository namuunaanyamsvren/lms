import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import { createCertificateTemplate, fetchCertificates, fetchCertificateTemplates, previewCertificateTemplate, reissueCertificate, revokeCertificate } from '../../services/api';

const TEMPLATE_FIELDS = [
  ['name', 'Загварын нэр'],
  ['title', 'Гэрчилгээний гарчиг'],
  ['issuerName', 'Олгогч байгууллага/хүн'],
  ['signatureName', 'Гарын үсэг (нэр)'],
  ['logoUrl', 'Лого URL'],
  ['accentColor', 'Өнгө (#RRGGBB)'],
];

export default function AdminCertificates() {
  const client = useQueryClient();
  const [form, setForm] = useState({ name: '', title: 'Certificate of Completion', issuerName: '', signatureName: '', logoUrl: '', accentColor: '#4F46E5', isDefault: true });
  const certs = useQuery({ queryKey: ['certificates', 'admin'], queryFn: fetchCertificates });
  const templates = useQuery({ queryKey: ['certificate-templates'], queryFn: fetchCertificateTemplates });
  const refresh = () => client.invalidateQueries({ queryKey: ['certificates'] });
  const revoke = useMutation({ mutationFn: ({ id, reason }) => revokeCertificate(id, reason), onSuccess: refresh });
  const reissue = useMutation({ mutationFn: ({ id, reason }) => reissueCertificate(id, reason), onSuccess: refresh });
  const create = useMutation({ mutationFn: createCertificateTemplate, onSuccess: () => { templates.refetch(); setForm(v => ({ ...v, name: '' })); } });
  const preview = useMutation({
    mutationFn: () => previewCertificateTemplate({
      title: form.title || undefined,
      issuerName: form.issuerName || undefined,
      signatureName: form.signatureName || undefined,
      logoUrl: form.logoUrl || undefined,
      accentColor: form.accentColor || undefined,
    }),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Сертификатын удирдлага" subtitle="Загвар, олголт, хүчингүй болголт ба дахин олголт." />
      <Card title="Загварууд">
        <form className="grid gap-3 md:grid-cols-3" onSubmit={e => { e.preventDefault(); create.mutate(form); }}>
          {TEMPLATE_FIELDS.map(([key, label]) => (
            <input
              key={key}
              required={key === 'name' || key === 'title' || key === 'issuerName'}
              value={form[key]}
              placeholder={label}
              onChange={e => setForm({ ...form, [key]: e.target.value })}
              className="rounded-xl border p-2 text-sm"
            />
          ))}
          <div className="flex gap-2 md:col-span-3">
            <button type="button" onClick={() => preview.mutate()} disabled={preview.isPending} className="rounded-xl border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">
              {preview.isPending ? 'Бэлдэж байна...' : 'Урьдчилан харах'}
            </button>
            <button className="rounded-xl bg-indigo-700 px-4 py-2 text-sm font-semibold text-white">Загвар нэмэх</button>
          </div>
        </form>
        <p className="mt-3 text-sm text-slate-500">Нийт {templates.data?.length || 0} загвар</p>
      </Card>
      <Card title="Олгосон сертификатууд">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b"><th className="p-3">Оюутан</th><th>Хичээл</th><th>Код</th><th>Төлөв</th><th>Үйлдэл</th></tr></thead>
            <tbody>
              {(certs.data || []).map(cert => (
                <tr className="border-b" key={cert.id}>
                  <td className="p-3">{cert.student?.lastName} {cert.student?.firstName}</td>
                  <td>{cert.courseTitle}</td>
                  <td className="font-mono text-xs">{cert.verificationCode}</td>
                  <td>{cert.revokedAt ? 'Хүчингүй' : 'Хүчинтэй'}</td>
                  <td className="space-x-2">
                    {!cert.revokedAt && <button className="text-red-700" onClick={() => { const reason = prompt('Шалтгаан'); if (reason) revoke.mutate({ id: cert.id, reason }); }}>Хүчингүй болгох</button>}
                    <button className="text-indigo-700" onClick={() => reissue.mutate({ id: cert.id, reason: 'Admin reissue' })}>Дахин олгох</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
