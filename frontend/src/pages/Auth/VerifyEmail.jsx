import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiClient, authRequest } from '../../services/apiClient';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    completeEmailVerification,
    isAuthenticated,
    isBootstrapping,
    user,
  } = useAuth();
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  const verify = async () => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Баталгаажуулах token байхгүй байна.');
      return;
    }
    setStatus('loading');
    try {
      const result = await authRequest({
        url: '/auth/verify',
        method: 'POST',
        data: { token },
      });
      setStatus('success');
      setMessage(result.message || 'Имэйл амжилттай баталгаажлаа.');
      if (isAuthenticated) {
        const session = await completeEmailVerification();
        navigate(session.redirectPath, { replace: true });
      }
    } catch (error) {
      setStatus('error');
      setMessage(error.response?.data?.message || 'Баталгаажуулах холбоос хүчингүй байна.');
    }
  };

  const resend = async () => {
    setStatus('loading');
    try {
      const response = await apiClient.post('/auth/send-verification', { type: 'EMAIL' });
      setStatus('sent');
      setMessage(response.data?.message || 'Баталгаажуулах зааврыг илгээлээ.');
    } catch (error) {
      setStatus('error');
      setMessage(error.response?.data?.message || 'Дахин илгээхэд алдаа гарлаа.');
    }
  };

  if (isBootstrapping) {
    return <p className="text-center text-sm text-gray-500">Session шалгаж байна...</p>;
  }

  return (
    <div className="space-y-6 text-center">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Имэйл баталгаажуулах</h1>
        <p className="mt-2 text-sm text-gray-500">
          {user?.email
            ? `${user.email} хаягаа баталгаажуулсны дараа байгууллагын хэсэгт нэвтэрнэ.`
            : 'Баталгаажуулах холбоосоо шалгана уу.'}
        </p>
      </div>

      {message && (
        <div className={`rounded-lg p-3 text-sm ${
          status === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
        }`}>
          {message}
        </div>
      )}

      {searchParams.get('token') && status !== 'success' && (
        <button
          type="button"
          disabled={status === 'loading'}
          onClick={verify}
          className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white disabled:opacity-50"
        >
          {status === 'loading' ? 'Баталгаажуулж байна...' : 'Имэйл баталгаажуулах'}
        </button>
      )}

      {isAuthenticated && user?.verificationRequired && (
        <button
          type="button"
          disabled={status === 'loading'}
          onClick={resend}
          className="w-full rounded-xl border border-indigo-200 py-3 font-semibold text-indigo-700 disabled:opacity-50"
        >
          Баталгаажуулах имэйл дахин илгээх
        </button>
      )}

      {!isAuthenticated && (
        <Link className="font-semibold text-indigo-600" to="/login">
          Нэвтрэх хуудас руу очих
        </Link>
      )}
    </div>
  );
}
