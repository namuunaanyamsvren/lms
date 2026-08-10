import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { queryKeys } from '../../services/queryKeys';
import {
  fetchPlatformOrganizations,
  fetchBillingOverview,
  fetchInvoices,
  fetchPaymentHistory,
  updateSubscription,
  issueInvoice,
  payInvoice,
  createQPayInvoice,
  failInvoice,
  refundInvoice,
} from '../../services/api';
import { CreditCard, Plus, Check, X, RotateCcw, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const PLAN_LABELS = { FREE: 'Free', BASIC: 'Basic', PRO: 'Pro', ENTERPRISE: 'Enterprise' };
const STATUS_TONE = {
  PENDING: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-rose-100 text-rose-800',
  REFUNDED: 'bg-slate-100 text-slate-600',
};
const formatMoney = (amount, currency) => `${Number(amount).toLocaleString('mn-MN')} ${currency}`;
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('mn-MN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

export default function Billing() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('invoices');
  const [planOpen, setPlanOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState('');
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const organizationsQuery = useQuery({
    queryKey: ['platform-organizations', 'billing'],
    queryFn: () => fetchPlatformOrganizations({ status: 'ACTIVE', limit: 100 }),
    enabled: isSuperAdmin,
  });
  const organizations = organizationsQuery.data?.items || [];
  const activeOrganizationId = isSuperAdmin ? (selectedOrganizationId || organizations[0]?.id || user?.organizationId) : user?.organizationId;
  const activeBillingParams = isSuperAdmin && activeOrganizationId ? { organizationId: activeOrganizationId } : {};

  const overviewQuery = useQuery({ queryKey: [...queryKeys.billing.overview, activeOrganizationId], queryFn: () => fetchBillingOverview(activeBillingParams), enabled: !isSuperAdmin || Boolean(activeOrganizationId) });
  const invoicesQuery = useQuery({ queryKey: [...queryKeys.billing.invoices, activeOrganizationId], queryFn: () => fetchInvoices(activeBillingParams), enabled: tab === 'invoices' && (!isSuperAdmin || Boolean(activeOrganizationId)) });
  const paymentsQuery = useQuery({ queryKey: [...queryKeys.billing.payments, activeOrganizationId], queryFn: () => fetchPaymentHistory(activeBillingParams), enabled: tab === 'payments' && (!isSuperAdmin || Boolean(activeOrganizationId)) });

  const invalidateBilling = () => queryClient.invalidateQueries({ queryKey: ['billing'] });

  const planForm = useForm({ defaultValues: { plan: 'BASIC', amount: 0, currency: 'MNT', billingCycle: 'monthly' } });
  const issueForm = useForm({ defaultValues: { amount: 0, currency: 'MNT', description: 'Байгууллагын LMS SaaS ашиглалтын төлбөр' } });

  const planMutation = useMutation({ mutationFn: updateSubscription, onSuccess: invalidateBilling });
  const issueMutation = useMutation({ mutationFn: issueInvoice, onSuccess: invalidateBilling });
  const payMutation = useMutation({ mutationFn: (id) => payInvoice(id), onSuccess: invalidateBilling });
  const qpayMutation = useMutation({ mutationFn: createQPayInvoice, onSuccess: invalidateBilling });
  const failMutation = useMutation({ mutationFn: failInvoice, onSuccess: invalidateBilling });
  const refundMutation = useMutation({ mutationFn: refundInvoice, onSuccess: invalidateBilling });

  const onPlanSubmit = planForm.handleSubmit(async (values) => {
    try {
      await planMutation.mutateAsync({ ...values, ...activeBillingParams, amount: Number(values.amount) });
      setPlanOpen(false);
      showToast('Багц шинэчлэгдлээ.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Багц шинэчлэхэд алдаа гарлаа', 'error');
    }
  });

  const onIssueSubmit = issueForm.handleSubmit(async (values) => {
    try {
      await issueMutation.mutateAsync({ ...values, ...activeBillingParams, amount: Number(values.amount) });
      setIssueOpen(false);
      issueForm.reset({ amount: 0, currency: 'MNT', description: 'Байгууллагын LMS SaaS ашиглалтын төлбөр' });
      showToast('Нэхэмжлэх үүслээ.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Нэхэмжлэх үүсгэхэд алдаа гарлаа', 'error');
    }
  });

  const handlePay = async (id) => {
    try {
      await payMutation.mutateAsync(id);
      showToast('Нэхэмжлэх төлөгдсөнөөр тэмдэглэгдлээ.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Алдаа гарлаа', 'error');
    }
  };

  const handleQPay = async (id) => {
    try {
      const response = await qpayMutation.mutateAsync(id);
      const url = response?.data?.qpayInvoiceUrl;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      showToast('QPay нэхэмжлэх үүслээ.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'QPay нэхэмжлэх үүсгэхэд алдаа гарлаа', 'error');
    }
  };

  const handleRefund = async (id) => {
    const ok = await confirm({ title: 'Буцаалт хийх', message: 'Энэ нэхэмжлэхийг буцаах уу?', tone: 'destructive', confirmLabel: 'Буцаах' });
    if (!ok) return;
    try {
      await refundMutation.mutateAsync(id);
      showToast('Буцаалт хийгдлээ.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Алдаа гарлаа', 'error');
    }
  };

  const handleFail = async (id) => {
    try {
      await failMutation.mutateAsync(id);
      showToast('Нэхэмжлэх амжилтгүй болсноор тэмдэглэгдлээ.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Алдаа гарлаа', 'error');
    }
  };

  const subscription = overviewQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Багц ба нэхэмжлэх"
        subtitle="Байгууллагын багц, нэхэмжлэх, төлбөрийн түүх."
        right={
          <div className="flex gap-2">
            {isSuperAdmin && (
              <>
                <button onClick={() => setPlanOpen(true)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50">Багц өөрчлөх</button>
                <button onClick={() => setIssueOpen(true)} className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-indigo-700">
                  <Plus size={15} />Нэхэмжлэх үүсгэх
                </button>
              </>
            )}
          </div>
        }
      />

      {isSuperAdmin && (
        <Card>
          <label className="block text-xs font-semibold text-slate-600">Сургууль / байгууллага</label>
          <select
            value={activeOrganizationId || ''}
            onChange={(event) => setSelectedOrganizationId(event.target.value)}
            className="mt-2 w-full max-w-md rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          >
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>{organization.name} · {organization.slug}</option>
            ))}
          </select>
        </Card>
      )}

      {overviewQuery.isLoading ? (
        <div className="flex min-h-[20vh] items-center justify-center"><LoadingSpinner /></div>
      ) : !subscription ? (
        <Card><p className="text-sm text-slate-500">Багц бүртгэгдээгүй байна.</p></Card>
      ) : (
        <Card>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-indigo-100 p-3 text-indigo-600"><CreditCard size={22} /></div>
              <div>
                <p className="text-lg font-bold text-slate-900">{PLAN_LABELS[subscription.plan] || subscription.plan}</p>
                <p className="text-xs text-slate-500">{formatMoney(subscription.amount, subscription.currency)} / {subscription.billingCycle}</p>
              </div>
            </div>
            <div className="text-xs text-slate-500">
              <p>Дараагийн тооцоо: {formatDate(subscription.nextBillingAt)}</p>
              <p className="mt-0.5">Төлөв: <span className={subscription.isActive ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>{subscription.isActive ? 'Идэвхтэй' : 'Идэвхгүй'}</span></p>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="mb-4 flex gap-2">
          {['invoices', 'payments'].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${tab === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {t === 'invoices' ? 'Нэхэмжлэхүүд' : 'Төлбөрийн түүх'}
            </button>
          ))}
        </div>

        {tab === 'invoices' ? (
          invoicesQuery.isLoading ? (
            <div className="flex min-h-[20vh] items-center justify-center"><LoadingSpinner /></div>
          ) : (invoicesQuery.data || []).length === 0 ? (
            <p className="text-sm text-slate-500">Нэхэмжлэх алга байна.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr><th className="px-4 py-3">Тайлбар</th><th className="px-4 py-3">Дүн</th><th className="px-4 py-3">Төлөв</th><th className="px-4 py-3">Үүссэн</th><th className="px-4 py-3 text-right">Үйлдэл</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {invoicesQuery.data.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 text-slate-700">{inv.description || 'Байгууллагын LMS SaaS ашиглалтын төлбөр'}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{formatMoney(inv.amount, inv.currency)}</td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_TONE[inv.status] || 'bg-slate-100'}`}>{inv.status}</span></td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(inv.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          {inv.status === 'PENDING' && (
                            <>
                              <button onClick={() => handleQPay(inv.id)} title="QPay төлөх" className="rounded-xl border border-indigo-200 bg-indigo-50 p-1.5 text-indigo-700 hover:bg-indigo-100"><ExternalLink size={14} /></button>
                              {isSuperAdmin && (
                                <>
                                  <button onClick={() => handlePay(inv.id)} title="Төлөгдсөн" className="rounded-xl border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100"><Check size={14} /></button>
                                  <button onClick={() => handleFail(inv.id)} title="Амжилтгүй" className="rounded-xl border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100"><X size={14} /></button>
                                </>
                              )}
                            </>
                          )}
                          {isSuperAdmin && inv.status === 'COMPLETED' && (
                            <button onClick={() => handleRefund(inv.id)} title="Буцаах" className="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100"><RotateCcw size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : paymentsQuery.isLoading ? (
          <div className="flex min-h-[20vh] items-center justify-center"><LoadingSpinner /></div>
        ) : (paymentsQuery.data || []).length === 0 ? (
          <p className="text-sm text-slate-500">Төлбөрийн түүх алга байна.</p>
        ) : (
          <div className="space-y-2">
            {paymentsQuery.data.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-200/80 px-4 py-2.5 text-xs">
                <span className="text-slate-700">{p.method} · {formatDate(p.createdAt)}</span>
                <span className="font-semibold text-slate-900">{formatMoney(p.amount, p.currency)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {planOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-900">Багц шинэчлэх</h3>
              <button onClick={() => setPlanOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <form onSubmit={onPlanSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Багц</label>
                <select {...planForm.register('plan')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs">
                  {Object.keys(PLAN_LABELS).map((p) => <option key={p} value={p}>{PLAN_LABELS[p]}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Үнэ</label>
                  <input type="number" min="0" {...planForm.register('amount', { required: true })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Мөчлөг</label>
                  <select {...planForm.register('billingCycle')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs">
                    <option value="monthly">Сар бүр</option>
                    <option value="quarterly">Улирал бүр</option>
                    <option value="yearly">Жил бүр</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setPlanOpen(false)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Цуцлах</button>
                <button type="submit" disabled={planForm.formState.isSubmitting} className="rounded-2xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-md disabled:opacity-50">Хадгалах</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {issueOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-900">Нэхэмжлэх үүсгэх</h3>
              <button onClick={() => setIssueOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <form onSubmit={onIssueSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Дүн *</label>
                <input type="number" min="1" {...issueForm.register('amount', { required: true })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Тайлбар</label>
                <input {...issueForm.register('description')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs" />
              </div>
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIssueOpen(false)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Цуцлах</button>
                <button type="submit" disabled={issueForm.formState.isSubmitting} className="rounded-2xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-md disabled:opacity-50">Үүсгэх</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
