import { useState, useEffect } from 'react';
import { FileText, Plus, Zap, CreditCard, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { PageHeader, Modal, SkeletonRow, EmptyState } from '../../components/ui';

const STATUS_BADGE={generated:'badge-yellow',paid:'badge-green',cancelled:'badge-red',open:'badge-blue',closed:'badge-gray'};
const fmtPKR=n=>`Rs ${Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:0})}`;
const MONTHS=['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function Billing() {
  const [periods,setPeriods]=useState([]); const [bills,setBills]=useState([]);
  const [selPeriod,setSelPeriod]=useState(null); const [loadP,setLoadP]=useState(true);
  const [loadB,setLoadB]=useState(false); const [generating,setGenerating]=useState(false);
  const [npm,setNpm]=useState(false); const [billDetail,setBillDetail]=useState(null);
  const [saving,setSaving]=useState(false);
  const [pf,setPf]=useState({period_month:new Date().getMonth()+1,period_year:new Date().getFullYear()});

  const loadPeriods=()=>{setLoadP(true);api.get('/billing/periods').then(r=>setPeriods(r.data.data||[])).finally(()=>setLoadP(false));};
  useEffect(()=>{loadPeriods();},[]);

  const loadBills=(p)=>{setSelPeriod(p);setLoadB(true);api.get(`/billing/bills?period_id=${p.id}`).then(r=>setBills(r.data.data||[])).finally(()=>setLoadB(false));};

  const createPeriod=async(e)=>{e.preventDefault();setSaving(true);try{await api.post('/billing/periods',pf);toast.success('Period created');setNpm(false);loadPeriods();}catch(err){toast.error(err.response?.data?.message||'Failed');}finally{setSaving(false);}};

  const generateBills=async()=>{if(!selPeriod)return;setGenerating(true);try{const r=await api.post('/billing/generate',{billing_period_id:selPeriod.id});toast.success(r.data.message);loadBills(selPeriod);}catch(err){toast.error(err.response?.data?.message||'Failed');}finally{setGenerating(false);}};

  const markPaid=async(id)=>{try{await api.patch(`/billing/bills/${id}/pay`);toast.success('Marked paid');loadBills(selPeriod);}catch(err){toast.error(err.response?.data?.message||'Failed');}};

  return (
    <div className="space-y-5">
      <PageHeader title="Billing" subtitle="Farmer payment billing periods"
        action={<button onClick={()=>setNpm(true)} className="btn-primary"><Plus size={16}/>New Period</button>}/>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Periods</p>
          {loadP?[...Array(4)].map((_,i)=><div key={i} className="card animate-pulse h-16"/>):
           periods.length===0?<div className="card"><EmptyState icon={FileText} title="No periods"/></div>:
           periods.map(p=>(
            <button key={p.id} onClick={()=>loadBills(p)} className={`card w-full text-left hover:shadow-md transition ${selPeriod?.id===p.id?'ring-2 ring-[#1d6faa]':''}`}>
              <div className="flex items-center justify-between">
                <div><p className="font-semibold">{MONTHS[p.period_month]} {p.period_year}</p>
                <p className="text-xs text-slate-400">{p.bill_count||0} bills · {fmtPKR(p.total_payable)}</p></div>
                <div className="flex items-center gap-2"><span className={`badge text-xs ${STATUS_BADGE[p.status]||'badge-gray'}`}>{p.status}</span><ChevronRight size={14} className="text-slate-300"/></div>
              </div>
            </button>
          ))}
        </div>
        <div className="lg:col-span-2 space-y-4">
          {selPeriod?(
            <>
              <div className="card flex flex-wrap items-center gap-3">
                <div className="flex-1"><p className="font-semibold">{MONTHS[selPeriod.period_month]} {selPeriod.period_year}</p><p className="text-xs text-slate-400">{bills.length} bills</p></div>
                <button onClick={generateBills} disabled={generating||selPeriod.status==='closed'} className="btn-primary text-sm"><Zap size={14}/>{generating?'Generating…':'Generate Bills'}</button>
              </div>
              <div className="card p-0 overflow-hidden">
                <table className="table-auto w-full">
                  <thead><tr><th>Bill #</th><th>Farmer</th><th>Liters</th><th>Amount</th><th>Net Payable</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {loadB?[...Array(5)].map((_,i)=><SkeletonRow key={i} cols={7}/>):
                     bills.length===0?<tr><td colSpan={7}><EmptyState icon={FileText} title="No bills" description="Generate bills first"/></td></tr>:
                     bills.map(b=>(
                      <tr key={b.id}>
                        <td className="font-mono text-xs text-[#1d6faa]">{b.bill_number}</td>
                        <td><div className="font-medium text-sm">{b.farmer_name}</div><div className="text-xs text-slate-400">{b.farmer_code}</div></td>
                        <td className="font-mono">{Number(b.total_liters).toFixed(1)}</td>
                        <td className="font-mono">{fmtPKR(b.total_amount)}</td>
                        <td className="font-mono font-semibold text-[#1d6faa]">{fmtPKR(b.net_payable)}</td>
                        <td><span className={`badge text-xs ${STATUS_BADGE[b.status]||'badge-gray'}`}>{b.status}</span></td>
                        <td>{b.status==='generated'&&<button onClick={()=>markPaid(b.id)} className="btn-ghost text-xs py-1 px-2"><CreditCard size={12}/>Pay</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {bills.length>0&&<div className="card flex justify-between font-semibold text-sm">
                <span>Total Payable</span><span className="font-mono text-[#1d6faa] text-lg">{fmtPKR(bills.reduce((s,b)=>s+parseFloat(b.net_payable||0),0))}</span>
              </div>}
            </>
          ):<div className="card h-48 flex items-center justify-center text-slate-400 text-sm">← Select a period</div>}
        </div>
      </div>
      <Modal isOpen={npm} onClose={()=>setNpm(false)} title="New Billing Period" size="sm">
        <form onSubmit={createPeriod} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Month (1-12)</label><input type="number" min="1" max="12" value={pf.period_month} onChange={e=>setPf(p=>({...p,period_month:+e.target.value}))} className="input font-mono"/></div>
            <div><label className="label">Year</label><input type="number" min="2020" value={pf.period_year} onChange={e=>setPf(p=>({...p,period_year:+e.target.value}))} className="input font-mono"/></div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={()=>setNpm(false)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving?'Creating…':'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
