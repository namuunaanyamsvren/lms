import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { buildGoogleLoginUrl } from '../../services/googleOAuth';
import { resolveTenant } from '../../services/tenantResolution';

const defaultTenant = 'mongol-erdem';

export default function Register() {
  const navigate = useNavigate();
  const { register, loading, error: authError } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState(null);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLocalError(null);
    if (password !== confirmPassword) {
      setLocalError('Нууц үг таарахгүй байна');
      return;
    }
    const [firstName, ...rest] = fullName.trim().split(/\s+/);
    const lastName = rest.join(' ') || firstName;
    try{const tenant=await resolveTenant(defaultTenant);const result = await register({
      email: email.trim(),
      phone: phone.trim() || undefined,
      password,
      firstName,
      lastName,
      role: 'user',
      organizationId:tenant.id,
    });
    if (result.success) navigate(result.redirectPath, { replace: true });}catch(error){setLocalError(error.message||'Байгууллагыг тодорхойлж чадсангүй.');}
  };

  const handleGoogleRegister = () => {
    try {
      setLocalError(null);
      resolveTenant(defaultTenant).then(tenant=>window.location.assign(buildGoogleLoginUrl(tenant.id))).catch(error=>setLocalError(error.message));
    } catch (error) {
      setLocalError(error.message);
    }
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-md">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Бүртгүүлэх</h1>
        <p className="text-sm text-gray-500 mt-1">LMS системд шинээр хэрэглэгчийн бүртгэл үүсгэх.</p>
      </div>
      {(localError || authError) && (
        <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {localError || authError}
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Овог Нэр</label>
          <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-2 block w-full rounded-lg border border-gray-200 px-4 py-3 focus:ring-2 focus:ring-primary/40 focus:outline-none" placeholder="Бат Болд" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">И-мэйл хаяг</label>
            <input required value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" className="mt-2 block w-full rounded-lg border border-gray-200 px-4 py-3 focus:ring-2 focus:ring-primary/40 focus:outline-none" placeholder="you@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Утас</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" autoComplete="tel" className="mt-2 block w-full rounded-lg border border-gray-200 px-4 py-3 focus:ring-2 focus:ring-primary/40 focus:outline-none" placeholder="+97699112233" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Нууц үг</label>
            <input required value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="mt-2 block w-full rounded-lg border border-gray-200 px-4 py-3 focus:ring-2 focus:ring-primary/40 focus:outline-none" placeholder="••••••••" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Нууц үг баталгаажуулах</label>
            <input required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" className="mt-2 block w-full rounded-lg border border-gray-200 px-4 py-3 focus:ring-2 focus:ring-primary/40 focus:outline-none" placeholder="••••••••" />
          </div>
        </div>

        <div>
          <button type="submit" disabled={loading} className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:brightness-95 transition">
            {loading ? 'Үүсгэж байна...' : 'Бүртгэл үүсгэх'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <div className="text-xs text-gray-400">эсвэл дараах хаягаар бүртгүүлэх</div>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button type="button" onClick={handleGoogleRegister} disabled={loading} className="flex items-center justify-center gap-3 rounded-lg border border-gray-200 py-2 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2">
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
          Бүртгэлтэй юу? <a href="/login" className="font-semibold text-primary">Нэвтрэх</a>
        </p>
      </form>
    </div>
  );
}
