import { Link } from 'react-router-dom';

export default function Header() {
  return (
    <header className="bg-white shadow-sm sticky top-0 z-40">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-indigo-600">LMS</h1>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-slate-900">
              Боломжууд
            </a>
            <a href="#dashboard" className="hover:text-slate-900">
              Удирдах самбар
            </a>
            <a href="#universities" className="hover:text-slate-900">
              Их сургуулиуд
            </a>
            <a href="#faq" className="hover:text-slate-900">
              Асуулт хариулт
            </a>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link
              to="/login"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-slate-900"
            >
              Нэвтрэх
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              Эхлэх
            </Link>
          </div>

          <div className="md:hidden">
            <button className="text-gray-600">Цэс</button>
          </div>
        </div>
      </nav>
    </header>
  );
}
