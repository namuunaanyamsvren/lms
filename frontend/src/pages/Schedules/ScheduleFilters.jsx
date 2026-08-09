import { Filter, RotateCcw } from 'lucide-react';

const selectClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';

export default function ScheduleFilters({
  filters,
  onChange,
  options,
  showTeacher = false,
  showChild = false,
}) {
  const semesters = [...new Set([
    ...options.terms.map(term => term.code),
  ])];
  const set = (key, value) => onChange({ ...filters, [key]: value });
  const reset = () => onChange({
    courseId: '',
    termId: '',
    semester: '',
    teacherId: '',
    studentId: showChild ? options.children[0]?.id || '' : '',
  });

  return (
    <section aria-label="Хуваарийн шүүлтүүр" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-slate-800">
          <Filter size={17} aria-hidden />
          Шүүлтүүр
        </div>
        <button type="button" onClick={reset} className="btn text-sm">
          <RotateCcw size={15} aria-hidden /> Цэвэрлэх
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {showChild && (
          <label className="text-sm font-medium text-slate-700">
            Хүүхэд
            <select aria-label="Хүүхэд" className={selectClass} value={filters.studentId} onChange={event => set('studentId', event.target.value)}>
              {options.children.map(child => (
                <option key={child.id} value={child.id}>{child.firstName} {child.lastName}</option>
              ))}
            </select>
          </label>
        )}
        <label className="text-sm font-medium text-slate-700">
          Хичээл
          <select aria-label="Хичээл" className={selectClass} value={filters.courseId} onChange={event => set('courseId', event.target.value)}>
            <option value="">Бүх хичээл</option>
            {options.courses.map(course => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Семестр
          <select aria-label="Семестр" className={selectClass} value={filters.semester} onChange={event => set('semester', event.target.value)}>
            <option value="">Бүх семестр</option>
            {semesters.map(semester => <option key={semester} value={semester}>{semester}</option>)}
          </select>
        </label>
        {showTeacher && (
          <label className="text-sm font-medium text-slate-700">
            Багш
            <select aria-label="Багш" className={selectClass} value={filters.teacherId} onChange={event => set('teacherId', event.target.value)}>
              <option value="">Бүх багш</option>
              {options.teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.firstName} {teacher.lastName}</option>)}
            </select>
          </label>
        )}
      </div>
    </section>
  );
}
