import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Laptop,
  LogOut,
  RefreshCw,
  ShieldOff,
} from 'lucide-react';
import {
  fetchActiveSessions,
  logoutAllSessions,
  revokeActiveSession,
} from '../../services/sessionApi';
import { formatDate, formatDateTime } from '../../utils/formatDate';
import EmptyState from '../ui/EmptyState';
import SkeletonLoader from '../ui/SkeletonLoader';

export const summarizeUserAgent = userAgent => {
  if (!userAgent) return 'Browser мэдээлэл байхгүй';
  const browser = userAgent.includes('Edg/')
    ? 'Microsoft Edge'
    : userAgent.includes('Firefox/')
      ? 'Firefox'
      : userAgent.includes('Chrome/')
        ? 'Chrome'
        : userAgent.includes('Safari/')
          ? 'Safari'
          : 'Тодорхойгүй browser';
  const platform = /iPhone|iPad/.test(userAgent)
    ? 'iOS'
    : userAgent.includes('Android')
      ? 'Android'
      : userAgent.includes('Mac OS')
        ? 'macOS'
        : userAgent.includes('Windows')
          ? 'Windows'
          : userAgent.includes('Linux')
            ? 'Linux'
            : 'Тодорхойгүй OS';
  return `${browser} • ${platform}`;
};

const safeDateTime = value => {
  if (!value || Number.isNaN(new Date(value).getTime())) return '—';
  return formatDateTime(value);
};

export default function ActiveSessions({ onSessionTerminated }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingAction, setPendingAction] = useState('');
  const [confirmation, setConfirmation] = useState(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setSessions(await fetchActiveSessions());
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
        'Идэвхтэй session-уудыг ачаалж чадсангүй.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchActiveSessions()
      .then(result => {
        if (active) setSessions(result);
      })
      .catch(requestError => {
        if (active) {
          setError(
            requestError.response?.data?.message ||
            'Идэвхтэй session-уудыг ачаалж чадсангүй.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!confirmation) return undefined;
    const closeOnEscape = event => {
      if (event.key === 'Escape' && !pendingAction) setConfirmation(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [confirmation, pendingAction]);

  const requestRevoke = session => {
    setError('');
    setSuccess('');
    setConfirmation({ type: 'revoke', session });
  };

  const confirmRevoke = async () => {
    const session = confirmation?.session;
    if (!session || pendingAction) return;
    setPendingAction(`revoke:${session.id}`);
    setError('');
    try {
      await revokeActiveSession(session.id);
      setConfirmation(null);
      if (session.current) {
        onSessionTerminated?.('current-session-revoked');
        return;
      }
      setSessions(current => current.filter(item => item.id !== session.id));
      setSuccess('Session амжилттай цуцлагдлаа.');
    } catch (requestError) {
      setConfirmation(null);
      setError(requestError.response?.data?.message || 'Session цуцлахад алдаа гарлаа.');
    } finally {
      setPendingAction('');
    }
  };

  const confirmLogoutAll = async () => {
    if (pendingAction) return;
    setPendingAction('logout-all');
    setError('');
    try {
      await logoutAllSessions();
      setConfirmation(null);
      onSessionTerminated?.('all-sessions-revoked');
    } catch (requestError) {
      setConfirmation(null);
      setError(requestError.response?.data?.message || 'Бүх session-оос гарахад алдаа гарлаа.');
    } finally {
      setPendingAction('');
    }
  };

  const confirmationBusy = Boolean(pendingAction);
  const currentRevoke = confirmation?.type === 'revoke' && confirmation.session?.current;

  return (
    <section
      aria-labelledby="active-sessions-title"
      className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3
            id="active-sessions-title"
            className="text-lg font-semibold text-slate-900"
          >
            Идэвхтэй төхөөрөмжүүд
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Таны бүртгэлд нэвтэрсэн browser болон төхөөрөмжүүд.
          </p>
        </div>
        <button
          type="button"
          disabled={loading || confirmationBusy || sessions.length === 0}
          onClick={() => {
            setError('');
            setSuccess('');
            setConfirmation({ type: 'logout-all' });
          }}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LogOut size={16} />
          Бүх төхөөрөмжөөс гарах
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          {!loading && (
            <button
              type="button"
              onClick={loadSessions}
              className="inline-flex items-center gap-1 font-semibold underline"
            >
              <RefreshCw size={14} /> Дахин оролдох
            </button>
          )}
        </div>
      )}
      {success && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700"
        >
          <CheckCircle2 size={18} /> {success}
        </div>
      )}

      {loading ? (
        <div
          role="status"
          aria-label="Session-уудыг ачаалж байна"
          className="mt-5 space-y-3"
        >
          <SkeletonLoader variant="card" />
          <SkeletonLoader variant="card" />
        </div>
      ) : sessions.length === 0 && !error ? (
        <EmptyState
          className="mt-5"
          title="Идэвхтэй session алга"
          description="Таны бүртгэлд идэвхтэй төхөөрөмж бүртгэгдээгүй байна."
          icon={<ShieldOff size={26} />}
        />
      ) : (
        <ul className="mt-5 space-y-3">
          {sessions.map(session => (
            <li
              key={session.id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Laptop size={18} className="shrink-0 text-indigo-600" />
                    <p className="font-semibold text-slate-900">
                      {session.deviceName}
                    </p>
                    {session.current && (
                      <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                        Энэ төхөөрөмж
                      </span>
                    )}
                    {session.revokedAt && (
                      <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        Цуцлагдсан
                      </span>
                    )}
                  </div>
                  <p className="mt-1 break-words text-sm text-slate-500">
                    {summarizeUserAgent(session.userAgent)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={confirmationBusy || Boolean(session.revokedAt)}
                  onClick={() => requestRevoke(session)}
                  aria-label={`${session.deviceName} session-ийг цуцлах`}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {session.current ? 'Энэ төхөөрөмжөөс гарах' : 'Session цуцлах'}
                </button>
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">IP</dt>
                  <dd className="mt-1 text-slate-700">{session.ipAddress}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Үүссэн</dt>
                  <dd className="mt-1 text-slate-700">
                    {safeDateTime(session.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Сүүлд идэвхтэй</dt>
                  <dd className="mt-1 text-slate-700">
                    {session.lastUsedAt ? formatDate(session.lastUsedAt) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Дуусах хугацаа</dt>
                  <dd className="mt-1 text-slate-700">
                    {safeDateTime(session.expiresAt)}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}

      {confirmation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget && !confirmationBusy) {
              setConfirmation(null);
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="session-dialog-title"
            aria-describedby="session-dialog-description"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <h4
              id="session-dialog-title"
              className="text-lg font-semibold text-slate-900"
            >
              {confirmation.type === 'logout-all'
                ? 'Бүх төхөөрөмжөөс гарах уу?'
                : currentRevoke
                  ? 'Энэ төхөөрөмжийн session-ийг цуцлах уу?'
                  : 'Session-ийг цуцлах уу?'}
            </h4>
            <p
              id="session-dialog-description"
              className="mt-2 text-sm leading-6 text-slate-600"
            >
              {confirmation.type === 'logout-all' || currentRevoke
                ? 'Энэ үйлдлийн дараа таны одоогийн session хаагдаж, дахин нэвтрэх шаардлагатай.'
                : `${confirmation.session.deviceName} төхөөрөмж дахин нэвтрэх шаардлагатай болно.`}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                autoFocus
                disabled={confirmationBusy}
                onClick={() => setConfirmation(null)}
                className="min-h-10 rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50"
              >
                Болих
              </button>
              <button
                type="button"
                disabled={confirmationBusy}
                onClick={confirmation.type === 'logout-all' ? confirmLogoutAll : confirmRevoke}
                className="min-h-10 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {confirmationBusy ? 'Хийж байна…' : 'Баталгаажуулах'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
