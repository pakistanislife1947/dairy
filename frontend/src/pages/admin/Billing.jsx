import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Plus, Zap, CreditCard, ChevronRight, CheckCircle, Clock, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { PageHeader, Modal, SkeletonRow, EmptyState } from '../../components/ui';

const STATUS_BADGE = {
  generated: 'badge-yellow',
  paid:      'badge-green',
  cancelled: 'badge-red',
  open:      'badge-blue',
  closed:    'badge-gray',
};

const STATUS_ICON = {
  generated: Clock, paid: CheckCircle, cancelled: XCircle,
};

const fmtPKR = n => `Rs ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
const MONTHS  = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function Billing() {
  const [periods, setPeriods]       = useState([]);
  const [bills, setBills]           = useState([]);
  const [selPeriod, setSelPeriod]   = useState(null);
  const [loadPeriods, setLoadP]     = useState(true);
  const [loadBills, setLoadB]       = useState(false);
  const [generating, setGenerating] = useState(false);
  const [newPeriodModal, setNPM]    = useState(false);
  const [npForm, setNPForm]         = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });

  useEffect(() => {
    api.get('/billing/periods')
      .then(r => setPeriods(r.data.data))
      .finally(() => setLoadP(false));
  }, []);

  const selectPeriod = (p) => {
    setSelPeriod(p);
    setLoadB(true);
    api.get(`/billing/bills?period_id=${p.id}`)
      .then(r => setBills(r.data.data))
      .finally(() => setLoadB(false));
  };

  const createPeriod = async () => {
    try {
      await api.post('/billing/periods', { period_month: npForm.month, period_year: npForm.year });
      toast.success('Period created');
      setNPM(false);
      const r = await api.get('/billing/periods');
      setPeriods(r.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const generateBills = async () => {
    if (!selPeriod) return;
    setGenerating(true);
    try {
      const r = await api.post('/billing/generate', { billing_period_id: selPeriod.id });
      toast.success(r.data.message);
      selectPeriod(selPeriod);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const markPaid = async (bill) => {
    try {
      await api.patch(`/billing/bills/${bill.id}/pay`);
      toast.success(`Bill ${bill.bill_number} marked as paid`);
      selectPeriod(selPeriod);
    } catch { toast.error('Failed'); }
  };

  const closePeriod = async () => {
    try {
      await api.patch(`/billing/periods/${selPeriod.id}/close`);
      toast.success('Period closed');
      const r = await api.get('/billing/periods');
      setPeriods(r.data.data);
      setSelPeriod(prev => ({ ...prev, status: 'closed' }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        subtitle="Manage billing periods and farmer payments"
        action={<button onClick={() => setNPM(true)} className="btn-primary"><Plus size={16} />New Period</button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Periods list */}
        <div className="card p-0 overflow-hidden lg:col-span-1">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-slate-200 text-sm">Billing Periods</h3>
          </div>
          {loadPeriods
            ? <div className="p-4 space-y-2">{[...Array(4)].map((_,i) => <div key={i} className="skeleton h-14 w-full rounded-xl" />)}</div>
            : periods.length === 0
              ? <EmptyState icon={FileText} title="No periods" description="Create your first billing period" />
              : (
                <div className="divide-y divide-border">
                  {periods.map(p => (
                    <button
                      key={p.id}
                      onClick={() => selectPeriod(p)}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-700/30 transition-colors
                        ${selPeriod?.id === p.id ? 'bg-brand-500/10 border-l-2 border-brand-500' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-200 text-sm">
                            {MONTHS[p.period_month]} {p.period_year}
                          </p>
                          <p className="text-xs text-muted mt-0.5">{p.bill_count} bills · {fmtPKR(p.total_payable)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={STATUS_BADGE[p.status]}>{p.status}</span>
                          <ChevronRight size={14} className="text-muted" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )
          }
        </div>

        {/* Bills for selected period */}
        <div className="lg:col-span-2 space-y-4">
          {selPeriod ? (
            <>
              <div className="card flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-100">
                    {MONTHS[selPeriod.period_month]} {selPeriod.period_year}
                  </h3>
                  <p className="text-sm text-muted mt-0.5">
                    Status: <span className={STATUS_BADGE[selPeriod.status]}>{selPeriod.status}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  {selPeriod.status === 'open' && (
                    <>
                      <button onClick={generateBills} disabled={generating} className="btn-primary">
                        {generating
                          ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <><Zap size={16} />Generate Bills</>
                        }
                      </button>
                      <button onClick={closePeriod} className="btn-ghost">Close Period</button>
                    </>
                  )}
                </div>
              </div>

              <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="table-auto w-full">
                    <thead>
                      <tr>
                        <th>Bill No.</th><th>Farmer</th>
                        <th>Litres</th><th>Gross</th>
                        <th>Advance Ded.</th><th>Net Payable</th>
                        <th>Status</th><th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadBills
                        ? [...Array(5)].map((_,i) => <SkeletonRow key={i} cols={8} />)
                        : bills.length === 0
                          ? (
                            <tr><td colSpan={8}>
                              <EmptyState
                                icon={FileText}
                                title="No bills"
                                description="Click 'Generate Bills' to create bills for all farmers with records"
                              />
                            </td></tr>
                          )
                          : bills.map((b, i) => {
                            const Icon = STATUS_ICON[b.status] || Clock;
                            return (
                              <motion.tr key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                                <td><span className="font-mono text-xs text-brand-400">{b.bill_number}</span></td>
                                <td>
                                  <div className="font-medium text-slate-200 text-sm">{b.farmer_name}</div>
                                  <div className="text-xs text-muted">{b.farmer_code}</div>
                                </td>
                                <td><span className="font-mono">{parseFloat(b.total_liters).toFixed(1)} L</span></td>
                                <td><span className="font-mono">{fmtPKR(b.total_amount)}</span></td>
                                <td>
                                  {parseFloat(b.advance_deduction) > 0
                                    ? <span className="font-mono text-red-400">-{fmtPKR(b.advance_deduction)}</span>
                                    : <span className="text-muted">—</span>
                                  }
                                </td>
                                <td><span className="font-mono font-bold text-emerald-400">{fmtPKR(b.net_payable)}</span></td>
                                <td>
                                  <span className={`${STATUS_BADGE[b.status]} flex items-center gap-1`}>
                                    <Icon size={10} />{b.status}
                                  </span>
                                </td>
                                <td>
                                  {b.status === 'generated' && (
                                    <button onClick={() => markPaid(b)} className="btn-ghost text-xs py-1 px-2">
                                      <CreditCard size={12} /> Mark Paid
                                    </button>
                                  )}
                                </td>
                              </motion.tr>
                            );
                          })
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="card flex items-center justify-center h-64 text-muted text-sm">
              ← Select a billing period to view bills
            </div>
          )}
        </div>
      </div>

      {/* New Period Modal */}
      <Modal isOpen={newPeriodModal} onClose={() => setNPM(false)} title="New Billing Period" size="sm">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Month</label>
              <select className="input" value={npForm.month} onChange={e => setNPForm(f => ({ ...f, month: +e.target.value }))}>
                {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Year</label>
              <input type="number" className="input font-mono" value={npForm.year}
                onChange={e => setNPForm(f => ({ ...f, year: +e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setNPM(false)} className="btn-ghost">Cancel</button>
            <button onClick={createPeriod} className="btn-primary">Create Period</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
