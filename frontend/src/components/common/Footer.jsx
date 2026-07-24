export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-slate-200 mt-16 text-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3">LMS</h3>
            <p className="text-sm text-slate-500 max-w-sm">
              Оюутнууд, багш нар болон сургуулийн удирдлагуудад зориулсан орчин үеийн цогц систем.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-900 mb-4">
              Бүтээгдэхүүн
            </h4>
            <ul className="space-y-3 text-sm text-slate-600">
              <li>
                <a href="#features" className="hover:text-slate-900">
                  Боломжууд
                </a>
              </li>
              <li>
                <a href="#dashboard" className="hover:text-slate-900">
                  Удирдах самбар
                </a>
              </li>
              <li>
                <a href="#universities" className="hover:text-slate-900">
                  Их сургуулиуд
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-900 mb-4">
              Компани
            </h4>
            <ul className="space-y-3 text-sm text-slate-600">
              <li>
                <a href="#faq" className="hover:text-slate-900">
                  Асуулт хариулт
                </a>
              </li>
              <li>
                <a href="/login" className="hover:text-slate-900">
                  Нэвтрэх
                </a>
              </li>
              <li>
                <a href="/register" className="hover:text-slate-900">
                  Эхлэх
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between text-sm text-slate-500">
          <p>&copy; {currentYear} LMS. Бүх эрх хуулиар хамгаалагдсан.</p>
          <div className="flex flex-wrap gap-4">
            <a href="#" className="hover:text-slate-900">
              Twitter
            </a>
            <a href="#" className="hover:text-slate-900">
              LinkedIn
            </a>
            <a href="#" className="hover:text-slate-900">
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}





