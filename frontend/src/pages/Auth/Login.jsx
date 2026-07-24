import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, User, Building } from 'lucide-react';
import AuthDivider from '../../components/auth/AuthDivider';
import AuthInput from '../../components/auth/AuthInput';
import AuthSocialButtons from '../../components/auth/AuthSocialButtons';
import AuthSubmitButton from '../../components/auth/AuthSubmitButton';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [organizationId, setOrganizationId] = useState('org_main');
  const [remember, setRemember] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();
  const { login, loading } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await login({ identifier, password, organizationId });
      if (res.success) {
        navigate(res.redirectPath);
      } else {
        setErrorMsg(res.message || 'Нэвтрэх нэр эсвэл нууц үг буруу байна');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Сүлжээний алдаа эсвэл backend холбогдоогүй байна');
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Тавтай морилно уу</h1>
        <p className="mt-2 text-sm text-gray-500">
          Таны данс руу нэвтрэхийн тулд мэдээллээ оруулна уу.
        </p>
      </div>

      {errorMsg && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthInput
          id="organizationId"
          label="Байгууллагын ID (Organization ID)"
          type="text"
          icon={Building}
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
          placeholder="org_main"
          required
        />

        <AuthInput
          id="identifier"
          label="Имэйл / Нэвтрэх нэр / Утасны дугаар"
          type="text"
          icon={User}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="admin, student@lms.mn, эсвэл 99112233"
          required
        />

        <AuthInput
          id="password"
          label="Нууц үг"
          type="password"
          icon={Lock}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />

        <div className="flex items-center justify-between text-sm">
          <label className="inline-flex cursor-pointer items-center gap-2 text-gray-600">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>Намайг сана</span>
          </label>
          <a href="#forgot" className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline">
            Нууц үг сэргээх
          </a>
        </div>

        <AuthSubmitButton loading={loading} loadingText="Нэвтэрч байна...">
          Нэвтрэх
        </AuthSubmitButton>

        <AuthDivider text="ЭСВЭЛ" />

        <AuthSocialButtons />

        <p className="text-center text-sm text-gray-500">
          Бүртгэлгүй юу?{' '}
          <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-700">
            Шинэ бүртгэл үүсгэх
          </Link>
        </p>
      </form>
    </div>
  );
}
