import { useState, useEffect } from 'react';
import { TrendingUp, Plus, Building2, FileText, CreditCard, CheckCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { Modal, PageHeader, EmptyState, SkeletonRow } from '../../components/ui';

const fmt = n => `Rs ${Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:0})}`;

export default function Sales() {
  const [tab, setTab]           = useState('sales');
  const [companies, setCompanies] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [sales, setSales]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(null);
  const [saving, setSaving]       = useState(false);
  // Separate form states
  const [co, setCo]     = useState({ name:'', contact_name:'', phone:'', gstin:'' });
  const [ct, setCt]     = useState({ company_id:'', rate_per_liter:'', start_date:'', contract_ref:'' });
  const [sl, setSl]     = useState({ contract_id:'', sale_date:'', quantity_liters:'', fat_percentage:'', rate_per_liter:'' });

  const load = async () => {
    setLoading(true);
    try {
      const [c,ct2,s] = await Promise.all([
        api.get('/sales/companies'),
        api.get('/sales/contracts'),
        api.get('/sales/sales'),
      ]);
      setCompanies(c.data.data||[]);
      setContracts(ct2.data.data||[]);
      setSales(s.data.data||[]);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submitCompany = async (e) => {
    e.preventDefault();
    if (!co.name.trim()) return toast.error('Company name required');
    setSaving(true);
    try {
      await api.post('/sales/companies', co);
      toast.success('Company added');
      setModal(null); setCo({ name:'', contact_name:'', phone:'', gstin:'' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const submitContract = async (e) => {
    e.preventDefault();
    if (!ct.company_id || !ct.rate_per_liter || !ct.start_date) return toast.error('Fill required fields');
    setSaving(true);
    try {
      await api.post('/sales/contracts', ct);
      toast.success('Contract created');
      setModal(null); setCt({ company_id:'', rate_per_liter:'', start_date:'', contract_ref:'' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const submitSale = async (e) => {
    e.preventDefault();
    if (!sl.contract_id || !sl.sale_date || !sl.quantity_liters) return toast.error('Fill required fields');
    setSaving(true);
    try {
      await api.post('/sales/sales', sl);
      toast.success('Sale recorded');
      setModal(null); setSl({ contract_id:'', sale_date:'', quantity_liters:'', fat_percentage:'', rate_per_liter:'' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const TABS = [
    { id:'sales', label:'Sales', icon: TrendingUp },
    { id:'companies', label:'Companies', icon: Building2 },
    { id:'contracts', label:'Contracts', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Sales" subtitle="Manage milk sales, companies and contracts"
        action={
          <div className="flex gap-2">
            <button onClick={() => setModal('company')} className="btn-ghost"><Plus size={14}/>Company</button>
            <button onClick={() => setModal('contract')} className="btn-ghost"><Plus size={14}/>Contract</button>
            <button onClick={() => setModal('sale')} className="btn-primary"><Plus size={14}/>Record Sale</button>
          </div>
        } />

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${tab===id ? 'bg-white shadow text-[#1d6faa]' : 'text-slate-500 hover:text-slate-700'}`}>
            <Icon size={15}/>{label}
          </button>
        ))}
      </div>

      {/* Sales Tab */}
      {tab === 'sales' && (
        <div className="card overflow-hidden p-0">
          <table className="table-auto w-full">
            <thead><tr>
              <th>Date</th><th>Company</th><th>Qty (L)</th><th>Rate</th><th>Amount</th><th>Status</th>
            </tr></thead>
            <tbody>
              {loading ? <SkeletonRow cols={6} /> : sales.length === 0
                ? <tr><td colSpan={6}><EmptyState icon={TrendingUp} title="No sales yet" description="Record your first sale" /></td></tr>
                : sales.map(s => (
                  <tr key={s.id}>
                    <td>{s.sale_date}</td>
                    <td><div className="font-medium">{s.company_name}</div><div className="text-xs text-slate-400">{s.contract_ref}</div></td>
                    <td className="font-mono">{Number(s.quantity_liters).toFixed(1)}</td>
                    <td className="font-mono">{fmt(s.rate_per_liter)}</td>
                    <td className="font-mono font-semibold">{fmt(s.total_amount)}</td>
                    <td>{s.payment_status === 'received'
                      ? <span className="badge-green"><CheckCircle size={11} className="mr-1"/>Received</span>
                      : <span className="badge-yellow"><Clock size={11} className="mr-1"/>Pending</span>}
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Companies Tab */}
      {tab === 'companies' && (
        <div className="card overflow-hidden p-0">
          <table className="table-auto w-full">
            <thead><tr><th>Company</th><th>Contact</th><th>Phone</th></tr></thead>
            <tbody>
              {loading ? <SkeletonRow cols={3}/> : companies.length === 0
                ? <tr><td colSpan={3}><EmptyState icon={Building2} title="No companies" description="Add your first buyer company" /></td></tr>
                : companies.map(c => (
                  <tr key={c.id}>
                    <td className="font-medium">{c.name}</td>
                    <td>{c.contact_name||'—'}</td>
                    <td>{c.phone||'—'}</td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Contracts Tab */}
      {tab === 'contracts' && (
        <div className="card overflow-hidden p-0">
          <table className="table-auto w-full">
            <thead><tr><th>Company</th><th>Ref</th><th>Rate/L</th><th>From</th><th>Status</th></tr></thead>
            <tbody>
              {loading ? <SkeletonRow cols={5}/> : contracts.length === 0
                ? <tr><td colSpan={5}><EmptyState icon={FileText} title="No contracts" description="Create a contract first" /></td></tr>
                : contracts.map(c => (
                  <tr key={c.id}>
                    <td className="font-medium">{c.company_name}</td>
                    <td>{c.contract_ref||'—'}</td>
                    <td className="font-mono">{fmt(c.rate_per_liter)}/L</td>
                    <td>{c.start_date}</td>
                    <td><span className={c.status==='active'?'badge-green':'badge-gray'}>{c.status}</span></td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Add Company */}
      <Modal isOpen={modal==='company'} onClose={()=>setModal(null)} title="Add Company" size="sm">
        <form onSubmit={submitCompany} className="space-y-4">
          <div><label className="label">Company Name *</label>
            <input value={co.name} onChange={e=>setCo(p=>({...p,name:e.target.value}))}
              className="input" placeholder="Nestle Pakistan" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Contact Person</label>
              <input value={co.contact_name} onChange={e=>setCo(p=>({...p,contact_name:e.target.value}))} className="input" /></div>
            <div><label className="label">Phone</label>
              <input value={co.phone} onChange={e=>setCo(p=>({...p,phone:e.target.value}))} className="input" /></div>
          </div>
          <div><label className="label">GSTIN (Optional)</label>
            <input value={co.gstin} onChange={e=>setCo(p=>({...p,gstin:e.target.value}))} className="input" /></div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={()=>setModal(null)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving?'Saving…':'Add Company'}</button>
          </div>
        </form>
      </Modal>

      {/* Modal: New Contract */}
      <Modal isOpen={modal==='contract'} onClose={()=>setModal(null)} title="New Contract" size="sm">
        <form onSubmit={submitContract} className="space-y-4">
          <div><label className="label">Company *</label>
            <select value={ct.company_id} onChange={e=>setCt(p=>({...p,company_id:e.target.value}))} className="input">
              <option value="">Select company…</option>
              {companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Rate/Liter (PKR) *</label>
              <input type="number" step="0.01" value={ct.rate_per_liter}
                onChange={e=>setCt(p=>({...p,rate_per_liter:e.target.value}))} className="input font-mono" /></div>
            <div><label className="label">Start Date *</label>
              <input type="date" value={ct.start_date}
                onChange={e=>setCt(p=>({...p,start_date:e.target.value}))} className="input" /></div>
          </div>
          <div><label className="label">Contract Ref</label>
            <input value={ct.contract_ref} onChange={e=>setCt(p=>({...p,contract_ref:e.target.value}))} className="input" placeholder="Optional" /></div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={()=>setModal(null)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving?'Saving…':'Create Contract'}</button>
          </div>
        </form>
      </Modal>

      {/* Modal: Record Sale */}
      <Modal isOpen={modal==='sale'} onClose={()=>setModal(null)} title="Record Sale" size="sm">
        <form onSubmit={submitSale} className="space-y-4">
          <div><label className="label">Contract *</label>
            <select value={sl.contract_id} onChange={e=>{
              const c = contracts.find(c=>String(c.id)===e.target.value);
              setSl(p=>({...p,contract_id:e.target.value,rate_per_liter:c?.rate_per_liter||''}));
            }} className="input">
              <option value="">Select contract…</option>
              {contracts.filter(c=>c.status==='active').map(c=><option key={c.id} value={c.id}>{c.company_name} — {fmt(c.rate_per_liter)}/L</option>)}
            </select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Sale Date *</label>
              <input type="date" value={sl.sale_date} onChange={e=>setSl(p=>({...p,sale_date:e.target.value}))} className="input" /></div>
            <div><label className="label">Quantity (L) *</label>
              <input type="number" step="0.1" value={sl.quantity_liters} onChange={e=>setSl(p=>({...p,quantity_liters:e.target.value}))} className="input font-mono" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">FAT %</label>
              <input type="number" step="0.01" value={sl.fat_percentage} onChange={e=>setSl(p=>({...p,fat_percentage:e.target.value}))} className="input font-mono" /></div>
            <div><label className="label">Rate/L</label>
              <input type="number" step="0.01" value={sl.rate_per_liter} onChange={e=>setSl(p=>({...p,rate_per_liter:e.target.value}))} className="input font-mono" /></div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={()=>setModal(null)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving?'Saving…':'Record Sale'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
