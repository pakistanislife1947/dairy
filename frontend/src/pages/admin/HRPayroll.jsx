import { useState, useEffect } from 'react';
import { UserCheck, Plus, CreditCard, DollarSign, Users, AlertCircle, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import api from '../../api/client';
import { PageHeader, Modal, SkeletonRow, EmptyState } from '../../components/ui';

const fmt = n => `Rs ${Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:0})}`;

export default function HRPayroll() {
  const [tab, setTab]           = useState('employees');
  const [employees, setEmps]    = useState([]);
  const [payroll, setPayroll]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null); // 'employee'|'advance'
  const [selEmp, setSelEmp]     = useState(null);
  const [saving, setSaving]     = useState(false);
  const [payMonth, setPayMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [showPass, setShowPass] = useState(false);

  // Employee form
  const [empForm, setEmpForm] = useState({
    name:'', phone:'', join_date:'', designation:'', department:'', base_salary:'',
    email:'', password:'',
  });

  // Advance form
  const [advForm, setAdvForm] = useState({ amount:'', advance_date: new Date().toISOString().slice(0,10), notes:'' });

  const loadEmps    = () => api.get('/hr/employees').then(r=>setEmps(r.data.data||[])).finally(()=>setLoading(false));
  const loadPayroll = () => api.get(`/hr/payroll?month=${payMonth}`).then(r=>setPayroll(r.data.data||[]));

  useEffect(() => { loadEmps(); }, []);
  useEffect(() => { if (tab==='payroll') loadPayroll(); }, [tab, payMonth]);

  const onEmployee = async (e) => {
    e.preventDefault();
    if (!empForm.name || !empForm.base_salary) return toast.error('Name and salary required');
    setSaving(true);
    try {
      await api.post('/hr/employees', empForm);
      toast.success('Employee added' + (empForm.email ? ' with login account' : ''));
      setModal(null);
      setEmpForm({ name:'', phone:'', join_date:'', designation:'', department:'', base_salary:'', email:'', password:'' });
      loadEmps();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const onAdvance = async (e) => {
    e.preventDefault();
    if (!advForm.amount) return toast.error('Amount required');
    setSaving(true);
    try {
      await api.post(`/hr/employees/${selEmp.id}/advances`, advForm);
      toast.success('Advance recorded — will be deducted in next payroll');
      setModal(null);
      setAdvForm({ amount:'', advance_date: new Date().toISOString().slice(0,10), notes:'' });
      loadEmps();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const processPayroll = async () => {
    setSaving(true);
    try {
      const r = await api.post('/hr/payroll/process', { payroll_month: payMonth });
      toast.success(r.data.message);
      loadPayroll();
    } catch (err) { toast.error(err.response?.data?.message || 'Processing failed'); }
    finally { setSaving(false); }
  };

  const markPaid = async (id) => {
    try { await api.patch(`/hr/payroll/${id}/pay`); toast.success('Salary paid'); loadPayroll(); }
    catch { toast.error('Failed'); }
  };

  const TABS = [{ id:'employees', label:'Employees', icon: Users }, { id:'payroll', label:'Payroll', icon: DollarSign }];

  return (
    <div className="space-y-6">
      <PageHeader title="HR & Payroll" subtitle="Employee management and salary processing"
        action={<button onClick={()=>setModal('employee')} className="btn-primary"><Plus size={16}/>Add Employee</button>}/>

      <div className="flex gap-1 bg-white border border-[#d1dce8] rounded-xl p-1 w-fit">
        {TABS.map(({id,label,icon:Icon})=>(
          <button key={id} onClick={()=>setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition
              ${tab===id?'bg-[#1d6faa] text-white':'text-slate-500 hover:text-slate-700'}`}>
            <Icon size={15}/>{label}
          </button>
        ))}
      </div>

      {/* Employees */}
      {tab==='employees' && (
        <div className="card p-0 overflow-hidden">
          <table className="table-auto w-full">
            <thead><tr><th>Code</th><th>Name</th><th>Designation</th><th>Base Salary</th><th>Pending Advance</th><th>Login</th><th>Action</th></tr></thead>
            <tbody>
              {loading ? [...Array(5)].map((_,i)=><SkeletonRow key={i} cols={7}/>) :
               employees.length===0 ? <tr><td colSpan={7}><EmptyState icon={UserCheck} title="No employees" description="Add your first employee"/></td></tr> :
               employees.map(e=>(
                <tr key={e.id}>
                  <td><span className="font-mono text-xs text-[#1d6faa]">{e.emp_code}</span></td>
                  <td>
                    <div className="font-medium text-slate-700">{e.name}</div>
                    <div className="text-xs text-slate-400">{e.phone}</div>
                  </td>
                  <td className="text-sm text-slate-500">{e.designation||'—'}</td>
                  <td><span className="font-mono font-semibold text-emerald-600">{fmt(e.base_salary)}</span></td>
                  <td>
                    {parseFloat(e.pending_advance)>0
                      ? <span className="text-amber-600 font-mono text-sm flex items-center gap-1"><AlertCircle size={12}/>{fmt(e.pending_advance)}</span>
                      : <span className="text-slate-400 text-sm">—</span>}
                  </td>
                  <td>
                    <span className={`badge text-xs ${e.user_id ? 'badge-green' : 'badge-gray'}`}>
                      {e.user_id ? 'Has Login' : 'No Login'}
                    </span>
                  </td>
                  <td>
                    <button onClick={()=>{ setSelEmp(e); setModal('advance'); }}
                      className="btn-ghost text-xs py-1 px-2">
                      <CreditCard size={12} className="mr-1"/>Advance
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payroll */}
      {tab==='payroll' && (
        <div className="space-y-4">
          <div className="card flex flex-wrap items-end gap-4">
            <div><label className="label">Payroll Month</label>
              <input type="month" className="input w-44" value={payMonth} onChange={e=>setPayMonth(e.target.value)}/></div>
            <button onClick={processPayroll} disabled={saving} className="btn-primary">
              {saving?<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                :<><CreditCard size={16}/>Process Payroll</>}
            </button>
            <p className="text-xs text-slate-400 self-end">Advance salary auto-deducted. Expense entry auto-created.</p>
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="table-auto w-full">
              <thead><tr><th>Employee</th><th>Base</th><th>Allowances</th><th>Advance Ded.</th><th>Net</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {payroll.length===0
                  ? <tr><td colSpan={7}><EmptyState icon={DollarSign} title="No payroll" description={`Process payroll for ${payMonth}`}/></td></tr>
                  : payroll.map(p=>(
                    <tr key={p.id}>
                      <td><div className="font-medium">{p.employee_name}</div><div className="text-xs text-slate-400 font-mono">{p.emp_code}</div></td>
                      <td className="font-mono">{fmt(p.base_salary)}</td>
                      <td className="font-mono text-emerald-600">{fmt(p.allowances)}</td>
                      <td className="font-mono text-red-500">{parseFloat(p.advance_deduction)>0?`-${fmt(p.advance_deduction)}`:'—'}</td>
                      <td className="font-mono font-bold text-emerald-600">{fmt(p.net_salary)}</td>
                      <td><span className={`badge ${p.status==='paid'?'badge-green':'badge-yellow'}`}>{p.status}</span></td>
                      <td>{p.status==='draft'&&<button onClick={()=>markPaid(p.id)} className="btn-ghost text-xs py-1 px-2">Pay</button>}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      <Modal isOpen={modal==='employee'} onClose={()=>setModal(null)} title="Add Employee" size="md">
        <form onSubmit={onEmployee} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Full Name *</label>
              <input value={empForm.name} onChange={e=>setEmpForm(p=>({...p,name:e.target.value}))}
                className="input" placeholder="Muhammad Ali"/></div>
            <div><label className="label">Phone</label>
              <input value={empForm.phone} onChange={e=>setEmpForm(p=>({...p,phone:e.target.value}))} className="input"/></div>
            <div><label className="label">Join Date</label>
              <input type="date" value={empForm.join_date} onChange={e=>setEmpForm(p=>({...p,join_date:e.target.value}))} className="input"/></div>
            <div><label className="label">Designation</label>
              <input value={empForm.designation} onChange={e=>setEmpForm(p=>({...p,designation:e.target.value}))}
                className="input" placeholder="Driver, Accountant…"/></div>
            <div><label className="label">Department</label>
              <input value={empForm.department} onChange={e=>setEmpForm(p=>({...p,department:e.target.value}))} className="input"/></div>
            <div className="col-span-2"><label className="label">Base Salary (PKR) *</label>
              <input type="number" step="100" value={empForm.base_salary}
                onChange={e=>setEmpForm(p=>({...p,base_salary:e.target.value}))}
                className="input font-mono" placeholder="25000"/></div>
          </div>

          {/* Staff login section */}
          <div className="border border-dashed border-[#d1dce8] rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-600">Staff Login (optional)</p>
            <p className="text-xs text-slate-400">Fill email + password to give this employee a login account</p>
            <div><label className="label">Email</label>
              <input type="email" value={empForm.email} onChange={e=>setEmpForm(p=>({...p,email:e.target.value}))}
                className="input" placeholder="ali@dairy.local"/></div>
            <div><label className="label">Password</label>
              <div className="relative">
                <input type={showPass?'text':'password'} value={empForm.password}
                  onChange={e=>setEmpForm(p=>({...p,password:e.target.value}))}
                  className="input pr-10" placeholder="Min 8 characters"/>
                <button type="button" onClick={()=>setShowPass(p=>!p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPass?<EyeOff size={15}/>:<Eye size={15}/>}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={()=>setModal(null)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving?'Saving…':'Add Employee'}</button>
          </div>
        </form>
      </Modal>

      {/* Advance Modal */}
      <Modal isOpen={modal==='advance'} onClose={()=>setModal(null)} title={`Advance — ${selEmp?.name||''}`} size="sm">
        <form onSubmit={onAdvance} className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
            <p className="font-semibold">Pending advance: {fmt(selEmp?.pending_advance)}</p>
            <p className="text-xs mt-1">This advance will be deducted automatically in the next payroll.</p>
          </div>
          <div><label className="label">Amount (PKR) *</label>
            <input type="number" step="100" value={advForm.amount}
              onChange={e=>setAdvForm(p=>({...p,amount:e.target.value}))}
              className="input font-mono" placeholder="5000"/></div>
          <div><label className="label">Date</label>
            <input type="date" value={advForm.advance_date}
              onChange={e=>setAdvForm(p=>({...p,advance_date:e.target.value}))} className="input"/></div>
          <div><label className="label">Notes</label>
            <input value={advForm.notes} onChange={e=>setAdvForm(p=>({...p,notes:e.target.value}))}
              className="input" placeholder="Reason for advance…"/></div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={()=>setModal(null)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving?'Saving…':'Record Advance'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
