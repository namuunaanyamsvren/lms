import { useEffect, useState } from 'react';
import { BarChart3, Plus, Settings, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import Toast from '../../components/ui/Toast';
import { ContextualEmpty, ErrorState, LoadingCards, OfflineBanner } from '../../components/ui/AsyncState';
import { createQuiz, deleteQuiz, fetchCourseById, fetchCourses, fetchQuizzes } from '../../services/api';
import useAsyncAction from '../../hooks/useAsyncAction';
import useNetworkStatus from '../../hooks/useNetworkStatus';
import { useConfirm } from '../../components/ui/ConfirmDialog';

const blank = moduleId => ({ moduleId, title:'', description:'', timeLimitMins:30, passingScore:70, status:'DRAFT', maxAttempts:1, scoringPolicy:'LATEST', shuffleQuestions:false, shuffleOptions:false, showResults:true, highStakes:false });
const SETTING_LABELS = {
  shuffleQuestions: { label:'Асуултын дараалал холих', hint:'Оролдлого бүрт асуултын дараалал санамсаргүй болно.' },
  shuffleOptions: { label:'Сонголтын дараалал холих', hint:'Олон сонголттой асуултын хариултын дараалал холигдоно.' },
  showResults: { label:'Оноо, зөв хариултыг харуулах', hint:'Идэвхгүй бол оюутан зөвхөн илгээгдсэнийг л харна, оноогоо шууд харахгүй.' },
  highStakes: { label:'Өндөр эрсдэлтэй шалгалт', hint:'Focus lost, reconnect зэрэг proctoring event илүү нарийн бүртгэгдэнэ.' },
};
export default function TeacherQuizzes() {
  const [items,setItems]=useState([]), [modules,setModules]=useState([]), [form,setForm]=useState(null);
  const [loading,setLoading]=useState(true), [error,setError]=useState(null), [toast,setToast]=useState('');
  const {run,pending}=useAsyncAction(); const online=useNetworkStatus(); const confirm=useConfirm();
  const load=()=>{setLoading(true);setError(null);return fetchQuizzes().then(setItems).catch(setError).finally(()=>setLoading(false));};
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{load();fetchCourses({limit:100}).then(async r=>{const cs=await Promise.all(r.items.map(c=>fetchCourseById(c.id)));setModules(cs.flatMap(c=>c.modules.map(m=>({...m,courseTitle:c.title}))));}).catch(setError);},[]);
  const save=e=>{e.preventDefault();run(async()=>{await createQuiz({...form,timeLimitMins:form.timeLimitMins?Number(form.timeLimitMins):null,passingScore:Number(form.passingScore),maxAttempts:Number(form.maxAttempts)});setForm(null);setToast('Шалгалтыг амжилттай үүсгэлээ.');await load();});};
  const remove=async id=>{if(!await confirm('Устгах уу?'))return;const previous=items;setItems(x=>x.filter(q=>q.id!==id));try{await deleteQuiz(id);setToast('Шалгалтыг устгалаа.');}catch(err){setItems(previous);setError(err);}};
  return <div className="space-y-6">
    <PageHeader title="Quiz / exam management" subtitle="Шалгалтын тохиргоо, question bank, үр дүн болон item analysis." right={<button disabled={!modules.length} className="btn-primary" onClick={()=>setForm(blank(modules[0]?.id||''))}><Plus size={16}/>Шалгалт</button>}/>
    {!online&&<OfflineBanner/>}{toast&&<Toast type="success" message={toast} onClose={()=>setToast('')}/>}
    {form&&<form onSubmit={save} className="panel quiz-form grid md:grid-cols-3 gap-3"><label>Модуль<select value={form.moduleId} onChange={e=>setForm({...form,moduleId:e.target.value})}>{modules.map(m=><option value={m.id} key={m.id}>{m.courseTitle} · {m.title}</option>)}</select></label><label>Нэр<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>Хугацаа (мин)<input type="number" value={form.timeLimitMins} onChange={e=>setForm({...form,timeLimitMins:e.target.value})}/></label><label>Тэнцэх хувь<input type="number" value={form.passingScore} onChange={e=>setForm({...form,passingScore:e.target.value})}/></label><label>Оролдлого<input type="number" value={form.maxAttempts} onChange={e=>setForm({...form,maxAttempts:e.target.value})}/></label><label>Оноо тооцох арга<select value={form.scoringPolicy} onChange={e=>setForm({...form,scoringPolicy:e.target.value})}><option value="LATEST">Сүүлийн оролдлого</option><option value="HIGHEST">Хамгийн өндөр оролдлого</option></select></label><label>Төлөв<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>DRAFT</option><option>PUBLISHED</option><option>ARCHIVED</option></select></label>{Object.entries(SETTING_LABELS).map(([k,meta])=><label key={k} title={meta.hint} className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={form[k]} onChange={e=>setForm({...form,[k]:e.target.checked})}/><span>{meta.label}<span className="block text-xs text-slate-400 font-normal">{meta.hint}</span></span></label>)}<div className="md:col-span-3"><button disabled={pending||!online} className="btn-primary disabled:opacity-50">{pending?'Үүсгэж байна...':'Үүсгэх'}</button></div></form>}
    {loading?<LoadingCards/>:error?<ErrorState error={error} onRetry={load}/>:items.length===0?<ContextualEmpty title="Шалгалт алга" description="Эхний шалгалтаа үүсгээд асуултуудаа нэмнэ үү." action={<button className="btn-primary" onClick={()=>setForm(blank(modules[0]?.id||''))}><Plus size={16}/>Шалгалт үүсгэх</button>}/>:<div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{items.map(q=><section className="panel" key={q.id}><div className="flex justify-between"><span className="tag">{q.status}</span><button disabled={pending} onClick={()=>remove(q.id)}><Trash2 size={17}/></button></div><h2 className="font-semibold text-lg mt-3">{q.title}</h2><p className="text-sm text-slate-500">{q.module.course.title} · {q._count.questionLinks} асуулт · {q._count.quizAttempts} оролдлого</p><div className="flex gap-3 mt-4"><Link className="btn" to={`/teacher/quizzes/${q.id}`}><Settings size={15}/>Засах</Link><Link className="btn" to={`/teacher/quizzes/${q.id}/analytics`}><BarChart3 size={15}/>Analytics</Link></div></section>)}</div>}
  </div>;
}
