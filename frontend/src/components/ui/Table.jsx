export default function Table({ columns = [], data = [], className = '' }) {
  return (
    <div className={`overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <table className="min-w-full border-collapse text-left text-sm text-slate-700">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-4 py-3 font-semibold text-slate-600">
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




