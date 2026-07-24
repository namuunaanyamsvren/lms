import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import PageHeader from '../ui/PageHeader';
import Card from '../ui/Card';

// A generic component to render a list of items in a table.
// It dynamically creates columns from the keys of the first item in the data.
function DynamicTable({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-slate-500">No items to display.</p>;
  }

  const columns = Object.keys(data[0]);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            {columns.map(col => (
              <th
                key={col}
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500"
              >
                {col.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {data.map((item, index) => (
            <tr key={index}>
              {columns.map(col => (
                <td key={col} className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                  {typeof item[col] === 'boolean'
                    ? item[col]
                      ? 'Yes'
                      : 'No'
                    : item[col]?.toString() || 'N/A'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// This is now a generic, data-fetching page component.
// It receives a `fetcher` function prop from the router, which is the specific
// API call for the resource (e.g., fetchCourses, fetchAssignments).
export default function RoleSectionPage({ title, subtitle, fetcher }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const result = await fetcher();
        setData(result);
      } catch (err) {
        setError(`Failed to load data for ${title}.`);
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [fetcher, title]);

  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={subtitle} />
      <Card>
        {loading && <p>Loading...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {!loading && !error && <DynamicTable data={data} />}
      </Card>
    </div>
  );
}
