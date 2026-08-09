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
  fetchConsentForms,
  createConsentForm,
  publishConsentForm,
  fetchConsentAcknowledgements,
  acknowledgeConsentForm,
} from '../services/api';
import { FileSignature, Send, Check, X, ChevronDown, ChevronUp, Plus } from 'lucide-react';

const STAFF_LIKE_ROLES = ['INSTRUCTOR', 'STAFF', 'PRINCIPAL', 'ORG_ADMIN', 'SUPER_ADMIN'];

const FORM_STATUS_LABELS = { DRAFT: 'Ноорог', PUBLISHED: 'Нийтэлсэн', ARCHIVED: 'Архивласан' };
const FORM_STATUS_TONE = {
  DRAFT: 'bg-slate-100 text-slate-600',
  PUBLISHED: 'bg-emerald-100 text-emerald-800',
  ARCHIVED: 'bg-slate-100 text-slate-500',
};
const ACK_STATUS_LABELS = { PENDING: 'Хүлээгдэж буй', ACKNOWLEDGED: 'Зөвшөөрсөн', DECLINED: 'Татгалзсан' };
const ACK_STATUS_TONE = {
  PENDING: 'bg-amber-100 text-amber-800',
  ACKNOWLEDGED: 'bg-emerald-100 text-emerald-800',
  DECLINED: 'bg-rose-100 text-rose-800',
};

function CreateConsentFormCard({ onCreated }) {
  const { showToast } = useToast();
  const form = useForm({ defaultValues: { title: '', body: '', requiresSignature: true, dueAt: '' } });
  const createMutation = useMutation({ mutationFn: createConsentForm });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await createMutation.mutateAsync({
        title: values.title.trim(),
        body: values.body.trim(),
        requiresSignature: values.requiresSignature,
        dueAt: values.dueAt ? new Date(values.dueAt).toISOString() : undefined,
      });
      form.reset({ title: '', body: '', requiresSignature: true, dueAt: '' });
      showToast('Ноорог маягт үүслээ.', 'success');
      onCreated();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Маягт үүсгэхэд алдаа гарлаа', 'error');
    }
  });

  return (
    <Card title="Шинэ зөвшөөрлийн маягт">
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          {...form.register('title', { required: true })}
          placeholder="Гарчиг (жишээ нь: Музейд зочлох зөвшөөрөл)"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <textarea
          {...form.register('body', { required: true })}
          rows={3}
          placeholder="Маягтын агуулга, эцэг эхээс юуг зөвшөөрөхийг хүсэж байгаагаа тайлбарлана уу"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <input type="checkbox" {...form.register('requiresSignature')} className="rounded border-slate-300" />
            Гарын үсэг шаардах
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            Эцсийн хугацаа
            <input
              type="date"
              {...form.register('dueAt')}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-md transition disabled:opacity-50"
        >
          <Plus size={15} /><span>Ноорог үүсгэх</span>
        </button>
      </form>
    </Card>
  );
}

function AcknowledgementRoster({ formId }) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.consentForms.acknowledgements(formId),
    queryFn: () => fetchConsentAcknowledgements(formId),
  });
  const rows = data || [];

  if (isLoading) return <div className="flex min-h-[10vh] items-center justify-center"><LoadingSpinner /></div>;
  if (rows.length === 0) {
    return <p className="py-4 text-center text-xs text-slate-400">Одоогоор холбогдсон эцэг эх алга.</p>;
  }

  return (
    <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
      {rows.map((row) => (
        <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-[11px]">
          <div>
            <p className="font-semibold text-slate-800">
              {row.studentUser.firstName} {row.studentUser.lastName}
              {row.studentUser.studentId ? ` (${row.studentUser.studentId})` : ''}
            </p>
            <p className="text-slate-400">{row.parentUser.firstName} {row.parentUser.lastName} · {row.parentUser.email}</p>
          </div>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-bold ${ACK_STATUS_TONE[row.status] || 'bg-slate-100 text-slate-700'}`}>
            {ACK_STATUS_LABELS[row.status] || row.status}
          </span>
        </div>
      ))}
    </div>
  );
}

function StaffConsentForms() {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.consentForms.list(),
    queryFn: ({ signal }) => fetchConsentForms({}, signal),
  });
  const forms = data || [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.consentForms.all });
  const publishMutation = useMutation({ mutationFn: publishConsentForm, onSuccess: invalidate });

  const publish = async (form) => {
    const ok = await confirm({
      title: 'Маягт нийтлэх',
      message: `"${form.title}" маягтыг нийтлэх үү? Нийтэлсний дараа бүх холбогдсон эцэг эхэд мэдэгдэл очих ба маягтыг цаашид засах боломжгүй.`,
      confirmLabel: 'Нийтлэх',
    });
    if (!ok) return;
    try {
      await publishMutation.mutateAsync(form.id);
      showToast('Маягт нийтлэгдэж, эцэг эхэд мэдэгдэл илгээгдлээ.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Нийтлэхэд алдаа гарлаа', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Зөвшөөрлийн маягтууд"
        subtitle="Эцэг эхэд зориулсан зөвшөөрлийн маягт үүсгэх, нийтлэх, хариултыг хянах."
      />

      <CreateConsentFormCard onCreated={invalidate} />

      <Card title="Маягтын жагсаалт">
        {isError && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
            {error?.response?.data?.message || error?.message || 'Мэдээлэл ачаалахад алдаа гарлаа'}
          </div>
        )}
        {isLoading ? (
          <div className="flex min-h-[20vh] items-center justify-center"><LoadingSpinner /></div>
        ) : forms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
            Маягт байхгүй байна.
          </div>
        ) : (
          <div className="space-y-3">
            {forms.map((form) => (
              <div key={form.id} className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">{form.title}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{form.body}</p>
                    {form.dueAt && (
                      <p className="mt-1 text-[10px] text-slate-400">Эцсийн хугацаа: {new Date(form.dueAt).toLocaleDateString('mn-MN')}</p>
                    )}
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${FORM_STATUS_TONE[form.status] || 'bg-slate-100 text-slate-700'}`}>
                    {FORM_STATUS_LABELS[form.status] || form.status}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-end gap-2">
                  {form.status === 'DRAFT' && (
                    <button
                      onClick={() => publish(form)}
                      className="flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                    >
                      <Send size={13} />Нийтлэх
                    </button>
                  )}
                  {form.status === 'PUBLISHED' && (
                    <button
                      onClick={() => setExpandedId(expandedId === form.id ? null : form.id)}
                      className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      {expandedId === form.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      Хариултыг харах
                    </button>
                  )}
                </div>

                {expandedId === form.id && <AcknowledgementRoster formId={form.id} />}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ParentConsentForms() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [signatureDrafts, setSignatureDrafts] = useState({});

  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.consentForms.list(),
    queryFn: ({ signal }) => fetchConsentForms({}, signal),
  });
  const items = data || [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.consentForms.all });
  const acknowledgeMutation = useMutation({
    mutationFn: ({ formId, payload }) => acknowledgeConsentForm(formId, payload),
    onSuccess: invalidate,
  });

  const respond = async (item, status) => {
    const signatureName = signatureDrafts[`${item.consentForm.id}:${item.studentUser.id}`]?.trim();
    if (item.consentForm.requiresSignature && status === 'ACKNOWLEDGED' && !signatureName) {
      showToast('Гарын үсгийн нэрээ бичнэ үү', 'error');
      return;
    }
    try {
      await acknowledgeMutation.mutateAsync({
        formId: item.consentForm.id,
        payload: { studentUserId: item.studentUser.id, status, signatureName: status === 'ACKNOWLEDGED' ? signatureName : undefined },
      });
      showToast(status === 'ACKNOWLEDGED' ? 'Зөвшөөрлөө.' : 'Татгалзлаа.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Алдаа гарлаа', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Зөвшөөрлийн маягтууд"
        subtitle="Хүүхэдтэй холбоотой зөвшөөрлийн маягтуудыг харж, хариу өгөх."
      />

      {isError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          {error?.response?.data?.message || error?.message || 'Мэдээлэл ачаалахад алдаа гарлаа'}
        </div>
      )}

      <Card title="Миний маягтууд">
        {isLoading ? (
          <div className="flex min-h-[20vh] items-center justify-center"><LoadingSpinner /></div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
            <FileSignature size={36} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">Одоогоор маягт алга</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const draftKey = `${item.consentForm.id}:${item.studentUser.id}`;
              return (
                <div key={draftKey} className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-900">{item.consentForm.title}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{item.consentForm.body}</p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        Хүүхэд: {item.studentUser.firstName} {item.studentUser.lastName}
                        {item.consentForm.dueAt ? ` · Эцсийн хугацаа: ${new Date(item.consentForm.dueAt).toLocaleDateString('mn-MN')}` : ''}
                      </p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${ACK_STATUS_TONE[item.status] || 'bg-slate-100 text-slate-700'}`}>
                      {ACK_STATUS_LABELS[item.status] || item.status}
                    </span>
                  </div>

                  {item.status === 'PENDING' ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {item.consentForm.requiresSignature && (
                        <input
                          value={signatureDrafts[draftKey] || ''}
                          onChange={(e) => setSignatureDrafts((prev) => ({ ...prev, [draftKey]: e.target.value }))}
                          placeholder="Гарын үсэг (эцэг эхийн нэр)"
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      )}
                      <button
                        onClick={() => respond(item, 'ACKNOWLEDGED')}
                        className="flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        <Check size={13} />Зөвшөөрөх
                      </button>
                      <button
                        onClick={() => respond(item, 'DECLINED')}
                        className="flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        <X size={13} />Татгалзах
                      </button>
                    </div>
                  ) : (
                    <p className="mt-3 text-[10px] text-slate-400">
                      {item.respondedAt ? `Хариу өгсөн: ${formatDateTime(item.respondedAt)}` : ''}
                      {item.signatureName ? ` · Гарын үсэг: ${item.signatureName}` : ''}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function ConsentForms() {
  const { user } = useAuth();
  const isStaffLike = STAFF_LIKE_ROLES.includes(user?.role);
  return isStaffLike ? <StaffConsentForms /> : <ParentConsentForms />;
}
