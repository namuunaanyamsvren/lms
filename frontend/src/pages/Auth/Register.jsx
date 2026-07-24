import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building, Lock, Mail, User } from 'lucide-react';
import AuthDivider from '../../components/auth/AuthDivider';
import AuthInput from '../../components/auth/AuthInput';
import AuthSelect from '../../components/auth/AuthSelect';
import AuthSocialButtons from '../../components/auth/AuthSocialButtons';
import AuthSubmitButton from '../../components/auth/AuthSubmitButton';
import { useAuth } from '../../context/AuthContext';

export default function Register() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('student');
  const [organizationId, setOrganizationId] = useState('org_main');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();
  const { register, loading } = useAuth();

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (password !== confirmPassword) {
      setErrorMsg('Нууц үг таарахгүй байна');
      return;
    }
    if (!agreed) {
      setErrorMsg('Үйлчилгээний нөхцөлийг зөвшөөрнө үү');
      return;
    }

    try {
      const res = await register({
        email,
        password,
        firstName: firstName || 'Хэрэглэгч',
        lastName: lastName || 'Овог',
        role,
        organizationId,
      });

      if (res.success) {
        navigate(res.redirectPath);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Сүлжээний алдаа эсвэл backend холбогдоогүй байна');
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Шинэ бүртгэл үүсгэх</h1>
        <p className="mt-2 text-sm text-gray-500">
          LMS системд бүртгүүлж, сургалтын аяллаа эхлүүлээрэй.
        </p>
      </div>

      {errorMsg && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-4">
        <AuthInput
          id="organizationId"
          label="Байгууллагын ID"
          type="text"
          icon={Building}
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
          placeholder="org_main"
          required
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AuthInput
            id="lastName"
            label="Овог"
            type="text"
            icon={User}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Дорж"
            required
          />

          <AuthInput
            id="firstName"
            label="Нэр"
            type="text"
            icon={User}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Болд"
            required
          />
        </div>

        <AuthInput
          id="email"
          label="Имэйл хаяг"
          type="email"
          icon={Mail}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          required
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          <AuthInput
            id="confirmPassword"
            label="Нууц үг давтах"
            type="password"
            icon={Lock}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        <AuthSelect
          id="role"
          label="Сонгох Эрх / Сул орон тоо"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="student">Оюутан / Суралцагч (/student)</option>
          <option value="teacher">Багш / Сургагч (/teacher)</option>
          <option value="admin">Админ / Зохион байгуулагч (/admin)</option>
          <option value="parent">Эцэг эх / Асран хамгаалагч (/parent)</option>
          <option value="staff">Ажилтан (/staff)</option>
          <option value="principal">Захирал / Тэргүүн (/principal)</option>
        </AuthSelect>

        <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span>
            Би{' '}
            <a href="#terms" className="font-medium text-indigo-600 hover:underline">
              үйлчилгээний нөхцөл
            </a>{' '}
            болон{' '}
            <a href="#privacy" className="font-medium text-indigo-600 hover:underline">
              нууцлалын бодлого
            </a>
            -ыг зөвшөөрч байна.
          </span>
        </label>

        <AuthSubmitButton loading={loading} loadingText="Бүртгэж байна...">
          Бүртгүүлэх
        </AuthSubmitButton>

        <AuthDivider text="ЭСВЭЛ" />

        <AuthSocialButtons />

        <p className="text-center text-sm text-gray-500">
          Бүртгэлтэй юу?{' '}
          <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
            Нэвтрэх
          </Link>
        </p>
      </form>
    </div>
  );
}
