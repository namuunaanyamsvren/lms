import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Award, CheckCircle2, XCircle } from 'lucide-react';
import { verifyCertificate } from '../services/api';

export default function CertificateVerify() {
  const params = useParams(); const [code, setCode] = useState(params.code || '');
  const query = useQuery({ queryKey: ['certificate-verify', params.code], queryFn: () => verifyCertificate(params.code), enabled: Boolean(params.code), retry: false });
  if (!params.code) return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-bold">Сертификат шалгах</h1><form className="mt-6 flex gap-2" onSubmit={e => { e.preventDefault(); location.href = `/verify/certificate/${encodeURIComponent(code.trim())}`; }}><input aria-label="Verification code" value={code} onChange={e => setCode(e.target.value)} className="flex-1 rounded-xl border p-3 font-mono" placeholder="Verification code"/><button className="rounded-xl bg-indigo-700 px-5 text-white">Шалгах</button></form></main>;
  return <main className="mx-auto flex min-h-screen max-w-xl items-center p-8"><section className="w-full rounded-3xl border bg-white p-8 text-center shadow-sm"><Award className="mx-auto text-indigo-700" size={42}/>{query.isLoading ? <p className="mt-5">Шалгаж байна...</p> : query.isError ? <><XCircle className="mx-auto mt-5 text-red-600"/><h1 className="mt-2 text-xl font-bold">Сертификат олдсонгүй</h1></> : <><CheckCircle2 className={`mx-auto mt-5 ${query.data.valid ? 'text-emerald-600' : 'text-red-600'}`}/><h1 className="mt-2 text-2xl font-bold">{query.data.valid ? 'Хүчинтэй сертификат' : 'Хүчингүй сертификат'}</h1><dl className="mt-6 grid gap-3 text-left text-sm"><div><dt className="text-slate-500">Эзэмшигч</dt><dd>{query.data.recipient}</dd></div><div><dt className="text-slate-500">Хичээл</dt><dd>{query.data.courseTitle}</dd></div><div><dt className="text-slate-500">Олгосон</dt><dd>{new Date(query.data.issuedAt).toLocaleDateString('mn-MN')}</dd></div><div><dt className="text-slate-500">Код</dt><dd className="font-mono">{query.data.verificationCode}</dd></div></dl></>}</section></main>;
}
