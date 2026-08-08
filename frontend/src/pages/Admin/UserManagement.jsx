import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { queryKeys } from '../../services/queryKeys';
import {
  fetchUsers,
  createUser,
  updateUserAdmin,
  deactivateUserAdmin,
  downloadUserCsvTemplate,
  importUsersCsv,
  exportUsersCsv,
} from '../../services/api';
import { roleLabels, userStatusLabels } from '../../i18n';
import {
  Search,
  Filter,
  Plus,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  X,
  Pencil,
  Ban,
  CheckCircle2,
  UserX,
} from 'lucide-react';

const ROLE_LABELS = roleLabels;
const ROLES = Object.keys(ROLE_LABELS);

const STATUS_LABELS = userStatusLabels;
const STATUS_TONE = {
  INVITED: 'bg-sky-100 text-sky-800',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  SUSPENDED: 'bg-amber-100 text-amber-800',
  DEACTIVATED: 'bg-rose-100 text-rose-800',
};

const emptyCreateForm = {
  email: '', firstName: '', lastName: '', role: 'STUDENT', studentId: '', guardianLinkCode: '', employeeId: '',
};

export default function UserManagement() {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') || '';
  const roleFilter = searchParams.get('role') || 'ALL';
  const statusFilter = searchParams.get('status') || 'ALL';
  const page = Number(searchParams.get('page') || '1');

  const setParam = (key, value, { resetPage = true } = {}) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'ALL') next.delete(key); else next.set(key, value);
    if (resetPage) next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importErrors, setImportErrors] = useState(null);
  const [importSummary, setImportSummary] = useState(null);

  const params = {
    search: search || undefined,
    role: roleFilter === 'ALL' ? undefined : roleFilter,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    page,
    pageSize: 10,
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: ({ signal }) => fetchUsers(params, signal),
    placeholderData: keepPreviousData,
  });
  const items = data?.items || [];
  const pagination = data?.pagination || null;

  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all });

  const createMutation = useMutation({ mutationFn: createUser, onSuccess: invalidateUsers });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateUserAdmin(id, payload),
    onSuccess: invalidateUsers,
  });
  const deactivateMutation = useMutation({ mutationFn: deactivateUserAdmin, onSuccess: invalidateUsers });

  const createForm = useForm({ defaultValues: emptyCreateForm });
  const editForm = useForm({ defaultValues: emptyCreateForm });

  useEffect(() => {
    if (editUser) {
      editForm.reset({
        firstName: editUser.firstName || '',
        lastName: editUser.lastName || '',
        role: editUser.role,
        status: editUser.status,
        studentId: editUser.studentId || '',
        guardianLinkCode: editUser.guardianLinkCode || '',
        employeeId: editUser.employeeId || '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editUser?.id]);

  const onCreateSubmit = createForm.handleSubmit(async (values) => {
    try {
      await createMutation.mutateAsync({
        ...values,
        studentId: values.studentId || undefined,
        guardianLinkCode: values.role === 'STUDENT' ? values.guardianLinkCode || undefined : undefined,
        employeeId: values.employeeId || undefined,
      });
      setCreateOpen(false);
      createForm.reset(emptyCreateForm);
      showToast('Хэрэглэгчийг амжилттай урьлаа. Нууц үг тохируулах холбоос имэйлээр илгээгдлээ.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Урих үед алдаа гарлаа', 'error');
    }
  });

  const onEditSubmit = editForm.handleSubmit(async (values) => {
    try {
      await updateMutation.mutateAsync({
        id: editUser.id,
        payload: {
          firstName: values.firstName || null,
          lastName: values.lastName || null,
          role: values.role,
          status: values.status,
          studentId: values.studentId || null,
          guardianLinkCode: values.role === 'STUDENT' ? values.guardianLinkCode || null : null,
          employeeId: values.employeeId || null,
        },
      });
      setEditUser(null);
      showToast('Хэрэглэгчийн мэдээлэл шинэчлэгдлээ.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Шинэчлэхэд алдаа гарлаа', 'error');
    }
  });

  const toggleStatus = async (user, status) => {
    try {
      if (status === 'DEACTIVATED') {
        await deactivateMutation.mutateAsync(user.id);
      } else {
        await updateMutation.mutateAsync({ id: user.id, payload: { status } });
      }
      showToast('Төлөв шинэчлэгдлээ.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Төлөв өөрчлөхөд алдаа гарлаа', 'error');
    }
  };

  const handleDeactivateClick = async (user) => {
    const ok = await confirm({
      title: 'Идэвхгүй болгох',
      message: `${user.firstName || user.email}-г идэвхгүй болгох уу?`,
      tone: 'destructive',
      confirmLabel: 'Идэвхгүй болгох',
    });
    if (ok) toggleStatus(user, 'DEACTIVATED');
  };

  const handleDownloadTemplate = async () => {
    const blob = await downloadUserCsvTemplate();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'user-import-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    const blob = await exportUsersCsv({
      search: search || undefined,
      role: roleFilter === 'ALL' ? undefined : roleFilter,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    try {
      const res = await importUsersCsv(text);
      setImportSummary(res.data.imported);
      setImportErrors(res.data.errors);
      invalidateUsers();
    } catch (err) {
      showToast(err?.response?.data?.message || 'CSV импортлоход алдаа гарлаа', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Хэрэглэгчийн удирдлага"
        subtitle="Хэрэглэгч урих, эрх/төлөв удирдах, bulk import/export."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
            >
              <Download size={15} /><span>Загвар (CSV)</span>
            </button>
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
            >
              <Upload size={15} /><span>Импорт (CSV)</span>
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
            >
              <Download size={15} /><span>Экспорт (CSV)</span>
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-indigo-700 transition"
            >
              <Plus size={16} /><span>Хэрэглэгч урих</span>
            </button>
          </div>
        }
      />

      {isError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          {error?.response?.data?.message || error?.message || 'Хэрэглэгчдийг ачаалахад алдаа гарлаа'}
        </div>
      )}

      <Card title="Хэрэглэгчдийн жагсаалт">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Нэр, имэйл, ID-аар хайх..."
              value={search}
              onChange={(e) => setParam('search', e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <Filter size={13} className="text-slate-400 shrink-0" />
            <select
              value={roleFilter}
              onChange={(e) => setParam('role', e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-100 px-2 py-1.5 text-xs font-semibold text-slate-600"
            >
              <option value="ALL">Бүх эрх</option>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setParam('status', e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-100 px-2 py-1.5 text-xs font-semibold text-slate-600"
            >
              <option value="ALL">Бүх төлөв</option>
              {Object.keys(STATUS_LABELS).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center"><LoadingSpinner /></div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
            <UserX size={36} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">Хэрэглэгч олдсонгүй</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Хэрэглэгч</th>
                  <th className="px-4 py-3">Эрх</th>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Төлөв</th>
                  <th className="px-4 py-3 text-right">Үйлдэл</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {items.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{[u.lastName, u.firstName].filter(Boolean).join(' ') || u.email}</div>
                      <div className="text-[10px] text-slate-400">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">{ROLE_LABELS[u.role] || u.role}</td>
                    <td className="px-4 py-3 text-slate-500">
                      <div>{u.studentId || u.employeeId || '-'}</div>
                      {u.role === 'STUDENT' && u.guardianLinkCode && (
                        <div className="mt-1 text-[10px] text-slate-400">Эцэг эхийн код: {u.guardianLinkCode}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_TONE[u.status] || 'bg-slate-100 text-slate-700'}`}>
                        {STATUS_LABELS[u.status] || u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setEditUser({ ...u })}
                          title="Засах"
                          className="rounded-xl border border-slate-200 p-1.5 hover:bg-slate-100"
                        ><Pencil size={14} /></button>
                        {u.status === 'SUSPENDED' ? (
                          <button
                            onClick={() => toggleStatus(u, 'ACTIVE')}
                            title="Идэвхжүүлэх"
                            className="rounded-xl border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100"
                          ><CheckCircle2 size={14} /></button>
                        ) : u.status !== 'DEACTIVATED' && (
                          <button
                            onClick={() => toggleStatus(u, 'SUSPENDED')}
                            title="Түр хаах"
                            className="rounded-xl border border-amber-200 bg-amber-50 p-1.5 text-amber-700 hover:bg-amber-100"
                          ><Ban size={14} /></button>
                        )}
                        {u.status !== 'DEACTIVATED' && (
                          <button
                            onClick={() => handleDeactivateClick(u)}
                            title="Идэвхгүй болгох"
                            className="rounded-xl border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100"
                          ><UserX size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.pages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
            <span className="text-slate-500">Нийт {pagination.total} хэрэглэгч</span>
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setParam('page', String(page - 1), { resetPage: false })} className="rounded-xl border border-slate-200 p-1.5 hover:bg-slate-100 disabled:opacity-40"><ChevronLeft size={16} /></button>
              <span className="px-3 font-semibold text-slate-700">{page} / {pagination.pages}</span>
              <button disabled={page === pagination.pages} onClick={() => setParam('page', String(page + 1), { resetPage: false })} className="rounded-xl border border-slate-200 p-1.5 hover:bg-slate-100 disabled:opacity-40"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </Card>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-900">Хэрэглэгч урих</h3>
              <button onClick={() => setCreateOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <form onSubmit={onCreateSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">И-мэйл *</label>
                <input type="email" {...createForm.register('email', { required: true })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Нэр</label>
                  <input {...createForm.register('firstName')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Овог</label>
                  <input {...createForm.register('lastName')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Эрх *</label>
                <select {...createForm.register('role')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Оюутны код</label>
                  <input {...createForm.register('studentId')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Эцэг эх холбох код</label>
                  <input {...createForm.register('guardianLinkCode')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ажилтны код</label>
                  <input {...createForm.register('employeeId')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setCreateOpen(false)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Цуцлах</button>
                <button type="submit" disabled={createForm.formState.isSubmitting} className="rounded-2xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-md transition disabled:opacity-50">Урих</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-900">Хэрэглэгч засах</h3>
              <button onClick={() => setEditUser(null)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <form onSubmit={onEditSubmit} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Нэр</label>
                  <input {...editForm.register('firstName')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Овог</label>
                  <input {...editForm.register('lastName')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Эрх</label>
                  <select {...editForm.register('role')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Төлөв</label>
                  <select {...editForm.register('status')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {Object.keys(STATUS_LABELS).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Оюутны код</label>
                  <input {...editForm.register('studentId')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Эцэг эх холбох код</label>
                  <input {...editForm.register('guardianLinkCode')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ажилтны код</label>
                  <input {...editForm.register('employeeId')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setEditUser(null)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Цуцлах</button>
                <button type="submit" disabled={editForm.formState.isSubmitting} className="rounded-2xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-md transition disabled:opacity-50">Хадгалах</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-900">CSV импорт</h3>
              <button onClick={() => { setImportOpen(false); setImportErrors(null); setImportSummary(null); }} className="rounded-full p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="mt-4 space-y-4 text-xs">
              <p className="text-slate-500">Эхлээд загвар татаж бөглөнө үү. Дараа нь бөглөсөн CSV файлаа сонгож оруулна.</p>
              <input type="file" accept=".csv,text/csv" onChange={(e) => handleImportFile(e.target.files?.[0])} className="w-full rounded-2xl border border-dashed border-slate-300 p-4 text-xs" />
              {importSummary != null && (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-emerald-800">
                  {importSummary} хэрэглэгч амжилттай урьлаа.
                </div>
              )}
              {importErrors && importErrors.length > 0 && (
                <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-rose-800 max-h-48 overflow-y-auto">
                  <p className="font-semibold mb-1">Алдаатай мөрүүд:</p>
                  <ul className="space-y-1">
                    {importErrors.map((e, i) => <li key={i}>Мөр {e.row}: {e.message}</li>)}
                  </ul>
                </div>
              )}
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button onClick={() => { setImportOpen(false); setImportErrors(null); setImportSummary(null); }} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Хаах</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
