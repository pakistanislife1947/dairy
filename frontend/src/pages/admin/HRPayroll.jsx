import { useState, useEffect } from 'react';
import { UserCheck, Plus, CreditCard, DollarSign, Users, AlertCircle, Pencil, UserX, UserCheck2, Eye, EyeOff, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import api from '../../api/client';
import { PageHeader, Modal, SkeletonRow, EmptyState, ConfirmDialog } from '../../components/ui';

const fmt = n => `Rs ${Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:0})}`;

const DEPT_LABELS = {
  milk_collection:'Milk Collection', sales:'Sales', accounts:'Accounts',
  hr:'HR', manager:'Manager', other:'Other'
};
const DEPT_PERMS = {
  milk_collection:['milk','customers_view','dashboard'],
  sales:          ['sales','customers','products','dashboard'],
  accounts:       ['billing','reports','customers','dashboard'],
  hr:             ['hr','expenses','dashboard'],
  manager:        ['milk','sales','billing','customers','products','hr','expenses','reports','dashboard'],
  other:          ['dashboard'],
};
const ALL_PERMS = ['dashboard','milk','customers','customers_view','sales','billing','products','hr','expenses','reports','settings'];

const deptColor = { milk_collection:'badge-blue', sales:'badge-green', accounts:'badge-yellow', hr:'badge-gray', manager:'bg-purple-100 text-purple-700', other:'badge-gray' };

export default function HRPayroll() {
  const [tab, setTab]         = useState('employees');
  const [employees, setEmps]  = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null);
  const [selEmp, setSel]      = useState(null);
  const [saving, setSaving]   = useState(false);
  const [payMonth, setMonth]  = useState(format(new Date(),'yyyy-MM'));
  const [showPass, setShowPass] = useState(false);
  const [fireTarget, setFire] = useState(null);
  const [showFired, setShowFired] = useState(false);

  const emptyForm = { name:'', phone:'', join_date:'', designation:'', department:'sales', base_salary:'', email:'', password:'', extra_permissions:[] };
  const [form, setForm]       = useState(emptyForm);
  const [advForm, setAdvForm] = useState({ amount:'', advance_date: new Date().toISOString().slice(0,10), notes:'' });
  const [hrTab, setHrTab]     = useState('advance');
  const [retForm, setRetForm] = useState({ amount:'', return_date: new Date().toISOString().slice(0,10), notes:'' });
  const [adjForm, setAdjForm] = useState({ type:'bonus', amount:'', apply_month: new Date().toISOString().slice(0,7), reason:'' });

  const loadEmps = () => {
    setLoading(true);
    const endpoint = showFired ? '/hr/employees/all' : '/hr/employees';
    api.get(endpoint).then(r=>setEmps(r.data.data||[])).finally(()=>setLoading(false));
  };
  const loadPayroll = () => api.get(`/hr/payroll?month=${payMonth}`).then(r=>setPayroll(r.data.data||[]));

  useEffect(()=>{ loadEmps(); },[showFired]);
  useEffect(()=>{ if(tab==='payroll') loadPayroll(); },[tab,payMonth]);

  const openEdit = (e) => {
    setSel(e);
    setForm({ name:e.name, phone:e.phone||'', join_date:e.join_date?.slice(0,10)||'', designation:e.designation||'',
      department:e.department||'other', base_salary:e.base_salary, email:'', password:'',
      extra_permissions: e.extra_perms||[] });
    setModal('edit');
  };

  const onEmployee = async (ev) => {
    ev.preventDefault();
    if (!form.name || !form.base_salary) return toast.error('Name and salary required');
    setSaving(true);
    try {
      if (modal==='edit') {
        await api.put(`/hr/employees/${selEmp.id}`, form);
        toast.success('Employee updated');
      } else {
        await api.post('/hr/employees', form);
        toast.success('Employee added' + (form.email?' with login':''));
      }
      setModal(null); setForm(emptyForm); loadEmps();
    } catch (err) { toast.error(err.response?.data?.message||'Failed'); }
    finally { setSaving(false); }
  };

  const onAdvance = async (ev) => {
    ev.preventDefault();
    setSaving(true);
    try {
      await api.post(`/hr/employees/${selEmp.id}/advances`, advForm);
      toast.success('Advance recorded — auto-deducted in next payroll');
      setModal(null); setAdvForm({ amount:'', advance_date:new Date().toISOString().slice(0,10), notes:'' }); loadEmps();
    } catch (err) { toast.error(err.response?.data?.message||'Failed'); }
    finally { setSaving(false); }
  };

  const onReturn = async (ev) => {
    ev.preventDefault();
    setSaving(true);
    try {
      await api.post(`/hr/employees/${selEmp.id}/advance-return`, retForm);
      toast.success('Advance return recorded');
      setModal(null); setRetForm({ amount:'', return_date:new Date().toISOString().slice(0,10), notes:'' }); loadEmps();
    } catch (err) { toast.error(err.response?.data?.message||'Failed'); }
    finally { setSaving(false); }
  };

  const onAdjustment = async (ev) => {
    ev.preventDefault();
    if (!adjForm.amount) return toast.error('Amount required');
    setSaving(true);
    try {
      await api.post(`/hr/employees/${selEmp.id}/adjustment`, adjForm);
      toast.success(`${adjForm.type==='bonus'?'Bonus':'Deduction'} recorded for ${adjForm.apply_month}`);
      setModal(null); setAdjForm({ type:'bonus', amount:'', apply_month:new Date().toISOString().slice(0,7), reason:'' });
    } catch (err) { toast.error(err.response?.data?.message||'Failed'); }
    finally { setSaving(false); }
  };

  const fireEmp = async () => {
    try { await api.patch(`/hr/employees/${fireTarget.id}/fire`); toast.success('Employee deactivated'); loadEmps(); }
    catch { toast.error('Failed'); } finally { setFire(null); }
  };

  const activateEmp = async (e) => {
    try { await api.patch(`/hr/employees/${e.id}/activate`); toast.success('Employee reactivated'); loadEmps(); }
    catch { toast.error('Failed'); }
  };

  const processPayroll = async () => {
    setSaving(true);
    try {
      const r = await api.post('/hr/payroll/process', { payroll_month: payMonth });
      toast.success(r.data.message); loadPayroll();
    } catch (err) { toast.error(err.response?.data?.message||'Failed'); }
    finally { setSaving(false); }
  };

  const togglePerm = (perm) => {
    setForm(p => ({
      ...p,
      extra_permissions: p.extra_permissions.includes(perm)
        ? p.extra_permissions.filter(x=>x!==perm)
        : [...p.extra_permissions, perm]
    }));
  };

  const deptDefaultPerms = DEPT_PERMS[form.department] || [];

  const TABS = [{ id:'employees',label:'Employees',icon:Users },{ id:'payroll',label:'Payroll',icon:DollarSign }];

  return (
    <div className="space-y-6">
      <PageHeader title="HR & Payroll" subtitle="Team management with role-based access"
        action={<button onClick={()=>{ setModal('add'); setForm(emptyForm); }} className="btn-primary"><Plus size={16}/>Add Employee</button>}/>

      <div className="flex gap-1 bg-white border border-[#d1dce8] rounded-xl p-1 w-fit">
        {TABS.map(({id,label,icon:Icon})=>(
          <button key={id} onClick={()=>setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition
              ${tab===id?'bg-[#1d6faa] text-white':'text-slate-500 hover:text-slate-700'}`}>
            <Icon size={15}/>{label}
          </button>
        ))}
      </div>

      {tab==='employees' && (
        <>
          <div className="flex justify-end">
            <button onClick={()=>setShowFired(p=>!p)} className={`btn-ghost text-xs ${showFired?'text-red-500':''}`}>
              {showFired?'Hide Fired':'Show Fired Staff'}
            </button>
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="table-auto w-full">
              <thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Salary</th><th>Advance</th><th>Login</th><th>Actions</th></tr></thead>
              <tbody>
                {loading ? [...Array(5)].map((_,i)=><SkeletonRow key={i} cols={7}/>) :
                 employees.length===0 ? <tr><td colSpan={7}><EmptyState icon={UserCheck} title="No employees"/></td></tr> :
                 employees.map(e=>(
                  <tr key={e.id} className={!e.is_active?'opacity-50':''}>
                    <td><span className="font-mono text-xs text-[#1d6faa]">{e.emp_code}</span></td>
                    <td>
                      <div className="font-medium">{e.name}</div>
                      <div className="text-xs text-slate-400">{e.designation}</div>
                    </td>
                    <td><span className={`badge text-xs ${deptColor[e.department]||'badge-gray'}`}>{DEPT_LABELS[e.department]||e.department}</span></td>
                    <td><span className="font-mono text-emerald-600 font-semibold">{fmt(e.base_salary)}</span></td>
                    <td>{parseFloat(e.pending_advance)>0
                      ? <span className="text-amber-600 font-mono text-sm flex items-center gap-1"><AlertCircle size={12}/>{fmt(e.pending_advance)}</span>
                      : <span className="text-slate-400 text-xs">—</span>}</td>
                    <td>{e.user_id ? <span className="badge-green text-xs flex items-center gap-1"><Shield size={10}/>Active</span> : <span className="badge-gray text-xs">No Login</span>}</td>
                    <td>
                      <div className="flex gap-1.5">
                        {e.is_active ? <>
                          <button onClick={()=>openEdit(e)} className="btn-ghost p-1.5" title="Edit"><Pencil size={13}/></button>
                          <button onClick={()=>{ setSel(e); setModal('advance'); }} className="btn-ghost p-1.5" title="Advance"><CreditCard size={13}/></button>
                          <button onClick={()=>setFire(e)} className="btn-danger p-1.5" title="Fire"><UserX size={13}/></button>
                        </> : <>
                          <button onClick={()=>activateEmp(e)} className="btn-ghost p-1.5 text-emerald-600" title="Reactivate"><UserCheck2 size={13}/></button>
                        </>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab==='payroll' && (
        <div className="space-y-4">
          <div className="card flex flex-wrap items-end gap-4">
            <div><label className="label">Month</label>
              <input type="month" className="input w-44" value={payMonth} onChange={e=>setMonth(e.target.value)}/></div>
            <button onClick={processPayroll} disabled={saving} className="btn-primary">
              <CreditCard size={16}/>{saving?'Processing…':'Process Payroll'}
            </button>
            <p className="text-xs text-slate-400 self-end">Advances auto-deducted. Expense entry auto-created.</p>
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="table-auto w-full">
              <thead><tr><th>Employee</th><th>Base</th><th>Allowances</th><th>Adv. Deduction</th><th>Net Pay</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {payroll.length===0
                  ? <tr><td colSpan={7}><EmptyState icon={DollarSign} title="No payroll" description={`Process for ${payMonth}`}/></td></tr>
                  : payroll.map(p=>(
                    <tr key={p.id}>
                      <td><div className="font-medium">{p.employee_name}</div><div className="text-xs text-slate-400 font-mono">{p.emp_code}</div></td>
                      <td className="font-mono">{fmt(p.base_salary)}</td>
                      <td className="font-mono text-emerald-600">{parseFloat(p.allowances)>0?fmt(p.allowances):'—'}</td>
                      <td className="font-mono text-red-500">{parseFloat(p.advance_deduction)>0?`-${fmt(p.advance_deduction)}`:'—'}</td>
                      <td className="font-mono font-bold text-emerald-600">{fmt(p.net_salary)}</td>
                      <td><span className={`badge ${p.status==='paid'?'badge-green':'badge-yellow'}`}>{p.status}</span></td>
                      <td>{p.status==='draft'&&<button onClick={async()=>{ await api.patch(`/hr/payroll/${p.id}/pay`); loadPayroll(); }} className="btn-ghost text-xs py-1 px-2">Pay</button>}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Employee Modal */}
      <Modal isOpen={modal==='add'||modal==='edit'} onClose={()=>setModal(null)} title={modal==='edit'?`Edit: ${selEmp?.name}`:'Add Employee'} size="md">
        <form onSubmit={onEmployee} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Full Name *</label>
              <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="input" placeholder="Muhammad Ali"/></div>
            <div><label className="label">Phone</label>
              <input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} className="input"/></div>
            <div><label className="label">Join Date</label>
              <input type="date" value={form.join_date} onChange={e=>setForm(p=>({...p,join_date:e.target.value}))} className="input"/></div>
            <div><label className="label">Designation</label>
              <input value={form.designation} onChange={e=>setForm(p=>({...p,designation:e.target.value}))} className="input" placeholder="Driver, Accountant…"/></div>
            <div><label className="label">Department *</label>
              <select value={form.department} onChange={e=>setForm(p=>({...p,department:e.target.value,extra_permissions:[]}))} className="input">
                {Object.entries(DEPT_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select></div>
            <div className="col-span-2"><label className="label">Base Salary (PKR) *</label>
              <input type="number" step="100" value={form.base_salary} onChange={e=>setForm(p=>({...p,base_salary:e.target.value}))} className="input font-mono" placeholder="25000"/></div>
          </div>

          {/* Permissions preview */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Shield size={15} className="text-[#1d6faa]"/>
              <p className="text-sm font-semibold text-slate-600">Access Permissions</p>
            </div>
            <p className="text-xs text-slate-400">Department default: <span className="font-medium text-slate-600">{deptDefaultPerms.join(', ')}</span></p>
            <p className="text-xs font-medium text-slate-600 mt-2">Extra permissions:</p>
            <div className="flex flex-wrap gap-2">
              {ALL_PERMS.filter(p=>!deptDefaultPerms.includes(p)).map(perm=>(
                <button key={perm} type="button" onClick={()=>togglePerm(perm)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition capitalize
                    ${form.extra_permissions.includes(perm)?'bg-[#1d6faa] text-white border-[#1d6faa]':'border-slate-200 text-slate-500 hover:border-[#1d6faa]'}`}>
                  {perm}
                </button>
              ))}
            </div>
          </div>

          {/* Login (only on add) */}
          {modal==='add' && (
            <div className="border border-dashed border-[#d1dce8] rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-600">Staff Login (optional)</p>
              <div><label className="label">Email</label>
                <input type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} className="input" placeholder="ali@dairy.local"/></div>
              <div><label className="label">Password</label>
                <div className="relative">
                  <input type={showPass?'text':'password'} value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} className="input pr-10" placeholder="Min 8 characters"/>
                  <button type="button" onClick={()=>setShowPass(p=>!p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showPass?<EyeOff size={15}/>:<Eye size={15}/>}</button>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={()=>setModal(null)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving?'Saving…':modal==='edit'?'Save Changes':'Add Employee'}</button>
          </div>
        </form>
      </Modal>

      {/* Advance Modal */}
      <Modal isOpen={modal==='advance'} onClose={()=>setModal(null)} title={`HR Actions — ${selEmp?.name}`} size="sm">
        <div className="space-y-4">
          <div className="flex gap-2 mb-2">
            {['advance','return','adjustment'].map(t=>(
              <button key={t} type="button" onClick={()=>setHrTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${hrTab===t?'bg-[#1d6faa] text-white':'bg-slate-100 text-slate-500'}`}>{t==='advance'?'Give Advance':t==='return'?'Return Advance':'Bonus/Deduction'}</button>
            ))}
          </div>
        <form onSubmit={hrTab==='advance'?onAdvance:hrTab==='return'?onReturn:onAdjustment} className="space-y-4">
          {hrTab==='advance' && <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
            <p className="font-semibold">Pending: {fmt(selEmp?.pending_advance)}</p>
            <p className="text-xs mt-1">Auto-deducted in next payroll run.</p>
          </div>}
          <div><label className="label">Amount (PKR) *</label>
            <input type="number" step="100" value={advForm.amount} onChange={e=>setAdvForm(p=>({...p,amount:e.target.value}))} className="input font-mono" placeholder="5000"/></div>
          <div><label className="label">Date</label>
            <input type="date" value={advForm.advance_date} onChange={e=>setAdvForm(p=>({...p,advance_date:e.target.value}))} className="input"/></div>
          <div><label className="label">Notes</label>
            <input value={advForm.notes} onChange={e=>setAdvForm(p=>({...p,notes:e.target.value}))} className="input"/></div>
          {hrTab==='return' && <>
            <div><label className="label">Return Amount (PKR)</label><input type="number" step="100" value={retForm.amount} onChange={e=>setRetForm(p=>({...p,amount:e.target.value}))} className="input font-mono"/></div>
            <div><label className="label">Date</label><input type="date" value={retForm.return_date} onChange={e=>setRetForm(p=>({...p,return_date:e.target.value}))} className="input"/></div>
            <div><label className="label">Notes</label><input value={retForm.notes} onChange={e=>setRetForm(p=>({...p,notes:e.target.value}))} className="input"/></div>
          </>}
          {hrTab==='adjustment' && <>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={()=>setAdjForm(p=>({...p,type:'bonus'}))}
                className={`py-2 rounded-xl border-2 text-sm font-semibold transition ${adjForm.type==='bonus'?'border-emerald-500 bg-emerald-50 text-emerald-700':'border-slate-200 text-slate-500'}`}>Bonus ➕</button>
              <button type="button" onClick={()=>setAdjForm(p=>({...p,type:'deduction'}))}
                className={`py-2 rounded-xl border-2 text-sm font-semibold transition ${adjForm.type==='deduction'?'border-red-500 bg-red-50 text-red-700':'border-slate-200 text-slate-500'}`}>Deduction ➖</button>
            </div>
            <div><label className="label">Amount (PKR)</label><input type="number" step="100" value={adjForm.amount} onChange={e=>setAdjForm(p=>({...p,amount:e.target.value}))} className="input font-mono"/></div>
            <div><label className="label">Apply Month</label><input type="month" value={adjForm.apply_month} onChange={e=>setAdjForm(p=>({...p,apply_month:e.target.value}))} className="input"/></div>
            <div><label className="label">Reason</label><input value={adjForm.reason} onChange={e=>setAdjForm(p=>({...p,reason:e.target.value}))} className="input"/></div>
          </>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={()=>setModal(null)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving?'…':hrTab==='advance'?'Record Advance':hrTab==='return'?'Record Return':'Save'}</button>
          </div>
        </form>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!fireTarget} onClose={()=>setFire(null)} onConfirm={fireEmp}
        title="Fire Employee" message={`Deactivate ${fireTarget?.name}? Their login will be disabled.`} danger/>
    </div>
  );
}
