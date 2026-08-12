import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { buildGoogleLoginUrl } from '../../services/googleOAuth';
import { inferredTenantKey, normalizeTenantKey, resolveTenant } from '../../services/tenantResolution';

const demoAccounts = [
  { label: 'Менежер', email: 'admin@lms.mn' },
  { label: 'Багш', email: 'teacher@lms.mn' },
  { label: 'Сурагч', email: 'student@lms.mn' },
  { label: 'Эцэг эх', email: 'parent@lms.mn' },
  { label: 'Захирал', email: 'principal@lms.mn' },
  { label: 'Хэрэглэгч', email: 'user@lms.mn' },
];
const demoPassword = 'password123';
const demoTenant = 'mongol-erdem';
const demoLoginEnabled = import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true';

export const resolveLoginTenantKey = locationState => {
  const stateTenant = normalizeTenantKey(locationState?.tenantSlug);
  return stateTenant || inferredTenantKey() || demoTenant;
};

export default function Login() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { login, loading, error: authError } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [localError, setLocalError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    try{const tenant=await resolveTenant(resolveLoginTenantKey(location.state));
      const result = await login({organizationId:tenant.id,identifier:identifier.trim(),password});
      if (result.success) {
        const redirectPath = location.state?.organizationCreated && result.redirectPath === '/admin'
          ? '/admin/billing'
          : result.redirectPath;
        navigate(redirectPath, { replace: true });
      }
    }catch(error){setLocalError(error.message||'Байгууллагыг тодорхойлж чадсангүй.');}
  };

  const handleGoogleLogin = () => {
    try {
      setLocalError(null);
      resolveTenant(resolveLoginTenantKey(location.state))
        .then(tenant=>window.location.assign(buildGoogleLoginUrl(tenant.id)))
        .catch(error=>setLocalError(error.message));
    } catch (error) {
      setLocalError(error.message);
    }
  };

  const fillDemoAccount = (account) => {
    setIdentifier(account.email);
    setPassword(demoPassword);
    setLocalError(null);
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-md">
      {searchParams.get('reason') === 'session-expired' && <div role="alert" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Таны session дууссан. Аюулгүй байдлын үүднээс дахин нэвтэрнэ үү.</div>}
      {(localError || authError) && <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{localError || authError}</div>}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Нэвтрэх</h1>
        <p className="text-sm text-gray-500 mt-1">Таны данс руу нэвтрэхийн тулд мэдээллээ оруулна уу.</p>
      </div>

      {demoLoginEnabled && (
        <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-700">Demo байгууллага: {demoTenant}</p>
            <p className="text-[11px] text-slate-500">Нууц үг: {demoPassword}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {demoAccounts.map(account => (
              <button
                key={account.email}
                type="button"
                onClick={() => fillDemoAccount(account)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
              >
                {account.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="identifier" className="block text-sm font-medium text-gray-700">И-мэйл эсвэл утас</label>
          <input
            id="identifier"
            type="text"
            inputMode="email"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            className="mt-2 block w-full rounded-lg border border-gray-200 px-4 py-3 focus:ring-2 focus:ring-primary/40 focus:outline-none"
            placeholder="you@example.com эсвэл +97699112233"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">Нууц үг</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-2 block w-full rounded-lg border border-gray-200 px-4 py-3 focus:ring-2 focus:ring-primary/40 focus:outline-none"
            placeholder="••••••••"
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="inline-flex items-center gap-2 text-gray-600">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary" />
            <span>Намайг сана</span>
          </label>

          <Link to="/forgot-password" className="text-primary hover:underline">Нууц үг мартсан уу?</Link>
        </div>

        <div>
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-3 bg-primary text-white py-3 rounded-lg font-medium hover:brightness-95 active:scale-[0.995] transition"
            disabled={loading}
          >
            {loading ? 'Нэвтэрч байна...' : 'Нэвтрэх'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <div className="text-xs text-gray-400">эсвэл дараах хаягаар нэвтрэх</div>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button type="button" onClick={handleGoogleLogin} disabled={loading} className="flex items-center justify-center gap-3 rounded-lg border border-gray-200 py-2 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21.805 10.023h-9.78v3.956h5.6c-.244 1.337-1.06 2.469-2.264 3.2v2.657h3.656c2.141-1.974 3.38-4.897 3.38-8.713 0-.588-.05-1.158-.298-1.996z" fill="#4285F4"/>
              <path d="M12.025 22c2.97 0 5.48-.98 7.28-2.66l-3.66-2.83c-1.01.68-2.3 1.09-3.62 1.09-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 22 12.025 22z" fill="#34A853"/>
              <path d="M5.86 14.08c-.28-.84-.44-1.75-.44-2.68 0-.93.16-1.84.44-2.68V6.03H2.18A9.984 9.984 0 0 0 1 12c0 1.86.43 3.63 1.18 5.17l3.68-3.09z" fill="#FBBC05"/>
              <path d="M12.025 4.5c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.91 14.97 0.88 12.025 0.88 7.7 0.88 3.99 3.35 2.18 6.95l3.66 2.84C8.97 6.43 11.41 4.5 12.025 4.5z" fill="#EA4335"/>
            </svg>
            <span className="text-sm">Google</span>
          </button>
        </div>

        <p className="text-center text-sm text-gray-500 mt-1">
          Бүртгэлгүй юу? <a href="/register" className="font-semibold text-primary">Бүртгүүлэх</a>
        </p>
      </form>
    </div>
  );
}
