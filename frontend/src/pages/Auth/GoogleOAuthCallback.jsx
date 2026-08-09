import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const oauthErrorMessages = {
  access_denied: 'Google нэвтрэлтийг цуцалсан байна.',
  missing_code: 'Google баталгаажуулах код ирсэнгүй.',
  organization_unavailable: 'Сонгосон байгууллага идэвхгүй эсвэл олдсонгүй.',
  authentication_failed: 'Google-ээр нэвтрэх үед алдаа гарлаа. Дахин оролдоно уу.',
};

export default function GoogleOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { completeGoogleLogin } = useAuth();
  const started = useRef(false);
  const [exchangeError, setExchangeError] = useState(null);
  const providerError = searchParams.get('error');
  const code = searchParams.get('code');
  const queryError = providerError
    ? oauthErrorMessages[providerError] || oauthErrorMessages.authentication_failed
    : !code
      ? oauthErrorMessages.missing_code
      : null;
  const error = queryError || exchangeError;

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (providerError || !code) return;

    void completeGoogleLogin(code).then(result => {
      if (result.success) {
        navigate(result.redirectPath, { replace: true });
      } else {
        setExchangeError(result.message || oauthErrorMessages.authentication_failed);
      }
    });
  }, [code, completeGoogleLogin, navigate, providerError]);

  return (
    <div className="rounded-2xl bg-white p-6 text-center shadow-md sm:p-8">
      {error ? (
        <>
          <h1 className="text-xl font-bold text-gray-900">Google нэвтрэлт амжилтгүй</h1>
          <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>
          <Link className="mt-6 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white" to="/login">
            Нэвтрэх хуудас руу буцах
          </Link>
        </>
      ) : (
        <>
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
          <h1 className="mt-4 text-xl font-bold text-gray-900">Google нэвтрэлтийг дуусгаж байна</h1>
          <p className="mt-2 text-sm text-gray-500">Түр хүлээнэ үү…</p>
        </>
      )}
    </div>
  );
}
