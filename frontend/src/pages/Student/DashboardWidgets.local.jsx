import React from 'react';

const DAY_ABBRS = ['Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня'];
const WEEKDAY_NAMES = ['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'];

export function CalendarMini() {
  const today = new Date();
  const monthLabel = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const weekdayLabel = WEEKDAY_NAMES[today.getDay()];
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const todayDate = today.getDate();

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">{monthLabel}</div>
        <div className="text-xs text-slate-500">{weekdayLabel}</div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-600">
        {DAY_ABBRS.map((day) => (
          <div key={day} className="rounded-md bg-slate-50 py-2">
            {day}
          </div>
        ))}
        {Array.from({ length: daysInMonth }).map((_, index) => (
          <div
            key={index}
            className={`rounded-md py-2 ${index + 1 === todayDate ? 'bg-indigo-50 font-semibold text-indigo-700' : 'hover:bg-slate-100'}`}
          >
            {index + 1}
          </div>
        ))}
      </div>
    </div>
  );
}

export default null;
