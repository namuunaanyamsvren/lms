import { useCallback, useEffect, useState } from 'react';
import SafeRichText from '../../components/security/SafeRichText';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Circle, CreditCard, ExternalLink, Lock, Paperclip, PlayCircle } from 'lucide-react';
import { completeLesson, fetchCourseById } from '../../services/api';

export default function CourseDetail() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => fetchCourseById(id).then(setCourse).catch(() => setError('Хичээл ачааллахад алдаа гарлаа.')), [id]);
  useEffect(() => {
    load();
  }, [load]);
  if (error) return <p>{error}</p>;
  if (!course) return <p>Ачааллаж байна...</p>;
  const complete = lessonId => completeLesson(lessonId).then(load);
  return <div className="max-w-5xl mx-auto space-y-6">
    <div className="rounded-2xl overflow-hidden bg-white border border-slate-200 grid md:grid-cols-[1fr_300px]">
      <div className="p-8"><span className="text-indigo-600 text-sm">{course.code} · {course.credits} кредит · {course.durationWeeks ? `${course.durationWeeks} долоо хоног` : 'хугацаа тохируулаагүй'} · {Number(course.price || 0).toLocaleString('mn-MN')} {course.currency || 'MNT'}</span><h1 className="text-3xl font-bold mt-2 text-slate-900">{course.title}</h1><p className="text-slate-500 mt-3">{course.description}</p></div>
      {course.coverImageUrl && <img src={course.coverImageUrl} alt="" className="w-full h-full object-cover" />}
    </div>
    {course.billingRestricted && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-2xl bg-white p-3 text-amber-700"><CreditCard size={22} /></span>
        <div className="flex-1">
          <p className="font-semibold">Төлбөр хүлээгдэж байна</p>
          <p className="mt-1 text-sm">Байгууллагын SaaS төлбөр баталгаажсаны дараа хичээлийн материал нээгдэнэ. Сургуулийн менежерт хандана уу.</p>
        </div>
      </div>
    </div>}
    <div className="bg-white p-5 rounded-xl border"><div className="flex justify-between text-sm mb-2"><span>Нийт явц</span><b>{course.progress || 0}%</b></div><div className="h-2 bg-slate-200 rounded"><div className="h-full bg-indigo-600 rounded" style={{ width: `${course.progress || 0}%` }} /></div></div>
    {!course.billingRestricted && course.modules.map(module => <section key={module.id} className="bg-white rounded-xl border overflow-hidden"><h2 className="font-semibold p-4 border-b">{module.title}</h2>
      {module.lessons.map(lesson => <article key={lesson.id} className={`p-4 border-b last:border-0 ${lesson.locked ? 'bg-slate-50 text-slate-500' : ''}`}><div className="flex gap-3"><button disabled={lesson.locked} onClick={() => complete(lesson.id)} title={lesson.locked ? 'Түгжээтэй lesson' : 'Дууссан гэж тэмдэглэх'}>{lesson.locked ? <Lock className="text-slate-400" /> : lesson.completed ? <CheckCircle2 className="text-green-500" /> : <Circle className="text-slate-400" />}</button><div className="flex-1"><h3 className="font-medium">{lesson.title}</h3>
        {lesson.locked ? <p className="mt-2 text-sm text-slate-500">{lesson.lockReason === 'SEQUENTIAL' ? 'Өмнөх lesson-оо дуусгасны дараа нээгдэнэ.' : 'Товлосон хугацаанд нээгдэнэ.'}</p> : <>
          {lesson.content && <SafeRichText className="prose prose-sm max-w-none mt-3" html={lesson.content} />}
          {lesson.videoUrl && <a href={lesson.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 mt-2"><PlayCircle size={16} />Видео үзэх</a>}
          {lesson.externalUrl && <a href={lesson.externalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 mt-2 ml-3"><ExternalLink size={16} />Нэмэлт холбоос</a>}
          {lesson.attachments?.map(file => <a key={file.id} href={file.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-indigo-600 mt-2"><Paperclip size={14} />{file.name}</a>)}
        </>}
      </div></div></article>)}</section>)}
  </div>;
}
