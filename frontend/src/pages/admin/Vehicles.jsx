import { useState, useEffect } from 'react';
import { Truck, Plus, Fuel, Wrench, X, Pencil, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { PageHeader, Modal, EmptyState, ConfirmDialog } from '../../components/ui';

const fmt = n => `Rs ${Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:0})}`;

const EXP_TYPES = [
  { value:'diesel',    label:'Diesel',    color:'badge-yellow' },
  { value:'service',   label:'Service',   color:'badge-blue' },
  { value:'rent',      label:'Rent',      color:'badge-gray' },
  { value:'insurance', label:'Insurance', color:'badge-green' },
  { value:'other',     label:'Other',     color:'badge-gray' },
];

const emptyForm = {
  reg_number:'', make_model:'', use_type:'commercial', ownership_type:'owned',
  owner_name:'', owner_phone:'', monthly_rent:'',
  capacity_liters:'', purchase_price:'', payment_type:'full',
  installment_months:'', installment_paid:'0', notes:''
};

export default function Vehicles() {
  const [vehicles, setVehicles]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(null); // 'add'|'edit'|'expenses'
  const [selV, setSel]            = useState(null);
  const [expenses, setExpenses]   = useState([]);
  const [saving, setSaving]       = useState(false);
  const [deactTarget, setDeact]   = useState(null);
  const [form, setForm]           = useState(emptyForm);
  const [expForm, setExpForm]     = useState({ expense_type:'diesel', expense_date: new Date().toISOString().slice(0,10), amount:'', notes:'' });

  const load = () => {
    setLoading(true);
    api.get('/vehicles').then(r => setVehicles(r.data.data||[])).finally(()=>setLoading(false));
  };
  useEffect(()=>{ load(); },[]);

  const openExpenses = (v) => {
    setSel(v); setModal('expenses');
    api.get(`/vehicles/${v.id}/expenses`).then(r=>setExpenses(r.data.data||[]));
  };

  const openEdit = (v) => {
    setSel(v);
    setForm({ reg_number:v.reg_number, make_model:v.make_model||'', use_type:v.use_type||'commercial',
      ownership_type:v.ownership_type||'owned', owner_name:v.owner_name||'',
      owner_phone:v.owner_phone||'', monthly_rent:v.monthly_rent||'',
      capacity_liters:v.capacity_liters||'', purchase_price:v.purchase_price||'',
      payment_type:v.payment_type||'full', installment_months:v.installment_months||'',
      installment_paid:v.installment_paid||'0', notes:v.notes||'' });
    setModal('edit');
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (modal==='edit') await api.put(`/vehicles/${selV.id}`, form);
      else await api.post('/vehicles', form);
      toast.success(modal==='edit'?'Vehicle updated':'Vehicle added');
      setModal(null); setForm(emptyForm); load();
    } catch(err){ toast.error(err.response?.data?.message||'Failed'); }
    finally{ setSaving(false); }
  };

  const onExpense = async (e) => {
    e.preventDefault();
    if (!expForm.amount) return toast.error('Amount required');
    setSaving(true);
    try {
      await api.post(`/vehicles/${selV.id}/expenses`, expForm);
      toast.success('Expense recorded');
      setExpForm(p=>({...p,amount:'',notes:''}));
      api.get(`/vehicles/${selV.id}/expenses`).then(r=>setExpenses(r.data.data||[]));
      load();
    } catch(err){ toast.error(err.response?.data?.message||'Failed'); }
    finally{ setSaving(false); }
  };

  const deactivate = async () => {
    try{ await api.patch(`/vehicles/${deactTarget.id}/deactivate`); toast.success('Deactivated'); load(); }
    catch{ toast.error('Failed'); } finally{ setDeact(null); }
  };

  const monthlyInstallment = form.payment_type==='installment' && form.purchase_price && form.installment_months
    ? parseFloat(form.purchase_price)/parseInt(form.installment_months) : null;
  const remaining = monthlyInstallment
    ? (parseInt(form.installment_months)-parseInt(form.installment_paid||0))*monthlyInstallment : null;

  const VehicleForm = () => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Reg Number *</label>
          <input value={form.reg_number} onChange={e=>setForm(p=>({...p,reg_number:e.target.value}))}
            className="input" placeholder="LEA-1234"/></div>
        <div><label className="label">Make / Model</label>
          <input value={form.make_model} onChange={e=>setForm(p=>({...p,make_model:e.target.value}))}
            className="input" placeholder="Shehzore 2022"/></div>
      </div>

      {/* Use Type */}
      <div><label className="label">Use Type</label>
        <div className="grid grid-cols-2 gap-2">
          {['commercial','residential'].map(t=>(
            <button key={t} type="button" onClick={()=>setForm(p=>({...p,use_type:t,capacity_liters:t==='residential'?'':p.capacity_liters}))}
              className={`py-2.5 rounded-xl text-sm font-semibold border-2 capitalize transition
                ${form.use_type===t?'border-[#1d6faa] bg-blue-50 text-[#1d6faa]':'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Capacity - only for commercial */}
      {form.use_type==='commercial' && (
        <div><label className="label">Milk Capacity (Liters)</label>
          <input type="number" step="0.1" value={form.capacity_liters}
            onChange={e=>setForm(p=>({...p,capacity_liters:e.target.value}))}
            className="input font-mono" placeholder="e.g. 500"/></div>
      )}

      {/* Ownership */}
      <div><label className="label">Ownership</label>
        <div className="grid grid-cols-2 gap-2">
          {['owned','rented'].map(t=>(
            <button key={t} type="button" onClick={()=>setForm(p=>({...p,ownership_type:t}))}
              className={`py-2.5 rounded-xl text-sm font-semibold border-2 capitalize transition
                ${form.ownership_type===t?'border-[#1d6faa] bg-blue-50 text-[#1d6faa]':'border-slate-200 text-slate-500'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Owned → purchase */}
      {form.ownership_type==='owned' && (
        <div className="border border-slate-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-600">Purchase Details</p>
          <div><label className="label">Invoice Amount (PKR)</label>
            <input type="number" step="1000" value={form.purchase_price}
              onChange={e=>setForm(p=>({...p,purchase_price:e.target.value}))}
              className="input font-mono" placeholder="1,500,000"/></div>
          <div className="grid grid-cols-2 gap-2">
            {[['full','Full Payment'],['installment','Installments']].map(([t,l])=>(
              <button key={t} type="button" onClick={()=>setForm(p=>({...p,payment_type:t}))}
                className={`py-2 rounded-xl text-sm font-medium border-2 transition
                  ${form.payment_type===t?'border-[#1d6faa] bg-blue-50 text-[#1d6faa]':'border-slate-200 text-slate-500'}`}>
                {l}
              </button>
            ))}
          </div>
          {form.payment_type==='installment' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label">Total Months</label>
                  <input type="number" min="1" value={form.installment_months}
                    onChange={e=>setForm(p=>({...p,installment_months:e.target.value}))} className="input font-mono"/></div>
                <div><label className="label">Months Paid</label>
                  <input type="number" min="0" value={form.installment_paid}
                    onChange={e=>setForm(p=>({...p,installment_paid:e.target.value}))} className="input font-mono"/></div>
              </div>
              {monthlyInstallment && (
                <div className="bg-blue-50 rounded-lg p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-slate-600">Monthly</span><span className="font-bold text-[#1d6faa] font-mono">{fmt(monthlyInstallment)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Remaining ({parseInt(form.installment_months)-parseInt(form.installment_paid||0)} months)</span><span className="font-bold text-red-500 font-mono">{fmt(remaining)}</span></div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Rented */}
      {form.ownership_type==='rented' && (
        <div className="border border-slate-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-600">Owner Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Owner Name</label>
              <input value={form.owner_name} onChange={e=>setForm(p=>({...p,owner_name:e.target.value}))} className="input"/></div>
            <div><label className="label">Owner Phone</label>
              <input value={form.owner_phone} onChange={e=>setForm(p=>({...p,owner_phone:e.target.value}))} className="input"/></div>
          </div>
          <div><label className="label">Monthly Rent (PKR)</label>
            <input type="number" step="100" value={form.monthly_rent}
              onChange={e=>setForm(p=>({...p,monthly_rent:e.target.value}))} className="input font-mono"/></div>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={()=>setModal(null)} className="btn-ghost">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary">{saving?'Saving…':modal==='edit'?'Save Changes':'Add Vehicle'}</button>
      </div>
    </form>
  );

  return (
    <div className="space-y-5">
      <PageHeader title="Vehicles" subtitle="Fleet management & expense tracking"
        action={<button onClick={()=>{ setForm(emptyForm); setModal('add'); }} className="btn-primary"><Plus size={16}/>Add Vehicle</button>}/>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label:'Total', value: vehicles.length, sub: 'vehicles' },
          { label:'Commercial', value: vehicles.filter(v=>v.use_type==='commercial').length, sub: 'milk delivery' },
          { label:'Rented', value: vehicles.filter(v=>v.ownership_type==='rented').length, sub: 'rental fleet' },
          { label:'Total Expenses', value: fmt(vehicles.reduce((s,v)=>s+parseFloat(v.total_expenses||0),0)), sub: 'all time' },
        ].map(({label,value,sub})=>(
          <div key={label} className="card">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className="text-xl font-bold text-slate-800">{value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Vehicle grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? [...Array(3)].map((_,i)=>(
          <div key={i} className="card animate-pulse"><div className="h-4 bg-slate-200 rounded w-3/4 mb-2"/><div className="h-3 bg-slate-100 rounded w-1/2"/></div>
        )) : vehicles.length===0 ? (
          <div className="col-span-3"><EmptyState icon={Truck} title="No vehicles" description="Add your fleet"/></div>
        ) : vehicles.map(v=>(
          <div key={v.id} className={`card space-y-3 ${!v.is_active?'opacity-50':''}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-slate-800">{v.reg_number}</p>
                <p className="text-sm text-slate-500">{v.make_model||'—'}</p>
              </div>
              <div className="flex gap-1.5">
                <span className={`badge text-xs ${v.ownership_type==='owned'?'badge-blue':'badge-yellow'}`}>{v.ownership_type}</span>
                <span className="badge badge-gray text-xs">{v.use_type}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
              {v.capacity_liters && <span>🥛 {v.capacity_liters}L capacity</span>}
              {v.ownership_type==='rented' && v.monthly_rent && <span className="text-amber-600">Rent: {fmt(v.monthly_rent)}/mo</span>}
              {v.payment_type==='installment' && v.installment_months && (
                <span className="col-span-2 text-red-500">
                  Installment: {v.installment_paid}/{v.installment_months} months paid
                </span>
              )}
              <span className="text-red-500">Expenses: {fmt(v.total_expenses)}</span>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={()=>openExpenses(v)} className="btn-primary flex-1 text-xs py-1.5"><Fuel size={13}/>Expenses</button>
              <button onClick={()=>openEdit(v)} className="btn-ghost p-1.5"><Pencil size={14}/></button>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={modal==='add'} onClose={()=>setModal(null)} title="Add Vehicle" size="md"><VehicleForm/></Modal>
      <Modal isOpen={modal==='edit'} onClose={()=>setModal(null)} title={`Edit: ${selV?.reg_number}`} size="md"><VehicleForm/></Modal>

      {/* Expenses Modal */}
      <Modal isOpen={modal==='expenses'} onClose={()=>setModal(null)} title={`${selV?.reg_number} — Expenses`} size="md">
        <div className="space-y-5">
          <form onSubmit={onExpense} className="border border-slate-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-600">Add Expense</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {EXP_TYPES.map(({value,label,color})=>(
                <button key={value} type="button" onClick={()=>setExpForm(p=>({...p,expense_type:value}))}
                  className={`py-2 rounded-xl text-xs font-semibold border-2 transition
                    ${expForm.expense_type===value?'border-[#1d6faa] bg-blue-50 text-[#1d6faa]':'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Date</label>
                <input type="date" value={expForm.expense_date}
                  onChange={e=>setExpForm(p=>({...p,expense_date:e.target.value}))} className="input"/></div>
              <div><label className="label">Amount (PKR)</label>
                <input type="number" step="0.01" value={expForm.amount}
                  onChange={e=>setExpForm(p=>({...p,amount:e.target.value}))} className="input font-mono"/></div>
            </div>
            <div><label className="label">Notes</label>
              <input value={expForm.notes} onChange={e=>setExpForm(p=>({...p,notes:e.target.value}))} className="input" placeholder="Optional"/></div>
            <button type="submit" disabled={saving} className="btn-primary w-full">{saving?'Saving…':'Add Expense'}</button>
          </form>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {expenses.length===0
              ? <p className="text-slate-400 text-sm text-center py-4">No expenses yet</p>
              : expenses.map(e=>(
                <div key={e.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`badge text-xs ${EXP_TYPES.find(t=>t.value===e.expense_type)?.color||'badge-gray'}`}>{e.expense_type}</span>
                    <span className="text-slate-400 text-xs">{e.expense_date?.slice(0,10)}</span>
                    {e.notes && <span className="text-slate-400 text-xs">· {e.notes}</span>}
                  </div>
                  <span className="font-mono font-semibold text-red-500">{fmt(e.amount)}</span>
                </div>
              ))
            }
          </div>

          {expenses.length>0 && (
            <div className="bg-red-50 rounded-xl px-4 py-2.5 flex justify-between text-sm font-semibold text-red-600">
              <span>Total Expenses</span>
              <span className="font-mono">{fmt(expenses.reduce((s,e)=>s+parseFloat(e.amount),0))}</span>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deactTarget} onClose={()=>setDeact(null)} onConfirm={deactivate}
        title="Deactivate Vehicle" message={`Remove ${deactTarget?.reg_number} from active fleet?`}/>
    </div>
  );
}
