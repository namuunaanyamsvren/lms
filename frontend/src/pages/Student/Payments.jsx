import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, ExternalLink, ReceiptText } from 'lucide-react';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import PageHeader from '../../components/ui/PageHeader';
import { createQPayInvoice, fetchInvoices, fetchPaymentHistory } from '../../services/api';
import { useToast } from '../../context/ToastContext';

const statusTone = {
  PENDING: 'bg-amber-50 text-amber-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  FAILED: 'bg-rose-50 text-rose-700',
  REFUNDED: 'bg-slate-100 text-slate-600',
};
const money = (amount, currency) => `${Number(amount).toLocaleString('mn-MN')} ${currency}`;
const date = value => value ? new Date(value).toLocaleDateString('mn-MN') : '-';

export default function StudentPayments() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const invoicesQuery = useQuery({ queryKey: ['billing', 'student', 'invoices'], queryFn: fetchInvoices });
  const paymentsQuery = useQuery({ queryKey: ['billing', 'student', 'payments'], queryFn: fetchPaymentHistory });
  const qpayMutation = useMutation({
    mutationFn: createQPayInvoice,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      const url = response?.data?.qpayInvoiceUrl;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    },
    onError: error => showToast(error?.response?.data?.message || 'QPay нэхэмжлэх үүсгэхэд алдаа гарлаа.', 'error'),
  });
  const invoices = invoicesQuery.data || [];
  const payments = paymentsQuery.data || [];
  const pendingTotal = invoices
    .filter(invoice => invoice.status === 'PENDING')
    .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Төлбөр" subtitle="Сургалтын төлбөр, нэхэмжлэх болон төлөлтийн түүх." />

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Төлөх үлдэгдэл">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-700"><CreditCard size={22} /></div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{money(pendingTotal, invoices[0]?.currency || 'MNT')}</p>
              <p className="text-xs text-slate-500">Нээлттэй нэхэмжлэх</p>
            </div>
          </div>
        </Card>
        <Card title="Нэхэмжлэх">
          <p className="text-2xl font-bold text-slate-900">{invoices.length}</p>
          <p className="text-xs text-slate-500">Нийт бүртгэл</p>
        </Card>
        <Card title="Төлөлт">
          <p className="text-2xl font-bold text-slate-900">{payments.length}</p>
          <p className="text-xs text-slate-500">Төлбөрийн түүх</p>
        </Card>
      </div>

      <Card title="Миний нэхэмжлэхүүд">
        {invoicesQuery.isLoading ? (
          <div className="flex min-h-32 items-center justify-center"><LoadingSpinner /></div>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-slate-500">Нэхэмжлэх алга байна.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-500">
                <tr><th className="py-3">Тайлбар</th><th>Дүн</th><th>Хугацаа</th><th>Төлөв</th><th className="text-right">Үйлдэл</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map(invoice => (
                  <tr key={invoice.id}>
                    <td className="py-3 pr-3 text-slate-700">{invoice.description || 'Сургалтын төлбөр'}</td>
                    <td className="font-semibold text-slate-900">{money(invoice.amount, invoice.currency)}</td>
                    <td className="text-slate-500">{date(invoice.dueDate)}</td>
                    <td><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[invoice.status] || 'bg-slate-100'}`}>{invoice.status}</span></td>
                    <td className="text-right">
                      {invoice.status === 'PENDING' && (
                        <button
                          type="button"
                          onClick={() => qpayMutation.mutate(invoice.id)}
                          disabled={qpayMutation.isPending}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                        >
                          QPay <ExternalLink size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Төлбөрийн түүх">
        {paymentsQuery.isLoading ? (
          <div className="flex min-h-24 items-center justify-center"><LoadingSpinner /></div>
        ) : payments.length === 0 ? (
          <p className="text-sm text-slate-500">Төлөлт бүртгэгдээгүй байна.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {payments.map(payment => (
              <li key={payment.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-2xl bg-slate-100 p-2 text-slate-600"><ReceiptText size={17} /></span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{payment.method}</p>
                    <p className="text-xs text-slate-500">{date(payment.createdAt)} · {payment.transactionId}</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-slate-900">{money(payment.amount, payment.currency)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
