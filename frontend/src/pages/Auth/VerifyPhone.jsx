import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../services/apiClient';

export default function VerifyPhone() {
  const navigate = useNavigate();
  const {
    completePhoneVerification,
    isAuthenticated,
    isBootstrapping,
    user,
  } = useAuth();
  const [otp, setOtp] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  const send = async () => {
    setStatus('loading');
    try {
      const response = await apiClient.post('/auth/send-phone-verification');
      setStatus('sent');
      setMessage(response.data?.message || 'SMS код илгээлээ.');
    } catch (error) {
      setStatus('error');
      setMessage(error.response?.data?.message || 'SMS код илгээхэд алдаа гарлаа.');
    }
  };

  const verify = async event => {
    event.preventDefault();
    setStatus('loading');
    try {
      const response = await apiClient.post('/auth/verify-phone', { otp });
      setStatus('success');
      setMessage(response.data?.message || 'Утасны дугаар амжилттай баталгаажлаа.');
      const session = await completePhoneVerification();
      navigate(session.redirectPath, { replace: true });
    } catch (error) {
      setStatus('error');
      setMessage(error.response?.data?.message || 'Код хүчингүй эсвэл хугацаа дууссан.');
    }
  };

  if (isBootstrapping) {
    return <p className="text-center text-sm text-gray-500">Session шалгаж байна...</p>;
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="space-y-6 text-center">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Утас баталгаажуулах</h1>
        <p className="mt-2 text-sm text-gray-500">
          {user?.phone
            ? `${user.phone} дугаарт ирсэн нэг удаагийн кодыг оруулна уу.`
            : 'Бүртгэлдээ утасны дугаар нэмээд дахин оролдоно уу.'}
        </p>
      </div>

      {message && (
        <div className={`rounded-lg p-3 text-sm ${
          status === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
        }`}>
          {message}
        </div>
      )}

      <button
        type="button"
        disabled={status === 'loading' || !user?.phone}
        onClick={send}
        className="w-full rounded-xl border border-indigo-200 py-3 font-semibold text-indigo-700 disabled:opacity-50"
      >
        SMS код илгээх
      </button>

      <form className="space-y-3" onSubmit={verify}>
        <label className="block text-left text-sm font-medium text-gray-700" htmlFor="phone-otp">
          Баталгаажуулах код
        </label>
        <input
          id="phone-otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={otp}
          onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, 8))}
          minLength={6}
          maxLength={8}
          required
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-center tracking-[0.35em]"
        />
        <button
          type="submit"
          disabled={status === 'loading' || otp.length < 6}
          className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white disabled:opacity-50"
        >
          {status === 'loading' ? 'Шалгаж байна...' : 'Утас баталгаажуулах'}
        </button>
      </form>
    </div>
  );
}
