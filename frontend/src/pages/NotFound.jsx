import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRoleRedirectPath } from '../context/AuthContext';

export default function NotFound() {
  const { user } = useAuth();
  const destination = user ? getRoleRedirectPath(user.role) : '/';

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="text-center">
        <p className="text-7xl font-bold text-indigo-600">404</p>
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Хуудас олдсонгүй</h1>
        <p className="mt-2 text-slate-500">Таны нээсэн холбоос байхгүй эсвэл шилжсэн байна.</p>
        <Link
          to={destination}
          className="mt-6 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Нүүр хуудас руу буцах
        </Link>
      </div>
    </main>
  );
}
