import React from 'react';

export function TeachStat({ title, value, change }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      {change && <div className="text-sm text-green-600 mt-1">{change}</div>}
    </div>
  );
}

export function CourseCard({ title, students, progress }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-slate-800">{title}</div>
          <div className="text-xs text-slate-500">{students} students</div>
        </div>
        <div className="text-sm font-semibold">{progress}%</div>
      </div>
    </div>
  );
}

export function UpcomingClassItem({ title, time }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-slate-500">{time}</div>
      </div>
      <button className="text-indigo-600 text-sm">Start</button>
    </div>
  );
}

export function AssignmentReviewItem({ title, pending }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="text-sm">{title}</div>
      <div className="text-sm text-slate-500">{pending} pending</div>
    </div>
  );
}

export function PerfRow({ student, score }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="text-sm">{student}</div>
      <div className="font-medium">{score}</div>
    </div>
  );
}

export default null;
