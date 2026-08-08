import { Link } from 'react-router-dom';

export default function LegalPage({ title, effectiveDate, children }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link className="text-lg font-bold text-slate-950" to="/">LMS</Link>
          <nav className="flex gap-4 text-sm">
            <Link to="/privacy" className="hover:text-indigo-600">Нууцлал</Link>
            <Link to="/terms" className="hover:text-indigo-600">Нөхцөл</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-bold text-slate-950">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">Хүчин төгөлдөр: {effectiveDate}</p>
        <article className="mt-8 space-y-8 text-sm leading-7">{children}</article>
      </main>
    </div>
  );
}

export function LegalSection({ title, children, id }) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="mb-2 text-xl font-semibold text-slate-950">{title}</h2>
      <div className="space-y-3 text-slate-700">{children}</div>
    </section>
  );
}
