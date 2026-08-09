import React from 'react';

export default React.memo(function StatCard({ title, value, delta, icon: Icon }) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 group">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</div>
          <div className="mt-1.5 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{value}</div>
        </div>
        {Icon && (
          <div className="rounded-2xl bg-primary/10 p-3.5 text-primary border border-primary/20 group-hover:scale-110 transition-transform duration-200">
            <Icon size={22} aria-hidden />
          </div>
        )}
      </div>
      {delta && <div className="mt-2.5 text-xs font-semibold text-primary">{delta}</div>}
    </div>
  );
});
