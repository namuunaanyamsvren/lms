import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authRequest } from '../../services/apiClient';
import {
  getPasswordMinimumLength,
  validatePasswordForForm,
} from '../../utils/passwordPolicy';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async event => {
    event.preventDefault();
    setError('');
    const policyError = validatePasswordForForm(password);
    if (policyError) {
      setError(policyError);
      return;
    }
    if (password !== confirmation) {
      setError('Нууц үг таарахгүй байна.');
      return;
    }
    const token = searchParams.get('token');
    if (!token) {
      setError('Нууц үг сэргээх token байхгүй байна.');
      return;
    }

    setLoading(true);
    try {
      await authRequest({
        url: '/auth/reset-password',
        method: 'POST',
        data: { token, newPassword: password },
      });
      setPassword('');
      setConfirmation('');
      setSuccess(true);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Нууц үг шинэчлэхэд алдаа гарлаа.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Нууц үг шинэчлэгдлээ</h1>
        <Link className="font-semibold text-indigo-600" to="/login">
          Нэвтрэх хуудас руу очих
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Нууц үг шинэчлэх</h1>
        <p className="mt-2 text-sm text-gray-500">
          Доод тал нь {getPasswordMinimumLength()} тэмдэгттэй нууц үг сонгоно уу.
        </p>
      </div>
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">Шинэ нууц үг</label>
        <input
          id="newPassword"
          type="password"
          value={password}
          onChange={event => setPassword(event.target.value)}
          minLength={getPasswordMinimumLength()}
          maxLength={128}
          required
          className="mt-2 block w-full rounded-lg border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="••••••••"
        />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Шинэ нууц үг давтах</label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmation}
          onChange={event => setConfirmation(event.target.value)}
          minLength={getPasswordMinimumLength()}
          maxLength={128}
          required
          className="mt-2 block w-full rounded-lg border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="••••••••"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center rounded-lg bg-primary py-3 font-medium text-white transition hover:brightness-95 disabled:opacity-60"
      >
        {loading ? 'Шинэчилж байна...' : 'Нууц үг шинэчлэх'}
      </button>
    </form>
  );
}
