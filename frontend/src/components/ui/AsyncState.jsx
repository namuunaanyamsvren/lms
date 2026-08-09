import { AlertCircle, BookOpen, RefreshCw, WifiOff } from 'lucide-react';
import EmptyState from './EmptyState';
import { SkeletonCard } from './SkeletonLoader';
export const getApiErrorDetail = error => ({
  title: error?.response?.status === 403 ? 'Хандах эрх хүрэлцэхгүй байна' : 'Мэдээлэл ачаалж чадсангүй',
  message: error?.response?.data?.message || error?.message || 'Тодорхойгүй алдаа гарлаа.',
  requestId: error?.response?.headers?.['x-request-id'] || error?.response?.data?.requestId,
});
export function LoadingCards({ count = 3 }) {
  return <div role="status" aria-busy="true" aria-label="Ачааллаж байна" className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{Array.from({length:count},(_,i)=><SkeletonCard key={i}/>)}</div>;
}
export function ErrorState({ error, onRetry }) {
  const detail=getApiErrorDetail(error);
  return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800"><AlertCircle/><h2 className="font-semibold text-lg mt-2">{detail.title}</h2><p>{detail.message}</p>{detail.requestId&&<p className="text-xs mt-2">Request ID: {detail.requestId}</p>}{onRetry&&<button className="btn mt-4" onClick={onRetry}><RefreshCw size={15}/>Дахин оролдох</button>}</div>;
}
export function ContextualEmpty({ title, description, action }) {
  return <EmptyState icon={<BookOpen/>} title={title} description={description} action={action}/>;
}
export function OfflineBanner() {
  return <div role="status" className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl"><WifiOff size={18}/><span><b>Сүлжээгүй байна.</b> Зарим өөрчлөлт холбогдсоны дараа хадгалагдана.</span></div>;
}
