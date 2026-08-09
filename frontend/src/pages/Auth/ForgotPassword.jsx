import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authRequest } from '../../services/apiClient';
import { resolveTenant } from '../../services/tenantResolution';

const defaultTenant = 'mongol-erdem';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('');
    setLoading(true);
    try {
      const tenant = await resolveTenant(defaultTenant);
      const response = await authRequest({
        url: '/auth/forgot-password',
        method: 'POST',
        data: { organizationId: tenant.id, email: email.trim() },
      });
      setStatus(response.data?.message || 'Нууц үг сэргээх зааврыг имэйлээр илгээлээ.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Хүсэлт илгээхэд алдаа гарлаа.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white p-6 shadow-md sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Нууц үг сэргээх</h1>
        <p className="mt-1 text-sm text-gray-500">Бүртгэлтэй и-мэйл хаягаа оруулна уу.</p>
      </div>
      {status && <div role="status" className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{status}</div>}
      {error && <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700">И-мэйл хаяг</label>
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="mt-2 block w-full rounded-lg border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/40"
            placeholder="you@example.com"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center rounded-lg bg-primary py-3 font-medium text-white transition hover:brightness-95 disabled:opacity-60"
        >
          {loading ? 'Илгээж байна...' : 'Сэргээх заавар авах'}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-gray-500">
        <Link to="/login" className="font-semibold text-primary">Нэвтрэх хуудас руу буцах</Link>
      </p>
    </div>
  );
}
