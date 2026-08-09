import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Copy, GraduationCap, MapPin, Plus, Trash2 } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { createAcademicItem, deleteAcademicItem, fetchAcademicStructure, rolloverAcademicYear } from '../../services/api';
import { ErrorState, LoadingCards, OfflineBanner } from '../../components/ui/AsyncState';
import useNetworkStatus from '../../hooks/useNetworkStatus';
import useAsyncAction from '../../hooks/useAsyncAction';
import { useConfirm } from '../../components/ui/ConfirmDialog';

const tabs = [
  ['years', 'Хичээлийн жил', CalendarDays], ['departments', 'Тэнхим / хөтөлбөр', GraduationCap],
  ['gradeLevels', 'Анги / subject', GraduationCap], ['policies', 'Кредит бодлого', GraduationCap],
  ['campuses', 'Кампус / өрөө', MapPin], ['holidays', 'Амралтын өдөр', CalendarDays],
];
const inputClass = 'w-full rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 px-3 py-2';
const isoDate = value => value ? new Date(value).toLocaleDateString('mn-MN') : '';

export default function AcademicStructure() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('years');
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const online = useNetworkStatus();
  const { run, pending } = useAsyncAction();
  const confirm = useConfirm();
  const load = () => { setError(null); return fetchAcademicStructure().then(setData).catch(setError); };
  // Initial remote synchronization.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    load();
  }, []);
  const actions = useMemo(() => ({
    years: () => setForm({ resource: 'years', name: '', startDate: '', endDate: '', status: 'PLANNED' }),
    departments: () => setForm({ resource: 'departments', code: '', name: '', description: '' }),
    gradeLevels: () => setForm({ resource: 'grade-levels', code: '', name: '', order: 1 }),
    policies: () => setForm({ resource: 'credit-policies', name: '', contactHoursPerCredit: 16, minCredits: 0, maxCredits: 30, isDefault: false }),
    campuses: () => setForm({ resource: 'campuses', code: '', name: '', address: '' }),
    holidays: () => setForm({ resource: 'holidays', name: '', startDate: '', endDate: '', termId: '', isTeachingDay: false }),
  }), []);
  const save = async e => run(async () => {
    e.preventDefault(); const { resource, ...payload } = form;
    Object.keys(payload).forEach(key => payload[key] === '' && delete payload[key]);
    await createAcademicItem(resource, payload); setForm(null); setMessage('Амжилттай хадгаллаа.'); await load();
  });
  const remove = async (resource, id) => { if (!await confirm('Устгах уу?')) return; await deleteAcademicItem(resource, id); await load(); };
  const rollover = async year => {
    const name = prompt('Шинэ хичээлийн жилийн нэр'); if (!name) return;
    const startDate = prompt('Эхлэх огноо (YYYY-MM-DD)'); const endDate = prompt('Дуусах огноо (YYYY-MM-DD)');
    const codePrefix = prompt('Term code prefix', name.replace(/\s/g, '-')); if (!startDate || !endDate || !codePrefix) return;
    await rolloverAcademicYear(year.id, { name, startDate, endDate, codePrefix, cloneSchedules: true }); setMessage('Шинэ жил, term, holiday, schedule-уудыг хууллаа.'); await load();
  };
  if (error && !data) return <ErrorState error={error} onRetry={load}/>;
  if (!data) return <LoadingCards count={4}/>;
  return <div className="space-y-6">
    <PageHeader title="Академик бүтэц" subtitle="Танай байгууллагын хичээлийн жил, бүтэц, кредитийн бодлого, кампус болон календарь." />
    {!online && <OfflineBanner />}
    {error && <ErrorState error={error} onRetry={load}/>}
    {message && <div className="rounded-lg bg-emerald-50 text-emerald-700 px-4 py-3">{message}</div>}
    <div className="flex gap-2 overflow-x-auto">{tabs.map(([id, label, Icon]) => <button key={id} onClick={() => setTab(id)} className={`shrink-0 flex gap-2 items-center px-4 py-2 rounded-xl ${tab === id ? 'bg-indigo-600 text-white' : 'bg-white border dark:bg-slate-800'}`}><Icon size={16}/>{label}</button>)}</div>
    <div className="flex justify-end"><button className="btn-primary" onClick={actions[tab]}><Plus size={16}/>Нэмэх</button></div>
    {form && <form onSubmit={save} className="bg-white dark:bg-slate-800 border rounded-xl p-5 grid md:grid-cols-3 gap-4">
      {Object.entries(form).filter(([key]) => key !== 'resource').map(([key, value]) => <label key={key} className="text-sm font-medium">{labelFor(key)}
        {key === 'status' ? <select className={inputClass} value={value} onChange={e => setForm({...form, [key]: e.target.value})}><option>PLANNED</option><option>ACTIVE</option><option>CLOSED</option></select>
          : typeof value === 'boolean' ? <input className="ml-3" type="checkbox" checked={value} onChange={e => setForm({...form, [key]: e.target.checked})}/>
          : <input required={!['description','address','termId'].includes(key)} type={key.toLowerCase().includes('date') ? 'date' : typeof value === 'number' ? 'number' : 'text'} className={inputClass} value={value} onChange={e => setForm({...form, [key]: typeof value === 'number' ? Number(e.target.value) : e.target.value})}/>}
      </label>)}<div className="md:col-span-3 flex gap-2"><button disabled={pending||!online} className="btn-primary disabled:opacity-50">{pending?'Хадгалж байна...':'Хадгалах'}</button><button type="button" className="btn" onClick={() => setForm(null)}>Болих</button></div>
    </form>}
    {tab === 'years' && <div className="space-y-4">{data.years.map(year => <section key={year.id} className="panel"><div className="flex justify-between gap-3"><div><h2 className="font-semibold">{year.name}</h2><p className="text-sm text-slate-500">{isoDate(year.startDate)} – {isoDate(year.endDate)} · {year.status}</p></div><div><button title="Rollover" onClick={() => rollover(year)}><Copy size={18}/></button><button className="ml-3" onClick={() => remove('years', year.id)}><Trash2 size={18}/></button></div></div><div className="mt-3 flex flex-wrap gap-2">{year.terms.map(term => <span key={term.id} className="tag">{term.code}: {term.name}</span>)}</div><button className="btn mt-3" onClick={() => setForm({resource:'terms', academicYearId:year.id, code:'', name:'', startDate:'', endDate:'', status:'PLANNED'})}><Plus size={14}/>Term</button></section>)}</div>}
    {tab === 'departments' && <div className="grid md:grid-cols-2 gap-4">{data.departments.map(dep => <section key={dep.id} className="panel"><div className="flex justify-between"><h2 className="font-semibold">{dep.code} · {dep.name}</h2><button onClick={() => remove('departments',dep.id)}><Trash2 size={17}/></button></div>{dep.programs.map(p => <div key={p.id} className="tag mt-2">{p.code} · {p.name}</div>)}<button className="btn mt-3" onClick={() => setForm({resource:'programs',departmentId:dep.id,code:'',name:'',degreeType:'',requiredCredits:120})}><Plus size={14}/>Program</button></section>)}</div>}
    {tab === 'gradeLevels' && <><SimpleList items={[...data.gradeLevels.map(x=>({...x,resource:'grade-levels'})),...data.subjects.map(x=>({...x,resource:'subjects'}))]} onRemove={remove} /><button className="btn mt-3" onClick={() => setForm({resource:'subjects',code:'',name:'',description:''})}><Plus size={14}/>Subject</button></>}
    {tab === 'policies' && <SimpleList items={data.policies.map(x=>({...x,resource:'credit-policies', name:`${x.name} · 1 кредит = ${x.contactHoursPerCredit} цаг`}))} onRemove={remove}/>}
    {tab === 'campuses' && <div className="space-y-4">{data.campuses.map(c => <section key={c.id} className="panel"><h2 className="font-semibold">{c.code} · {c.name}</h2>{c.buildings.map(b=><div key={b.id} className="mt-3 border-t pt-3"><b>{b.code} · {b.name}</b><div className="flex flex-wrap gap-2 mt-2">{b.rooms.map(r=><span className="tag" key={r.id}>{r.code} · {r.name} ({r.capacity||'–'})</span>)}</div><button className="btn mt-2" onClick={()=>setForm({resource:'rooms',buildingId:b.id,code:'',name:'',capacity:30,type:'CLASSROOM'})}>Өрөө нэмэх</button></div>)}<button className="btn mt-3" onClick={()=>setForm({resource:'buildings',campusId:c.id,code:'',name:''})}>Барилга нэмэх</button></section>)}</div>}
    {tab === 'holidays' && <SimpleList items={data.holidays.map(x=>({...x,resource:'holidays',name:`${x.name} · ${isoDate(x.startDate)} – ${isoDate(x.endDate)}`}))} onRemove={remove}/>}
  </div>;
}
const labelFor = key => ({name:'Нэр',code:'Код',startDate:'Эхлэх огноо',endDate:'Дуусах огноо',status:'Төлөв',description:'Тайлбар',order:'Дараалал',contactHoursPerCredit:'1 кредитийн контакт цаг',minCredits:'Доод кредит',maxCredits:'Дээд кредит',isDefault:'Үндсэн бодлого',address:'Хаяг',degreeType:'Зэрэг',requiredCredits:'Шаардлагатай кредит',capacity:'Багтаамж',type:'Төрөл',termId:'Term ID'}[key] || key);
function SimpleList({items,onRemove}) { return <div className="grid md:grid-cols-2 gap-3">{items.map(item=><div className="panel flex justify-between" key={`${item.resource}-${item.id}`}><span>{item.code && `${item.code} · `}{item.name}</span><button onClick={()=>onRemove(item.resource,item.id)}><Trash2 size={17}/></button></div>)}</div>; }
