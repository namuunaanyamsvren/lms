import PageHeader from '../ui/PageHeader';
import StatCard from '../ui/StatCard';

export default function DashboardTemplate({
  title,
  subtitle,
  dateLabel = 'Өнөөдөр',
  dateValue = '22 Jul 2026',
  stats = [],
  leftColumn,
  rightColumn,
  bottomSection,
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        right={
          <>
            <div className="text-sm text-slate-500">{dateLabel}</div>
            <div className="mt-1 font-medium text-slate-900">{dateValue}</div>
          </>
        }
      />

      {stats.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">{leftColumn}</div>
        <div className="space-y-6">{rightColumn}</div>
      </div>

      {bottomSection}
    </div>
  );
}
