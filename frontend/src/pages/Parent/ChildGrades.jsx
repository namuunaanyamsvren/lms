import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { fetchGuardianLinks, fetchTranscript } from '../../services/api';
import { GraduationCap, Users } from 'lucide-react';

export default function ParentChildGrades() {
  const [studentId, setStudentId] = useState('');
  const guardiansQuery = useQuery({ queryKey: ['guardians', 'approved'], queryFn: () => fetchGuardianLinks({ status: 'APPROVED' }) });
  const children = (guardiansQuery.data || [])
    .filter((link) => link.permissions?.includes('VIEW_GRADES'))
    .map((link) => link.studentUser);
  const selectedStudentId = children.some((child) => child.id === studentId)
    ? studentId
    : children[0]?.id || '';

  const transcriptQuery = useQuery({
    queryKey: ['transcript', 'detail', selectedStudentId],
    queryFn: () => fetchTranscript(selectedStudentId),
    enabled: !!selectedStudentId,
  });
  const transcript = transcriptQuery.data || { courses: [], terms: [], cumulativeGpa: null };

  return (
    <div className="space-y-6">
      <PageHeader title="Хүүхдийн дүн" subtitle="Хүүхдийнхээ курс тус бүрийн дүн, голч дүнг харах." />

      {guardiansQuery.isLoading ? (
        <div className="flex min-h-[20vh] items-center justify-center"><LoadingSpinner /></div>
      ) : children.length === 0 ? (
        <Card>
          <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
            <Users size={36} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">Холбогдсон хүүхэд алга</p>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <select value={selectedStudentId} onChange={(e) => setStudentId(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                {children.map((child) => <option key={child.id} value={child.id}>{child.firstName} {child.lastName}</option>)}
              </select>
              {transcript.cumulativeGpa != null && (
                <span className="text-slate-500">Голч дүн (GPA): <span className="font-semibold text-slate-900">{transcript.cumulativeGpa.toFixed(2)}</span></span>
              )}
            </div>
          </Card>

          <Card title="Курс тус бүрийн дүн">
            {transcriptQuery.isLoading ? (
              <div className="flex min-h-[20vh] items-center justify-center"><LoadingSpinner /></div>
            ) : transcript.courses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
                <GraduationCap size={36} className="mx-auto text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-700">Одоогоор тооцоолсон дүн алга</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Курс</th>
                      <th className="px-4 py-3">Хувь</th>
                      <th className="px-4 py-3">Үсэг</th>
                      <th className="px-4 py-3">Кредит</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {transcript.courses.map((course) => (
                      <tr key={course.courseId}>
                        <td className="px-4 py-3 font-semibold text-slate-900">{course.courseTitle} ({course.courseCode})</td>
                        <td className="px-4 py-3">{course.hasGrades ? `${course.percent}%` : '—'}</td>
                        <td className="px-4 py-3">{course.letter || '—'}</td>
                        <td className="px-4 py-3">{course.credits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
