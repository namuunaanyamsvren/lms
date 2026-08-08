import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default React.memo(function PageHeader({ title, subtitle, right, showBack = true }) {
  const navigate = useNavigate();

  return (
    <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4" aria-labelledby="page-title">
      <div className="flex items-start gap-3.5">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            className="mt-1 p-2.5 rounded-2xl border border-slate-200/80 bg-white text-slate-700 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all shadow-xs"
            aria-label="Буцах"
            title="Буцах"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div>
          <h1 id="page-title" className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="inline-block w-2 h-7 rounded-full bg-primary" />
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-xs sm:text-sm text-slate-500 pl-4">{subtitle}</p>}
        </div>
      </div>

      {right && (
        <div className="rounded-3xl bg-white px-5 py-3.5 border border-slate-200/80 text-sm text-slate-700 shadow-sm hover:border-primary/30 transition-all" aria-hidden>
          {right}
        </div>
      )}
    </header>
  );
});
