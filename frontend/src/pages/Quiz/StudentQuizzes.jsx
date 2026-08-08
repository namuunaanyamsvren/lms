import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Clock, History, Play } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { ContextualEmpty, ErrorState, LoadingCards, OfflineBanner } from '../../components/ui/AsyncState';
import { fetchQuizHistory, fetchQuizzes, startQuizAttempt } from '../../services/api';
import useAsyncAction from '../../hooks/useAsyncAction';
import useNetworkStatus from '../../hooks/useNetworkStatus';
export default function StudentQuizzes(){
  const [items,setItems]=useState([]),[history,setHistory]=useState({}),[loading,setLoading]=useState(true),[error,setError]=useState(null);
  const nav=useNavigate(), online=useNetworkStatus(); const {run,pending}=useAsyncAction();
  const load=()=>{setLoading(true);setError(null);return fetchQuizzes().then(async rows=>{setItems(rows);const pairs=await Promise.all(rows.map(async q=>[q.id,await fetchQuizHistory(q.id)]));setHistory(Object.fromEntries(pairs));}).catch(setError).finally(()=>setLoading(false));};
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{load();},[]);
  const start=id=>run(async()=>{const a=await startQuizAttempt(id);nav(`/student/exams/${a.id}`);});
  return <div className="space-y-6"><PageHeader title="Шалгалтууд" subtitle="Шалгалтаа эхлүүлэх эсвэл тасарсан оролдлогоо үргэлжлүүлээрэй."/>
    {!online&&<OfflineBanner/>}
    {loading?<LoadingCards/>:error?<ErrorState error={error} onRetry={load}/>:items.length===0?<ContextualEmpty title="Шалгалт алга" description="Таны хичээлүүдэд нийтлэгдсэн шалгалт одоогоор байхгүй."/>:items.map(q=><section className="panel" key={q.id}><div className="flex flex-wrap justify-between gap-4"><div><span className="text-xs text-indigo-600">{q.module.course.title}</span><h2 className="font-semibold text-lg">{q.title}</h2><p className="text-sm text-slate-500 flex gap-3 mt-2"><span className="flex gap-1"><Clock size={15}/>{q.timeLimitMins||'Хугацаагүй'} мин</span><span>{q._count.questionLinks} асуулт</span><span>{q.maxAttempts} оролдлого</span></p></div><button disabled={pending||!online} className="btn-primary disabled:opacity-50" onClick={()=>start(q.id)}><Play size={16}/>{pending?'Нээж байна...':'Эхлэх / үргэлжлүүлэх'}</button></div>{history[q.id]?.length>0&&<div className="mt-4 border-t pt-3 text-sm"><b className="flex gap-1"><History size={15}/>Түүх</b>{history[q.id].map(a=><Link className="tag mt-2 mr-2 hover:underline" to={`/student/exams/${a.id}/result`} key={a.id}>#{a.attemptNumber} · {a.status} · {a.score==null?'–':`${Math.round(a.score)}%`}</Link>)}</div>}</section>)}
  </div>;
}
