import React from 'react';

export default React.memo(function PageHeader({ title, subtitle, right }) {
  return (
    <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4" aria-labelledby="page-title">
      <div>
        <h1 id="page-title" className="text-3xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}
      </div>

      {right && (
        <div className="rounded-3xl bg-slate-50 px-5 py-4 border border-slate-200 text-sm text-slate-600 shadow-sm" aria-hidden>
          {right}
        </div>
      )}
    </header>
  );
});
