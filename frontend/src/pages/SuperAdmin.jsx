import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import {
  createSuperAdminPlan,
  fetchSuperAdminList,
  fetchSuperAdminOrganization,
  fetchSuperAdminOverview,
  updateSuperAdminPlan,
  updateSuperAdminOrganizationStatus,
} from '../services/api';

const resources = {
  organizations: { title: 'Organizations', subtitle: 'Tenant lifecycle, status, limits and audit context.', endpoint: 'organizations' },
  subscriptions: { title: 'Subscriptions', subtitle: 'Stripe-verified billing state from the billing database.', endpoint: 'subscriptions' },
  users: { title: 'Users', subtitle: 'Cross-tenant safe identity fields only.', endpoint: 'users' },
  plans: { title: 'Plans & Features', subtitle: 'Platform plans and limits.', endpoint: 'plans' },
  health: { title: 'System Health', subtitle: 'Service and dependency health with timeout isolation.', endpoint: 'system-health' },
  security: { title: 'Security', subtitle: 'Authentication and security events.', endpoint: 'security-events' },
  audit: { title: 'Audit Logs', subtitle: 'Super Admin critical action audit trail.', endpoint: 'audit-logs' },
  notifications: { title: 'Notifications', subtitle: 'Notification delivery status and failures.', endpoint: 'notification-deliveries' },
  support: { title: 'Support', subtitle: 'Support-facing access requests without private learning details.', endpoint: 'support-tickets' },
  settings: { title: 'Platform Settings', subtitle: 'Operational settings surface.', endpoint: 'plans' },
};

const statusOptions = ['PENDING_PAYMENT', 'TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED'];
const money = value => new Intl.NumberFormat('mn-MN').format(Number(value || 0));
const getItems = data => Array.isArray(data) ? data : data?.items || [];

function LoadingState() {
  return <Card><p className="text-sm text-slate-500">Ачааллаж байна...</p></Card>;
}

function ErrorState({ message, onRetry }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-red-600">{message}</p>
        <button type="button" className="btn inline-flex items-center gap-2" onClick={onRetry}><RefreshCw size={16} /> Дахин</button>
      </div>
    </Card>
  );
}

function EmptyState() {
  return <Card><p className="text-sm text-slate-500">Мэдээлэл олдсонгүй.</p></Card>;
}

function Pager({ data, page, setPage }) {
  const totalPages = Number(data?.totalPages || 1);
  return (
    <div className="flex items-center justify-between text-sm text-slate-600">
      <span>Нийт {data?.total ?? getItems(data).length}</span>
      <div className="flex gap-2">
        <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Өмнөх</button>
        <span className="rounded-lg border px-3 py-2">{page} / {totalPages}</span>
        <button className="btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Дараах</button>
      </div>
    </div>
  );
}

function Overview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await fetchSuperAdminOverview());
    } catch (err) {
      setError(err.message || 'Overview ачааллахад алдаа гарлаа.');
    } finally {
      setLoading(false);
    }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  const org = data.organizations || {};
  const stats = [
    ['Нийт байгууллага', org.total],
    ['Active', org.active],
    ['Trial', org.trial],
    ['Pending payment', org.pendingPayment],
    ['Past due', org.pastDue],
    ['Suspended', org.suspended],
    ['Нийт хэрэглэгч', data.users?.total],
    ['Сарын орлого', `${money(data.billing?.monthlyRevenue)} ${data.billing?.currency || 'MNT'}`],
    ['Failed payment', data.billing?.failedPayments],
    ['Delivery failure', data.notifications?.deliveryFailures],
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map(([label, value]) => <Card key={label}><p className="text-xs text-slate-500">{label}</p><b className="mt-2 block text-2xl text-slate-900">{value ?? 0}</b></Card>)}
      </div>
      <Card title="Service summary">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {Object.entries(data.healthSummary || {}).map(([name, status]) => <div key={name} className="rounded-lg border px-3 py-2 text-sm"><b>{name}</b><p className={status === 'HEALTHY' ? 'text-emerald-700' : 'text-amber-700'}>{status}</p></div>)}
        </div>
      </Card>
    </div>
  );
}

function OrganizationActionModal({ organization, onClose, onSaved }) {
  const [status, setStatus] = useState(organization.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await updateSuperAdminOrganizationStatus(organization.id, { status, reason });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Төлөв өөрчлөхөд алдаа гарлаа.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-600" />
          <div><h2 className="text-lg font-bold">Organization status update</h2><p className="text-sm text-slate-500">{organization.name}</p></div>
        </div>
        <label className="mt-5 block text-sm">Төлөв<select className="mt-1 w-full rounded-lg border px-3 py-2" value={status} onChange={e => setStatus(e.target.value)}>{statusOptions.map(item => <option key={item}>{item}</option>)}</select></label>
        <label className="mt-4 block text-sm">Шалтгаан<textarea className="mt-1 min-h-24 w-full rounded-lg border px-3 py-2" required minLength={3} value={reason} onChange={e => setReason(e.target.value)} /></label>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>Болих</button><button disabled={saving} className="btn bg-primary text-white">{saving ? 'Хадгалж байна...' : 'Батлах'}</button></div>
      </form>
    </div>
  );
}

function OrganizationDetail({ organizationId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setData(await fetchSuperAdminOrganization(organizationId)); } catch (err) { setError(err.message || 'Detail ачааллахад алдаа гарлаа.'); } finally { setLoading(false); }
  }, [organizationId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  return (
    <div className="space-y-4">
      <button className="btn" onClick={onBack}>Буцах</button>
      <Card title={data.name} subtitle={`${data.slug} · ${data.status}`}>
        <div className="grid gap-3 sm:grid-cols-3">
          <p>Users: <b>{data.stats?.totalUsers || 0}</b></p>
          <p>Students: <b>{data.stats?.students || 0}</b></p>
          <p>Teachers: <b>{data.stats?.instructors || 0}</b></p>
          <p>Max users: <b>{data.settings?.maxUsers || 0}</b></p>
          <p>Plan: <b>{data.subscription?.plan || 'NONE'}</b></p>
          <p>Next billing: <b>{data.subscription?.nextBillingAt ? new Date(data.subscription.nextBillingAt).toLocaleDateString('mn-MN') : '—'}</b></p>
        </div>
      </Card>
      <Card title="Status history & audit events">
        {getItems(data.auditEvents).length === 0 ? <p className="text-sm text-slate-500">Audit event байхгүй.</p> : getItems(data.auditEvents).map(item => <div key={item.id} className="border-b py-3 text-sm"><b>{item.action}</b><p>{item.reason || '—'}</p><p className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString('mn-MN')}</p></div>)}
      </Card>
    </div>
  );
}

function ListSection({ section }) {
  const config = resources[section] || resources.organizations;
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOrg, setModalOrg] = useState(null);
  const [detailId, setDetailId] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 20, search };
      if (filter) params.status = filter;
      setData(await fetchSuperAdminList(config.endpoint, params));
    } catch (err) {
      setError(err.message || `${config.title} ачааллахад алдаа гарлаа.`);
    } finally {
      setLoading(false);
    }
  }, [config.endpoint, config.title, filter, page, search]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  if (detailId) return <OrganizationDetail organizationId={detailId} onBack={() => setDetailId('')} />;
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  const items = getItems(data);
  return (
    <div className="space-y-4">
      <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); setPage(1); load(); }}>
        <input className="rounded-lg border px-3 py-2" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search" />
        {['organizations', 'notifications', 'support'].includes(section) && <input className="rounded-lg border px-3 py-2" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Status filter" />}
        <button className="btn">Хайх</button>
      </form>
      {items.length === 0 ? <EmptyState /> : <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Name/ID</th><th>Status</th><th>Context</th><th>Created</th><th /></tr></thead>
            <tbody>
              {items.map(item => <tr key={item.id} className="border-t">
                <td className="py-3 font-semibold">{item.name || item.email || item.eventType || item.action || item.id}<p className="text-xs font-normal text-slate-500">{item.slug || item.organization?.name || item.organizationId || item.channel || item.targetType}</p></td>
                <td>{item.status || item.role || item.plan || '—'}</td>
                <td>{item.description || item.reason || item.lastError || item.requesterEmail || item.billingCycle || '—'}</td>
                <td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('mn-MN') : item.lastCheckedAt ? new Date(item.lastCheckedAt).toLocaleString('mn-MN') : '—'}</td>
                <td className="text-right">{section === 'organizations' && <><button className="btn mr-2" onClick={() => setDetailId(item.id)}>Detail</button><button className="btn" onClick={() => setModalOrg(item)}>Status</button></>}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </Card>}
      <Pager data={data} page={page} setPage={setPage} />
      {modalOrg && <OrganizationActionModal organization={modalOrg} onClose={() => setModalOrg(null)} onSaved={load} />}
    </div>
  );
}

function PlanModal({ plan, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    name: plan?.name || '',
    slug: plan?.slug || '',
    description: plan?.description || '',
    price: plan?.price || 0,
    currency: plan?.currency || 'MNT',
    billingCycle: plan?.billingCycle || 'monthly',
    maxUsers: plan?.maxUsers || 100,
    maxCourses: plan?.maxCourses || 50,
    featuresJson: plan?.featuresJson || '{}',
    isActive: plan?.isActive ?? true,
    reason: '',
  }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const change = event => {
    const { name, value, type, checked } = event.target;
    setForm(current => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };
  const submit = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        maxUsers: Number(form.maxUsers),
        maxCourses: Number(form.maxCourses),
        featuresJson: form.featuresJson?.trim() || '{}',
      };
      if (plan?.id) await updateSuperAdminPlan(plan.id, payload);
      else await createSuperAdminPlan(payload);
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Plan хадгалахад алдаа гарлаа.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
      <form onSubmit={submit} className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold">{plan ? 'Plan засах' : 'Plan нэмэх'}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Name<input className="mt-1 w-full rounded-lg border px-3 py-2" name="name" value={form.name} onChange={change} required /></label>
          <label className="text-sm">Slug<input className="mt-1 w-full rounded-lg border px-3 py-2" name="slug" value={form.slug} onChange={change} required disabled={Boolean(plan)} /></label>
          <label className="text-sm">Price<input type="number" min="0" className="mt-1 w-full rounded-lg border px-3 py-2" name="price" value={form.price} onChange={change} required /></label>
          <label className="text-sm">Currency<input className="mt-1 w-full rounded-lg border px-3 py-2" name="currency" value={form.currency} onChange={change} maxLength={3} required /></label>
          <label className="text-sm">Billing cycle<select className="mt-1 w-full rounded-lg border px-3 py-2" name="billingCycle" value={form.billingCycle} onChange={change}><option>monthly</option><option>quarterly</option><option>yearly</option><option>four_year</option></select></label>
          <label className="text-sm">Max users<input type="number" min="1" className="mt-1 w-full rounded-lg border px-3 py-2" name="maxUsers" value={form.maxUsers} onChange={change} /></label>
          <label className="text-sm">Max courses<input type="number" min="0" className="mt-1 w-full rounded-lg border px-3 py-2" name="maxCourses" value={form.maxCourses} onChange={change} /></label>
          <label className="flex items-center gap-2 pt-7 text-sm"><input type="checkbox" name="isActive" checked={form.isActive} onChange={change} /> Active</label>
        </div>
        <label className="mt-3 block text-sm">Description<textarea className="mt-1 min-h-20 w-full rounded-lg border px-3 py-2" name="description" value={form.description} onChange={change} /></label>
        <label className="mt-3 block text-sm">Features JSON<textarea className="mt-1 min-h-24 w-full rounded-lg border px-3 py-2 font-mono text-xs" name="featuresJson" value={form.featuresJson} onChange={change} /></label>
        <label className="mt-3 block text-sm">Reason<input className="mt-1 w-full rounded-lg border px-3 py-2" name="reason" value={form.reason} onChange={change} /></label>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>Болих</button><button disabled={saving} className="btn bg-primary text-white">{saving ? 'Хадгалж байна...' : 'Хадгалах'}</button></div>
      </form>
    </div>
  );
}

function PlansSection() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await fetchSuperAdminList('plans', { page, limit: 20 }));
    } catch (err) {
      setError(err.message || 'Plans ачааллахад алдаа гарлаа.');
    } finally {
      setLoading(false);
    }
  }, [page]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  const items = getItems(data);
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button className="btn bg-primary text-white" onClick={() => setEditing({})}>Plan нэмэх</button></div>
      {items.length === 0 ? <EmptyState /> : <div className="grid gap-3 lg:grid-cols-2">
        {items.map(plan => <Card key={plan.id} title={plan.name} subtitle={plan.slug} right={<button className="btn" onClick={() => setEditing(plan)}>Засах</button>}>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p>Үнэ: <b>{money(plan.price)} {plan.currency}</b></p>
            <p>Cycle: <b>{plan.billingCycle}</b></p>
            <p>Users: <b>{plan.maxUsers}</b></p>
            <p>Courses: <b>{plan.maxCourses}</b></p>
            <p>Status: <b>{plan.isActive ? 'ACTIVE' : 'INACTIVE'}</b></p>
          </div>
        </Card>)}
      </div>}
      <Pager data={data} page={page} setPage={setPage} />
      {editing && <PlanModal plan={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}

export default function SuperAdmin({ section = 'overview' }) {
  const config = resources[section] || { title: 'Overview', subtitle: 'Platform control plane overview.' };
  const content = useMemo(() => {
    if (section === 'overview') return <Overview />;
    if (section === 'plans' || section === 'settings') return <PlansSection />;
    return <ListSection section={section} />;
  }, [section]);
  return (
    <div className="space-y-6">
      <PageHeader title={section === 'overview' ? 'Super Admin Overview' : config.title} subtitle={config.subtitle} showBack={false} right={<Link className="text-primary" to="/platform/audit">Audit logs</Link>} />
      {content}
    </div>
  );
}
