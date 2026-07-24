import React from 'react';

export default React.memo(function StatCard({ title, value, delta, icon: Icon }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-500">{title}</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
        </div>
        {Icon && (
          <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
            <Icon size={20} aria-hidden />
          </div>
        )}
      </div>
      {delta && <div className="mt-2 text-sm font-medium text-emerald-600">{delta}</div>}
    </div>
  );
});
