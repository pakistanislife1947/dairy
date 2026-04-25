import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { UserCheck, Plus, CreditCard, DollarSign, Users, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import api from '../../api/client';
import { PageHeader, Modal, SkeletonRow, EmptyState } from '../../components/ui';

const fmtPKR = n => `Rs ${Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:0})}`;

export default function HRPayroll() {
  const [tab, setTab]           = useState('employees');
  const [employees, setEmps]    = useState([]);
  const [payroll, setPayroll]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null);
  const [saving, setSaving]     = useState(false);
  const [payMonth, setPayMonth] = useState(format(new Date(), 'yyyy-MM'));
  const { register, handleSubmit, reset } = useForm();

  const loadEmps = () => api.get('/hr/employees').then(r => setEmps(r.data.data)).finally(() => setLoading(false));
  const loadPayroll = () => api.get(`/hr/payroll?month=${payMonth}`).then(r => setPayroll(r.data.data));

  useEffect(() => { loadEmps(); }, []);
  useEffect(() => { if (tab === 'payroll') loadPayroll(); }, [tab, payMonth]);

  const onEmployee = async (data) => {
    setSaving(true);
    try { await api.post('/hr/employees', data); toast.success('Employee added'); setModal(null); loadEmps(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const processPayroll = async () => {
    setSaving(true);
    try {
      const r = await api.post('/hr/payroll/process', { payroll_month: payMonth });
      toast.success(r.data.message);
      loadPayroll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Processing failed');
    } finally { setSaving(false); }
  };

  const markSalaryPaid = async (id) => {
    try { await api.patch(`/hr/payroll/${id}/pay`); toast.success('Marked as paid'); loadPayroll(); }
    catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="HR & Payroll" subtitle="Employee management and salary processing"
        action={
          <div className="flex gap-2">
            <button onClick={() => { reset({}); setModal('employee'); }} className="btn-primary"><Plus size={16} />Add Employee</button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-[#d1dce8] rounded-xl p-1 w-fit">
        {[
          { id:'employees', label:'Employees', icon: Users },
          { id:'payroll',   label:'Payroll',   icon: DollarSign },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${tab===id?'bg-brand-600 text-white':'text-muted hover:text-slate-600'}`}>
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {/* Employees tab */}
      {tab === 'employees' && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-auto w-full">
              <thead><tr><th>Code</th><th>Name</th><th>Designation</th><th>Base Salary</th><th>Pending Advance</th><th>Status</th></tr></thead>
              <tbody>
                {loading ? [...Array(6)].map((_,i) => <SkeletonRow key={i} cols={6} />) :
                  employees.length === 0 ? <tr><td colSpan={6}><EmptyState icon={UserCheck} title="No employees" description="Add your first employee" /></td></tr> :
                  employees.map((e,i) => (
                    <motion.tr key={e.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.04}}>
                      <td><span className="font-mono text-xs text-brand-400">{e.emp_code}</span></td>
                      <td>
                        <div className="font-medium text-slate-700">{e.name}</div>
                        <div className="text-xs text-muted">{e.phone}</div>
                      </td>
                      <td className="text-sm text-muted">{e.designation || '—'}</td>
                      <td><span className="font-mono font-semibold text-emerald-400">{fmtPKR(e.base_salary)}</span></td>
                      <td>
                        {parseFloat(e.pending_advance) > 0 ? (
                          <span className="flex items-center gap-1 text-amber-400 font-mono text-sm">
                            <AlertCircle size={12} />{fmtPKR(e.pending_advance)}
                          </span>
                        ) : (
                          <span className="text-muted text-sm">—</span>
                        )}
                      </td>
                      <td><span className={`badge ${e.is_active?'badge-green':'badge-red'}`}>{e.is_active?'Active':'Inactive'}</span></td>
                    </motion.tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payroll tab */}
      {tab === 'payroll' && (
        <div className="space-y-4">
          <div className="card flex flex-wrap items-end gap-4">
            <div>
              <label className="label">Payroll Month</label>
              <input type="month" className="input w-44" value={payMonth} onChange={e => setPayMonth(e.target.value)} />
            </div>
            <button onClick={processPayroll} disabled={saving} className="btn-primary">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><CreditCard size={16} />Process Payroll</>}
            </button>
            <p className="text-xs text-muted self-end">Advance salary is auto-deducted from each employee's net pay.</p>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-auto w-full">
                <thead><tr><th>Employee</th><th>Base</th><th>Allowances</th><th>Advance Ded.</th><th>Net Salary</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {payroll.length === 0 ? (
                    <tr><td colSpan={7}>
                      <EmptyState icon={DollarSign} title="No payroll entries"
                        description={`Click 'Process Payroll' to generate entries for ${payMonth}`} />
                    </td></tr>
                  ) : payroll.map((p,i) => (
                    <motion.tr key={p.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.04}}>
                      <td>
                        <div className="font-medium text-slate-700">{p.employee_name}</div>
                        <div className="text-xs text-muted font-mono">{p.emp_code}</div>
                      </td>
                      <td><span className="font-mono">{fmtPKR(p.base_salary)}</span></td>
                      <td><span className="font-mono text-emerald-400">{fmtPKR(p.allowances)}</span></td>
                      <td>
                        {parseFloat(p.advance_deduction) > 0
                          ? <span className="font-mono text-red-400">-{fmtPKR(p.advance_deduction)}</span>
                          : <span className="text-muted">—</span>
                        }
                      </td>
                      <td><span className="font-mono font-bold text-emerald-400">{fmtPKR(p.net_salary)}</span></td>
                      <td><span className={`badge ${p.status==='paid'?'badge-green':'badge-yellow'}`}>{p.status}</span></td>
                      <td>
                        {p.status === 'draft' && (
                          <button onClick={() => markSalaryPaid(p.id)} className="btn-ghost text-xs py-1 px-2">
                            <CreditCard size={12} /> Pay
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      <Modal isOpen={modal==='employee'} onClose={() => setModal(null)} title="Add Employee" size="md">
        <form onSubmit={handleSubmit(onEmployee)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Full Name *</label>
              <input {...register('name',{required:'Required'})} className="input" />
            </div>
            <div><label className="label">Phone</label><input {...register('phone')} className="input" /></div>
            <div><label className="label">Join Date</label><input type="date" {...register('join_date')} className="input" /></div>
            <div><label className="label">Designation</label><input {...register('designation')} className="input" placeholder="Driver, Accountant…" /></div>
            <div><label className="label">Department</label><input {...register('department')} className="input" /></div>
            <div className="col-span-2"><label className="label">Base Salary (PKR) *</label>
              <input type="number" step="100" {...register('base_salary',{required:'Required',min:0})} className="input font-mono" placeholder="25000" />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setModal(null)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving?'…':'Add Employee'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
