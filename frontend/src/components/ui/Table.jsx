export default function Table({ columns = [], data = [], caption, className = '' }) {
  return (
    <div className={`overflow-x-auto overflow-y-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 ${className}`}>
      <table className="min-w-full border-collapse text-left text-sm text-slate-700 dark:text-slate-200">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-100">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-slate-100 hover:bg-slate-50">
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-4 align-top">
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}



