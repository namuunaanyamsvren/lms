// Groups a flat attendance record list (from GET /attendance, which now
// denormalizes cohort.course) into a per-course present-rate breakdown.
// Shared by the student and parent attendance detail pages.
export default function CourseAttendanceBreakdown({ records }) {
  const byCourse = records.reduce((acc, r) => {
    const key = r.cohort?.course?.id || r.cohort?.id || r.cohortId || 'unknown';
    const title = r.cohort?.course?.title || r.cohort?.name || 'Тодорхойгүй хичээл';
    if (!acc[key]) acc[key] = { key, title, total: 0, present: 0 };
    acc[key].total += 1;
    if (r.status === 'PRESENT') acc[key].present += 1;
    return acc;
  }, {});
  const courses = Object.values(byCourse).sort((a, b) => a.title.localeCompare(b.title));
  if (!courses.length) return <p className="text-sm text-slate-500">Ирцийн бүртгэл алга.</p>;
  return (
    <div className="space-y-3">
      {courses.map((c) => {
        const percent = c.total ? Math.round((c.present / c.total) * 100) : 0;
        const tone = percent >= 90 ? 'bg-emerald-500' : percent >= 75 ? 'bg-amber-500' : 'bg-rose-500';
        return (
          <div key={c.key}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-slate-700">{c.title}</span>
              <span className="text-slate-500">{percent}% · {c.present}/{c.total}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
