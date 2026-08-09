export default function Card({ title, subtitle, right, children, className = '' }) {
  return (
    <div className={`rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 ${className}`}>
      {(title || subtitle || right) && (
        <div className="mb-5 flex items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="space-y-1">
            {title && (
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                <span className="inline-block w-1.5 h-4 rounded-full bg-primary" />
                {title}
              </h2>
            )}
            {subtitle && <p className="text-xs sm:text-sm text-slate-500 pl-4">{subtitle}</p>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
