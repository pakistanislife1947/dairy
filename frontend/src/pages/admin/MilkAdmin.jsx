import { useState, useEffect, useCallback } from 'react';
import { Milk, Plus, Filter, TrendingUp, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { PageHeader, Modal, SkeletonRow, EmptyState, StatCard } from '../../components/ui';

const fmt=n=>`Rs ${Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:0})}`;
const fmtL=n=>`${Number(n||0).toFixed(1)}L`;

export default function MilkAdmin() {
  const [records,setRecords]=useState([]); const [farmers,setFarmers]=useState([]);
  const [kpi,setKpi]=useState(null); const [loading,setLoading]=useState(true);
  const [modal,setModal]=useState(false); const [saving,setSaving]=useState(false);
  const [preview,setPreview]=useState(null);
  const [filters,setFilters]=useState({farmer_id:'',shift:'',date_from:'',date_to:''});
  const [form,setForm]=useState({farmer_id:'',collection_date:new Date().toISOString().slice(0,10),shift:'morning',quantity_liters:'',fat_percentage:'',snf_percentage:'',notes:''});

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const q=new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v])=>v)));
      const[recs,kpiRes]=await Promise.all([api.get(`/milk?${q}&limit=100`),api.get('/milk/kpi').catch(()=>({data:{data:null}}))]);
      setRecords(recs.data.data||[]);setKpi(kpiRes.data.data);
    }catch{toast.error('Load failed');}finally{setLoading(false);}
  },[filters]);

  useEffect(()=>{api.get('/farmers?active=1').then(r=>setFarmers(r.data.data||[]));},[]);
  useEffect(()=>{load();},[load]);

  useEffect(()=>{
    if(!form.farmer_id||!form.fat_percentage)return;
    api.post('/milk/preview-rate',{farmer_id:form.farmer_id,fat_percentage:form.fat_percentage,snf_percentage:form.snf_percentage}).then(r=>setPreview(r.data.data)).catch(()=>{});
  },[form.farmer_id,form.fat_percentage,form.snf_percentage]);

  const onSubmit=async(e)=>{
    e.preventDefault();
    if(!form.farmer_id||!form.quantity_liters||!form.fat_percentage)return toast.error('Fill required fields');
    setSaving(true);
    try{await api.post('/milk',form);toast.success('Record saved');setModal(false);setForm(p=>({...p,quantity_liters:'',fat_percentage:'',snf_percentage:'',notes:''}));setPreview(null);load();}
    catch(err){toast.error(err.response?.data?.message||'Failed');}finally{setSaving(false);}
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Milk Collection" subtitle="Daily records & FAT-based pricing"
        action={<button onClick={()=>setModal(true)} className="btn-primary"><Plus size={16}/>Add Record</button>}/>
      {kpi&&<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[{title:"Today",value:fmtL(kpi.today_liters),sub:fmt(kpi.today_amount),icon:Milk,color:'brand'},
          {title:'This Month',value:fmtL(kpi.month_liters),sub:fmt(kpi.month_amount),icon:TrendingUp,color:'green'},
          {title:'Avg FAT',value:`${Number(kpi.avg_fat||0).toFixed(2)}%`,sub:'this month',icon:Filter,color:'amber'},
          {title:'Farmers',value:kpi.active_farmers||0,sub:'active',icon:Clock,color:'blue'}
        ].map(s=><StatCard key={s.title} {...s}/>)}
      </div>}
      <div className="card flex flex-wrap gap-3 items-end">
        <div><label className="label">Farmer</label><select className="input" value={filters.farmer_id} onChange={e=>setFilters(p=>({...p,farmer_id:e.target.value}))}>
          <option value="">All</option>{farmers.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
        <div><label className="label">Shift</label><select className="input" value={filters.shift} onChange={e=>setFilters(p=>({...p,shift:e.target.value}))}>
          <option value="">All</option><option value="morning">Morning</option><option value="evening">Evening</option></select></div>
        <div><label className="label">From</label><input type="date" className="input" value={filters.date_from} onChange={e=>setFilters(p=>({...p,date_from:e.target.value}))}/></div>
        <div><label className="label">To</label><input type="date" className="input" value={filters.date_to} onChange={e=>setFilters(p=>({...p,date_to:e.target.value}))}/></div>
        <button onClick={load} className="btn-primary">Search</button>
      </div>
      <div className="card p-0 overflow-hidden">
        <table className="table-auto w-full">
          <thead><tr><th>Date</th><th>Farmer</th><th>Shift</th><th>Qty</th><th>FAT%</th><th>Rate/L</th><th>Amount</th></tr></thead>
          <tbody>
            {loading?[...Array(8)].map((_,i)=><SkeletonRow key={i} cols={7}/>):
             records.length===0?<tr><td colSpan={7}><EmptyState icon={Milk} title="No records" description="Add milk collection"/></td></tr>:
             records.map(r=>(
              <tr key={r.id}>
                <td className="font-mono text-xs text-slate-500">{r.collection_date?.slice(0,10)}</td>
                <td><div className="font-medium text-sm">{r.farmer_name}</div><div className="text-xs text-slate-400">{r.farmer_code}</div></td>
                <td><span className={`badge text-xs ${r.shift==='morning'?'badge-yellow':'badge-blue'}`}>{r.shift}</span></td>
                <td className="font-mono font-semibold">{Number(r.quantity_liters).toFixed(1)}L</td>
                <td className="font-mono">{r.fat_percentage}%</td>
                <td className="font-mono text-[#1d6faa]">{fmt(r.computed_rate)}</td>
                <td className="font-mono font-semibold">{fmt(r.total_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal isOpen={modal} onClose={()=>setModal(false)} title="Add Milk Collection" size="sm">
        <form onSubmit={onSubmit} className="space-y-4">
          <div><label className="label">Farmer *</label><select value={form.farmer_id} onChange={e=>setForm(p=>({...p,farmer_id:e.target.value}))} className="input">
            <option value="">Select…</option>{farmers.map(f=><option key={f.id} value={f.id}>{f.name} ({f.farmer_code})</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Date *</label><input type="date" value={form.collection_date} onChange={e=>setForm(p=>({...p,collection_date:e.target.value}))} className="input"/></div>
            <div><label className="label">Shift</label><select value={form.shift} onChange={e=>setForm(p=>({...p,shift:e.target.value}))} className="input"><option value="morning">🌅 Morning</option><option value="evening">🌙 Evening</option></select></div>
            <div><label className="label">Qty (L) *</label><input type="number" step="0.1" value={form.quantity_liters} onChange={e=>setForm(p=>({...p,quantity_liters:e.target.value}))} className="input font-mono"/></div>
            <div><label className="label">FAT % *</label><input type="number" step="0.01" value={form.fat_percentage} onChange={e=>setForm(p=>({...p,fat_percentage:e.target.value}))} className="input font-mono"/></div>
            <div><label className="label">SNF %</label><input type="number" step="0.01" value={form.snf_percentage} onChange={e=>setForm(p=>({...p,snf_percentage:e.target.value}))} className="input font-mono"/></div>
            <div><label className="label">Notes</label><input value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} className="input"/></div>
          </div>
          {preview&&<div className="bg-blue-50 rounded-xl p-3 grid grid-cols-3 gap-2 text-center text-sm">
            <div><p className="text-xs text-slate-400">Rate/L</p><p className="font-bold text-[#1d6faa] font-mono">{fmt(preview.computed_rate)}</p></div>
            <div><p className="text-xs text-slate-400">Amount</p><p className="font-bold text-[#1d6faa] font-mono">{fmt(parseFloat(form.quantity_liters||0)*parseFloat(preview.computed_rate||0))}</p></div>
            <div><p className="text-xs text-slate-400">Base</p><p className="font-semibold font-mono">{fmt(preview.base_rate)}</p></div>
          </div>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={()=>setModal(false)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving?'Saving…':'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
