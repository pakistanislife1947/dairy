import { useState, useEffect, useCallback } from 'react';
import { Milk, Plus, Filter, TrendingUp, Clock, Calculator, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { PageHeader, Modal, SkeletonRow, EmptyState, StatCard } from '../../components/ui';

const fmt  = n => `Rs ${Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:0})}`;
const fmtL = n => `${Number(n||0).toFixed(1)}L`;
const today = () => new Date().toISOString().slice(0,10);

const emptyForm = {
  farmer_id:'', collection_date: today(), shift:'morning',
  quantity_liters:'', fat_percentage:'', lactometer_reading:'',
  snf_percentage:'', notes:'',
};

export default function MilkAdmin() {
  const [records, setRecords] = useState([]);
  const [farmers, setFarmers] = useState([]);
  const [kpi,     setKpi]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [preview, setPreview] = useState(null);
  const [prevLoading, setPrevLoading] = useState(false);
  const [filters, setFilters] = useState({ farmer_id:'', shift:'', date_from:'', date_to:'' });
  const [form,    setForm]    = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v])=>v)));
      const [recs, kpiRes] = await Promise.all([
        api.get(`/milk?${q}&limit=100`),
        api.get('/milk/kpi').catch(() => ({ data:{ data:null } })),
      ]);
      setRecords(recs.data.data || []);
      setKpi(kpiRes.data.data);
    } catch { toast.error('Load failed'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { api.get('/farmers?active=1&limit=200').then(r => setFarmers(r.data.data||[])); }, []);
  useEffect(() => { load(); }, [load]);

  // Live TS preview
  useEffect(() => {
    const { fat_percentage: fat, lactometer_reading: lr, quantity_liters: qty } = form;
    if (!fat || !lr || !qty || parseFloat(qty) <= 0) { setPreview(null); return; }
    const t = setTimeout(() => {
      setPrevLoading(true);
      api.post('/milk/preview-rate', {
        fat_percentage: parseFloat(fat),
        lactometer_reading: parseFloat(lr),
        quantity_liters: parseFloat(qty),
      })
        .then(r => setPreview(r.data.data))
        .catch(() => setPreview(null))
        .finally(() => setPrevLoading(false));
    }, 500);
    return () => clearTimeout(t);
  }, [form.fat_percentage, form.lactometer_reading, form.quantity_liters]);

  const onSubmit = async e => {
    e.preventDefault();
    const { farmer_id, quantity_liters, fat_percentage, lactometer_reading } = form;
    if (!farmer_id || !quantity_liters || !fat_percentage || !lactometer_reading)
      return toast.error('Farmer, Qty, FAT% and LR are required');
    setSaving(true);
    try {
      await api.post('/milk', form);
      toast.success('Record saved');
      setModal(false);
      setForm(emptyForm);
      setPreview(null);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const f = v => e => setForm(p => ({ ...p, [v]: e.target.value }));

  return (
    <div className="space-y-5">
      <PageHeader title="Milk Collection" subtitle="Daily records · TS-based pricing"
        action={<button onClick={() => { setForm(emptyForm); setModal(true); }} className="btn-primary"><Plus size={16}/>Add Record</button>}/>

      {/* KPI strip */}
      {kpi && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { title:'Today',      value:fmtL(kpi.today_liters),  sub:fmt(kpi.today_amount),   icon:Milk,       color:'brand' },
            { title:'This Month', value:fmtL(kpi.month_liters),  sub:fmt(kpi.month_amount),   icon:TrendingUp, color:'green' },
            { title:'Avg FAT',    value:`${Number(kpi.avg_fat||0).toFixed(2)}%`, sub:'this month', icon:Filter, color:'amber' },
            { title:'Farmers',    value:kpi.active_farmers||0,   sub:'active',                icon:Clock,      color:'blue'  },
          ].map(s => <StatCard key={s.title} {...s}/>)}
        </div>
      )}

      {/* Filters */}
      <div className="card flex flex-wrap gap-3 items-end">
        <div><label className="label">Farmer</label>
          <select className="input" value={filters.farmer_id} onChange={e=>setFilters(p=>({...p,farmer_id:e.target.value}))}>
            <option value="">All</option>{farmers.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
          </select></div>
        <div><label className="label">Shift</label>
          <select className="input" value={filters.shift} onChange={e=>setFilters(p=>({...p,shift:e.target.value}))}>
            <option value="">All</option><option value="morning">Morning</option><option value="evening">Evening</option>
          </select></div>
        <div><label className="label">From</label>
          <input type="date" className="input" value={filters.date_from} onChange={e=>setFilters(p=>({...p,date_from:e.target.value}))}/></div>
        <div><label className="label">To</label>
          <input type="date" className="input" value={filters.date_to} onChange={e=>setFilters(p=>({...p,date_to:e.target.value}))}/></div>
        <button onClick={load} className="btn-primary">Search</button>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-auto w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-100">
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Farmer</th>
                <th className="px-4 py-3 text-left">Shift</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">FAT%</th>
                <th className="px-4 py-3 text-right">LR</th>
                <th className="px-4 py-3 text-right">TS</th>
                <th className="px-4 py-3 text-right">Rate/L</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? [...Array(8)].map((_,i) => <SkeletonRow key={i} cols={9}/>)
                : records.length === 0
                  ? <tr><td colSpan={9}><EmptyState icon={Milk} title="No records" description="Add milk collection"/></td></tr>
                  : records.map(r => (
                    <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.collection_date?.slice(0,10)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm">{r.farmer_name}</p>
                        <p className="text-xs text-slate-400">{r.farmer_code}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${r.shift==='morning'?'bg-amber-100 text-amber-700':'bg-blue-100 text-blue-700'}`}>
                          {r.shift}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">{parseFloat(r.quantity_liters).toFixed(1)}L</td>
                      <td className="px-4 py-3 text-right font-mono">{parseFloat(r.fat_percentage).toFixed(2)}%</td>
                      <td className="px-4 py-3 text-right font-mono text-violet-600">{r.lactometer_reading ? parseFloat(r.lactometer_reading).toFixed(1) : '—'}</td>
                      <td className="px-4 py-3 text-right font-mono text-blue-600">{r.ts_value ? parseFloat(r.ts_value).toFixed(3) : '—'}</td>
                      <td className="px-4 py-3 text-right font-mono text-[#1d6faa]">{fmt(r.computed_rate)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">{fmt(r.total_amount)}</td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Record Modal */}
      <Modal isOpen={modal} onClose={() => { setModal(false); setPreview(null); }} title="Add Milk Collection" size="md">
        <form onSubmit={onSubmit} className="space-y-4">

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Farmer *</label>
              <select value={form.farmer_id} onChange={f('farmer_id')} className="input">
                <option value="">Select farmer…</option>
                {farmers.map(fa => <option key={fa.id} value={fa.id}>{fa.name} ({fa.farmer_code})</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date *</label>
              <input type="date" value={form.collection_date} onChange={f('collection_date')} className="input"/>
            </div>
            <div>
              <label className="label">Shift</label>
              <select value={form.shift} onChange={f('shift')} className="input">
                <option value="morning">🌅 Morning</option>
                <option value="evening">🌙 Evening</option>
              </select>
            </div>
            <div>
              <label className="label">Qty (L/KG) *</label>
              <input type="number" step="0.01" placeholder="0.00" value={form.quantity_liters} onChange={f('quantity_liters')} className="input font-mono text-center text-lg"/>
            </div>
            <div>
              <label className="label">FAT % *</label>
              <input type="number" step="0.01" placeholder="0.00" value={form.fat_percentage} onChange={f('fat_percentage')} className="input font-mono text-center text-blue-600"/>
            </div>
            <div>
              <label className="label">LR (Lactometer) *</label>
              <input type="number" step="0.1" placeholder="0.0" value={form.lactometer_reading} onChange={f('lactometer_reading')} className="input font-mono text-center text-violet-600"/>
            </div>
            <div>
              <label className="label">SNF % <span className="text-slate-400 font-normal">(optional)</span></label>
              <input type="number" step="0.01" placeholder="0.00" value={form.snf_percentage} onChange={f('snf_percentage')} className="input font-mono text-center"/>
            </div>
            <div className="col-span-2">
              <label className="label">Notes</label>
              <input value={form.notes} onChange={f('notes')} className="input" placeholder="Any remarks…"/>
            </div>
          </div>

          {/* TS + Price Preview */}
          {(preview || prevLoading) && (
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
              {prevLoading ? (
                <div className="flex items-center gap-2 text-blue-500 text-sm justify-center">
                  <RefreshCw size={14} className="animate-spin"/>Calculating…
                </div>
              ) : preview && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <Calculator size={15} className="text-blue-500"/>
                    <p className="text-sm font-semibold text-blue-700">Live Calculation</p>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { label:'TS Value',       val: preview.ts,               cls:'text-blue-700' },
                      { label:'Standardised TS',val: preview.standardised_ts,  cls:'text-violet-700' },
                      { label:'Rate / Unit',    val: `Rs ${Number(preview.rate_per_unit).toFixed(2)}`, cls:'text-slate-700' },
                      { label:'Total Payout',   val: `Rs ${Number(preview.total_payout).toLocaleString('en-PK',{maximumFractionDigits:0})}`, cls:'text-emerald-700 font-bold text-base' },
                    ].map(({ label, val, cls }) => (
                      <div key={label} className="bg-white rounded-lg p-2 border border-blue-100">
                        <p className="text-[10px] text-slate-400 mb-1">{label}</p>
                        <p className={`font-mono text-sm font-semibold ${cls}`}>{val}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setModal(false); setPreview(null); }} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save Record'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
