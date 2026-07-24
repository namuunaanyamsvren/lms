export default function Pagination({ currentPage = 1, totalPages = 1, onChange, className = '' }) {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-3xl bg-white px-3 py-2 shadow-sm ${className}`}>
      <button
        type="button"
        onClick={() => onChange(Math.max(currentPage - 1, 1))}
        className="rounded-full px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        disabled={currentPage === 1}
      >
        Prev
      </button>
      {pages.map((page) => (
        <button
          key={page}
          type="button"
          onClick={() => onChange(page)}
          className={`rounded-full px-3 py-2 text-sm font-medium ${page === currentPage ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
        >
          {page}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(Math.min(currentPage + 1, totalPages))}
        className="rounded-full px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        disabled={currentPage === totalPages}
      >
        Next
      </button>
    </div>
  );
}
