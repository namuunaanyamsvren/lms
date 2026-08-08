import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Copy, GitCompare, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import {
  compareCourseVersions, createLesson, createModule, deleteLesson, deleteModule, duplicateCourse,
  fetchCourseById, reorderLessons, reorderModules, restoreCourseVersion, updateCourse, updateLesson, updateModule,
} from '../../services/api';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';
import { useConfirm } from '../../components/ui/ConfirmDialog';

const emptyLesson = { title: '', content: '', contentType: 'RICH_TEXT', videoUrl: '', externalUrl: '', unlockRule: 'SCHEDULED', releaseAt: '', attachments: [] };
export default function CourseBuilder() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [notice, setNotice] = useState('');
  const [versionCompare, setVersionCompare] = useState(null);
  const confirm = useConfirm();
  const load = () => fetchCourseById(id).then(value => { setCourse(value); setSavedSnapshot(JSON.stringify(value)); });
  useEffect(() => {
    load();
  }, [id]);
  useUnsavedChanges(Boolean(course && savedSnapshot && JSON.stringify(course) !== savedSnapshot));
  const run = async (action, message = 'Хадгаллаа') => { await action(); setNotice(message); await load(); };
  const saveCourse = async () => {
    if (course.status === 'PUBLISHED' && savedSnapshot && JSON.parse(savedSnapshot).status !== 'PUBLISHED') {
      const ok = await confirm('Published болгох уу? Энэ үйлдэл шинэ immutable version snapshot үүсгэнэ.');
      if (!ok) return;
    }
    return run(() => updateCourse(id, {
    code: course.code, title: course.title, description: course.description || null, credits: Number(course.credits),
    level: course.level || null, durationWeeks: course.durationWeeks ? Number(course.durationWeeks) : null,
    price: Number(course.price || 0), currency: course.currency || 'MNT',
    capacity: course.capacity ? Number(course.capacity) : null,
    departmentId: course.departmentId || null, programId: course.programId || null,
    prerequisiteText: course.prerequisiteText || null, coverImageUrl: course.coverImageUrl || null,
    status: course.status, completionRule: course.completionRule, completionPercentage: Number(course.completionPercentage),
    }));
  };
  const shift = (items, index, direction, callback) => {
    const next = [...items]; const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    run(() => callback(next.map(item => item.id)), 'Дарааллыг шинэчиллээ');
  };
  if (!course) return <p>Ачааллаж байна...</p>;
  return <div className="course-builder max-w-6xl mx-auto space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><Link to="/teacher/courses" className="text-sm text-indigo-600">← Хичээлүүд</Link><h1 className="text-2xl font-bold mt-1">Course builder</h1><p className="mt-1 text-sm text-slate-500">Published болгох бүрт version snapshot үүсэж, cohort тухайн үеийн хувилбарыг хадгална.</p></div><div className="flex gap-2"><button onClick={() => { const code = prompt('Шинэ course code'); if (code) run(() => duplicateCourse(id, { code }), 'Хуулбар үүслээ'); }} className="btn"><Copy size={16} />Хуулах</button><button onClick={saveCourse} className="btn-primary"><Save size={16} />Хадгалах</button></div></div>
    {notice && <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg">{notice}</div>}
    {course.versions?.length > 0 && <section className="rounded-xl border bg-white p-4 text-sm text-slate-600 dark:bg-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><b className="text-slate-900 dark:text-white">Published versions:</b> {course.versions.map(version => `v${version.version}`).join(', ')}</div>
        <div className="flex flex-wrap gap-2">
          {course.versions.length >= 2 && <button className="btn" onClick={async () => setVersionCompare(await compareCourseVersions(id, course.versions[1].version, course.versions[0].version))}><GitCompare size={15} />Сүүлийн 2-г харьцуулах</button>}
          <button className="btn" onClick={async () => { const version = course.versions[0].version; if (await confirm(`v${version} хувилбараас draft сэргээх үү?`)) run(() => restoreCourseVersion(id, version), `v${version} хувилбараас сэргээв`); }}><RotateCcw size={15} />Сүүлийн хувилбараас сэргээх</button>
        </div>
      </div>
      {versionCompare && <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        <p className="font-semibold text-slate-800">v{versionCompare.from.version} → v{versionCompare.to.version}</p>
        <p>Гарчиг өөрчлөгдсөн: {versionCompare.summary.titleChanged ? 'Тийм' : 'Үгүй'}</p>
        <p>Модуль өөрчлөлт: {versionCompare.summary.moduleCountDelta}; Lesson өөрчлөлт: {versionCompare.summary.lessonCountDelta}</p>
        {(versionCompare.summary.addedModules || []).length > 0 && <p>Нэмэгдсэн: {versionCompare.summary.addedModules.join(', ')}</p>}
        {(versionCompare.summary.removedModules || []).length > 0 && <p>Хасагдсан: {versionCompare.summary.removedModules.join(', ')}</p>}
      </div>}
    </section>}
    <section className="bg-white dark:bg-slate-800 border rounded-xl p-5 grid md:grid-cols-2 gap-4">
      <label>Код<input value={course.code} onChange={e => setCourse({ ...course, code: e.target.value })} /></label>
      <label>Нэр<input value={course.title} onChange={e => setCourse({ ...course, title: e.target.value })} /></label>
      <label>Кредит<input type="number" value={course.credits} onChange={e => setCourse({ ...course, credits: e.target.value })} /></label>
      <label>Түвшин<input value={course.level || ''} onChange={e => setCourse({ ...course, level: e.target.value })} /></label>
      <label>Үргэлжлэх хугацаа (7 хоног)<input type="number" min="1" value={course.durationWeeks || ''} onChange={e => setCourse({ ...course, durationWeeks: e.target.value })} /></label>
      <label>Үнэ<input type="number" min="0" value={course.price || 0} onChange={e => setCourse({ ...course, price: e.target.value })} /></label>
      <label>Валют<input value={course.currency || 'MNT'} maxLength="3" onChange={e => setCourse({ ...course, currency: e.target.value.toUpperCase() })} /></label>
      <label>Багтаамж<input type="number" value={course.capacity || ''} onChange={e => setCourse({ ...course, capacity: e.target.value })} /></label>
      <label>Төлөв<select value={course.status} onChange={e => setCourse({ ...course, status: e.target.value })}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select></label>
      <label>Department ID<input value={course.departmentId || ''} onChange={e => setCourse({ ...course, departmentId: e.target.value })} /></label>
      <label>Program ID<input value={course.programId || ''} onChange={e => setCourse({ ...course, programId: e.target.value })} /></label>
      <label className="md:col-span-2">Cover image URL<input type="url" value={course.coverImageUrl || ''} onChange={e => setCourse({ ...course, coverImageUrl: e.target.value })} /></label>
      <label className="md:col-span-2">Тайлбар<textarea rows="3" value={course.description || ''} onChange={e => setCourse({ ...course, description: e.target.value })} /></label>
      <label className="md:col-span-2">Prerequisite тайлбар<textarea rows="2" value={course.prerequisiteText || ''} onChange={e => setCourse({ ...course, prerequisiteText: e.target.value })} /></label>
      <label>Completion rule<select value={course.completionRule} onChange={e => setCourse({ ...course, completionRule: e.target.value })}><option value="ALL_LESSONS">Бүх lesson</option><option value="PERCENTAGE">Хувиар</option></select></label>
      <label>Шаардлагатай хувь<input type="number" min="1" max="100" value={course.completionPercentage} onChange={e => setCourse({ ...course, completionPercentage: e.target.value })} /></label>
    </section>
    <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Модуль ба lesson</h2><button className="btn-primary" onClick={() => { const title = prompt('Модулийн нэр'); if (title) run(() => createModule(id, { title })); }}><Plus size={16} />Модуль</button></div>
    {course.modules.map((module, moduleIndex) => <section key={module.id} className="bg-white dark:bg-slate-800 border rounded-xl overflow-hidden">
      <div className="p-4 border-b flex items-center gap-2"><input className="font-semibold flex-1" value={module.title} onChange={e => setCourse({ ...course, modules: course.modules.map(m => m.id === module.id ? { ...m, title: e.target.value } : m) })} onBlur={() => run(() => updateModule(module.id, { title: module.title }))} />
        <button onClick={() => shift(course.modules, moduleIndex, -1, ids => reorderModules(id, ids))}><ArrowUp size={17} /></button><button onClick={() => shift(course.modules, moduleIndex, 1, ids => reorderModules(id, ids))}><ArrowDown size={17} /></button><button onClick={async () => { if (await confirm('Модулийг устгах уу?')) run(() => deleteModule(module.id)); }}><Trash2 size={17} /></button></div>
      <div className="p-4 space-y-3">{module.lessons.map((lesson, lessonIndex) => <LessonEditor key={lesson.id} lesson={lesson} onSave={payload => run(() => updateLesson(lesson.id, payload))} onDelete={async () => { if (await confirm('Lesson устгах уу?')) run(() => deleteLesson(lesson.id)); }} onMove={direction => shift(module.lessons, lessonIndex, direction, ids => reorderLessons(module.id, ids))} />)}
        <button className="btn" onClick={() => { const title = prompt('Lesson нэр'); if (title) run(() => createLesson(module.id, { ...emptyLesson, title })); }}><Plus size={16} />Lesson нэмэх</button></div>
    </section>)}
  </div>;
}

function LessonEditor({ lesson, onSave, onDelete, onMove }) {
  const [draft, setDraft] = useState({ ...emptyLesson, ...lesson, releaseAt: lesson.releaseAt ? lesson.releaseAt.slice(0, 16) : '', attachmentsText: (lesson.attachments || []).map(file => `${file.name}|${file.fileUrl}`).join('\n') });
  const save = () => onSave({
    title: draft.title, content: draft.content || null, contentType: draft.contentType,
    videoUrl: draft.videoUrl || null, externalUrl: draft.externalUrl || null,
    unlockRule: draft.unlockRule || 'SCHEDULED',
    releaseAt: draft.releaseAt ? new Date(draft.releaseAt).toISOString() : null,
    attachments: draft.attachmentsText.split('\n').filter(Boolean).map(line => { const [name, fileUrl] = line.split('|'); return { name: name.trim(), fileUrl: fileUrl?.trim() }; }).filter(file => file.name && file.fileUrl),
  });
  return <details className="border rounded-lg"><summary className="p-3 cursor-pointer flex items-center gap-2"><span className="flex-1">{draft.title}</span><button onClick={e => { e.preventDefault(); onMove(-1); }}><ArrowUp size={15} /></button><button onClick={e => { e.preventDefault(); onMove(1); }}><ArrowDown size={15} /></button><button onClick={e => { e.preventDefault(); onDelete(); }}><Trash2 size={15} /></button></summary>
    <div className="p-4 pt-0 grid md:grid-cols-2 gap-3"><label>Нэр<input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label><label>Төрөл<select value={draft.contentType} onChange={e => setDraft({ ...draft, contentType: e.target.value })}><option value="RICH_TEXT">Rich text</option><option value="VIDEO">Video</option><option value="EXTERNAL_LINK">External link</option></select></label>
      <label>Нээгдэх дүрэм<select value={draft.unlockRule || 'SCHEDULED'} onChange={e => setDraft({ ...draft, unlockRule: e.target.value })}><option value="SCHEDULED">Хуваариар</option><option value="SEQUENTIAL">Өмнөхийг дуусгасны дараа</option><option value="MANUAL">Гараар нээлттэй</option></select></label><label>Release date<input type="datetime-local" value={draft.releaseAt} onChange={e => setDraft({ ...draft, releaseAt: e.target.value })} /></label>
      <label className="md:col-span-2">HTML content<textarea rows="5" value={draft.content || ''} onChange={e => setDraft({ ...draft, content: e.target.value })} /></label><label>Video URL<input value={draft.videoUrl || ''} onChange={e => setDraft({ ...draft, videoUrl: e.target.value })} /></label><label>External URL<input value={draft.externalUrl || ''} onChange={e => setDraft({ ...draft, externalUrl: e.target.value })} /></label><label className="md:col-span-2">Attachments (нэр|URL мөр бүрт)<textarea value={draft.attachmentsText} onChange={e => setDraft({ ...draft, attachmentsText: e.target.value })} /></label><button className="btn-primary md:col-span-2" onClick={save}><Save size={16} />Lesson хадгалах</button></div>
  </details>;
}
