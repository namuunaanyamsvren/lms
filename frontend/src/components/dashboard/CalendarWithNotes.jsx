import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, X, StickyNote } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useDialogA11y from '../../hooks/useDialogA11y';

const DAY_ABBRS = ['Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня'];
const MONTH_NAMES_MN = [
  '1-р сар', '2-р сар', '3-р сар', '4-р сар', '5-р сар', '6-р сар',
  '7-р сар', '8-р сар', '9-р сар', '10-р сар', '11-р сар', '12-р сар'
];

export default function CalendarWithNotes({ className = '' }) {
  const { user } = useAuth();
  const storageKey = `lms_calendar_notes_${user?.id || 'default'}`;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [notes, setNotes] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [newNoteText, setNewNoteText] = useState('');
  const noteDialogRef = useDialogA11y(Boolean(selectedDate), () => setSelectedDate(null));

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(notes));
    } catch (e) {
      console.error('Failed to save calendar notes', e);
    }
  }, [notes, storageKey]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const today = new Date();
  const isToday = (day) => {
    return (
      today.getDate() === day &&
      today.getMonth() === month &&
      today.getFullYear() === year
    );
  };

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const startingOffset = (firstDayOfMonth + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const formatDateKey = (day) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  const handleDayClick = (day) => {
    const dateKey = formatDateKey(day);
    setSelectedDate(dateKey);
    setNewNoteText('');
  };

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!newNoteText.trim() || !selectedDate) return;

    const newNote = {
      id: Date.now().toString(),
      text: newNoteText.trim(),
      createdAt: new Date().toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' }),
    };

    setNotes((prev) => ({
      ...prev,
      [selectedDate]: [...(prev[selectedDate] || []), newNote],
    }));

    setNewNoteText('');
  };

  const handleDeleteNote = (dateKey, noteId) => {
    setNotes((prev) => {
      const updated = (prev[dateKey] || []).filter((n) => n.id !== noteId);
      if (updated.length === 0) {
        const copy = { ...prev };
        delete copy[dateKey];
        return copy;
      }
      return { ...prev, [dateKey]: updated };
    });
  };

  const selectedDateNotes = selectedDate ? notes[selectedDate] || [] : [];

  return (
    <div className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StickyNote size={18} className="text-indigo-600" />
          <h3 className="text-base font-semibold text-slate-900">
            Календарь & Тэмдэглэл ({year} {MONTH_NAMES_MN[month]})
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevMonth}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Өмнөх сар"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <button
            onClick={handleNextMonth}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Дараах сар"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>
      </div>

      {/* Weekday Labels */}
      <div role="row" className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500 mb-2">
        {DAY_ABBRS.map((day) => (
          <div key={day} role="columnheader" className="py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div role="grid" aria-label={`${year} ${MONTH_NAMES_MN[month]} календарь`} className="grid grid-cols-7 gap-1 text-center text-xs">
        {/* Offset days */}
        {Array.from({ length: startingOffset }).map((_, i) => (
          <div key={`offset-${i}`} className="py-2.5" />
        ))}

        {/* Month days */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNum = i + 1;
          const dateKey = formatDateKey(dayNum);
          const dayNotes = notes[dateKey] || [];
          const hasNotes = dayNotes.length > 0;
          const currentIsToday = isToday(dayNum);

          return (
            <button
              key={dayNum}
              onClick={() => handleDayClick(dayNum)}
              role="gridcell"
              aria-label={`${year} ${MONTH_NAMES_MN[month]} ${dayNum}${hasNotes ? `, ${dayNotes.length} тэмдэглэлтэй` : ''}`}
              aria-current={currentIsToday ? 'date' : undefined}
              className={`relative flex flex-col items-center justify-center rounded-xl py-2 transition-all ${
                currentIsToday
                  ? 'bg-indigo-600 font-bold text-white shadow-sm'
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              <span>{dayNum}</span>
              {hasNotes && (
                <span
                  className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                    currentIsToday ? 'bg-amber-300' : 'bg-indigo-600'
                  }`}
                  title={`${dayNotes.length} тэмдэглэл`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Date Modal / Note Panel */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div
            ref={noteDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-note-title"
            tabIndex={-1}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl outline-none"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <StickyNote size={18} aria-hidden className="text-indigo-600" />
                <h4 id="calendar-note-title" className="font-semibold text-slate-900">
                  {selectedDate} — Тэмдэглэл
                </h4>
              </div>
              <button
                onClick={() => setSelectedDate(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Тэмдэглэлийн цонх хаах"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            {/* Existing Notes */}
            <div className="my-4 max-h-56 space-y-2 overflow-y-auto pr-1">
              {selectedDateNotes.length === 0 ? (
                <p className="text-center py-4 text-sm text-slate-400">
                  Энэ өдөрт тэмдэглэл байхгүй байна. Та доорх талбарт тэмдэглэлээ бичиж нэмээрэй.
                </p>
              ) : (
                selectedDateNotes.map((note) => (
                  <div
                    key={note.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm"
                  >
                    <div>
                      <p className="text-slate-800">{note.text}</p>
                      <p className="mt-1 text-[10px] text-slate-400">{note.createdAt}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteNote(selectedDate, note.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1"
                      aria-label="Тэмдэглэл устгах"
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add Note Form */}
            <form onSubmit={handleAddNote} className="flex gap-2">
              <input
                type="text"
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Тэмдэглэл бичих..."
                aria-label="Тэмдэглэл бичих"
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                <Plus size={16} aria-hidden /> Нэмэх
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
