import { useState, useEffect, useRef } from 'react';
import { Milk, Calculator, CheckCircle, RefreshCw, AlertCircle, ChevronDown, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import api from '../../api/client';

const todayStr = () => format(new Date(), 'yyyy-MM-dd');
const autoShift = () => parseInt(format(new Date(), 'HH')) < 12 ? 'morning' : 'evening';

const emptyForm = () => ({
  farmer_id:          '',
  collection_date:    todayStr(),
  quantity_liters:    '',
  fat_percentage:     '',
  lactometer_reading: '',
  snf_percentage:     '',
  target_ts:          '13',
  shop_id:            '',
  notes:              '',
});

export default function MilkEntry() {
  const [centres,   setCentres]   = useState([]);
  const [shops,     setShops]     = useState([]);
  const [form,      setForm]      = useState(emptyForm());
  const [preview,   setPreview]   = useState(null);
  const [prevLoad,  setPrevLoad]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [result,    setResult]    = useState(null); // modal-style result panel
  const [todayRecs, setTodayRecs] = useState([]);
  const [errors,    setErrors]    = useState({});
  const debounce = useRef(null);

  useEffect(() => {
    api.get('/farmers?limit=200&active=1').then(r => setCentres(r.data.data || []));
    api.get('/shops?limit=100').then(r => setShops(r.data.data || []));
    loadToday();
  }, []);

  const loadToday = () => {
    const d = todayStr();
    api.get(`/milk?date_from=${d}&date_to=${d}&limit=100`)
      .then(r => setTodayRecs(r.data.data || []))
      .catch(() => {});
  };

  const set = key => e => setForm(p => ({ ...p, [key]: e.target.value }));

  // Live preview
  useEffect(() => {
    const { fat_percentage: fat, lactometer_reading: lr, quantity_liters: qty } = form;
    if (!fat || !lr || !qty || parseFloat(qty) <= 0) { setPreview(null); return; }
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setPrevLoad(true);
      api.post('/milk/preview-rate', {
        fat_percentage:     parseFloat(fat),
        lactometer_reading: parseFloat(lr),
        quantity_liters:    parseFloat(qty),
        target_ts:          parseFloat(form.target_ts) || 13,
      })
        .then(r => setPreview(r.data.data))
        .catch(() => setPreview(null))
        .finally(() => setPrevLoad(false));
    }, 600);
    return () => clearTimeout(debounce.current);
  }, [form.fat_percentage, form.lactometer_reading, form.quantity_liters, form.target_ts]);

  const validate = () => {
    const e = {};
    if (!form.farmer_id)        e.farmer_id          = 'Select collection centre';
    if (!form.quantity_liters || parseFloat(form.quantity_liters) <= 0) e.quantity_liters = 'Enter quantity';
    if (!form.fat_percentage)   e.fat_percentage      = 'Enter FAT%';
    if (!form.lactometer_reading) e.lactometer_reading = 'Enter LR';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const onSubmit = async e => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        farmer_id:          parseInt(form.farmer_id),
        collection_date:    form.collection_date,
        shift:              autoShift(),  // keeps old backend happy
        quantity_liters:    parseFloat(form.quantity_liters),
        fat_percentage:     parseFloat(form.fat_percentage),
        lactometer_reading: parseFloat(form.lactometer_reading),
        snf_percentage:     form.snf_percentage ? parseFloat(form.snf_percentage) : null,
        target_ts:          parseFloat(form.target_ts) || 13,
        shop_id:            form.shop_id ? parseInt(form.shop_id) : null,
        notes:              form.notes || null,
      };

      const r = await api.post('/milk', payload);
      const data = r.data.data || {};
      const centre = centres.find(c => String(c.id) === String(form.farmer_id));
      const shop   = shops.find(s => String(s.id) === String(form.shop_id));

      // Show result panel (like image 3)
      setResult({
        centre:    centre?.centre_name || centre?.name || '',
        shop:      shop?.shop_name || '—',
        liters:    form.quantity_liters,
        fat:       form.fat_percentage,
        lr:        form.lactometer_reading,
        snf:       data.snf_computed,
        ts:        data.ts,
        sp_gravity:data.sp_gravity,
        // rate/amount only if returned (admin sees, purchase staff doesn't)
        rate:      data.rate_per_unit,
        amount:    data.total_payout,
      });

      toast.success('✓ Saved');
      setForm(p => ({ ...emptyForm(), collection_date: p.collection_date }));
      setPreview(null);
      setErrors({});
      loadToday();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Save failed';
      toast.error(msg);
    } finally { setSaving(false); }
  };

  const selectedCentre = centres.find(c => String(c.id) === String(form.farmer_id));

  return (
    <div className="pb-10 max-w-sm mx-auto space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">Milk Collection</h1>
        <p className="text-sm text-slate-400 flex items-center gap-1.5 mt-0.5">
          <Clock size={13}/>
          {format(new Date(), 'EEEE, dd MMM yyyy')} · {format(new Date(), 'hh:mm a')}
        </p>
      </div>

      {/* Result Panel (shown after save — like image 3) */}
      {result && (
        <div className="rounded-2xl border border-blue-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-[#1d6faa] px-4 py-3">
            <p className="text-white font-bold text-center text-base">Result</p>
          </div>
          <div className="p-4 space-y-2 text-sm">
            {[
              { label:'Centre',       val: result.centre },
              { label:'Dropped to',   val: result.shop },
              { label:'Milk (L)',      val: result.liters },
              { label:'Fat %',        val: result.fat },
              { label:'LR',           val: result.lr },
              result.snf    ? { label:'SNF',          val: result.snf }       : null,
              result.ts     ? { label:'TS',            val: result.ts }        : null,
              result.sp_gravity ? { label:'Sp. Gravity', val: result.sp_gravity } : null,
              result.amount ? { label:'Amount (Rs)',   val: `Rs ${Number(result.amount).toLocaleString('en-PK',{maximumFractionDigits:0})}` } : null,
            ].filter(Boolean).map(({ label, val }) => (
              <div key={label} className="flex justify-between items-center border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                <span className="text-slate-500 font-medium">{label}</span>
                <span className="font-mono font-semibold text-slate-800">{val}</span>
              </div>
            ))}
          </div>
          <div className="px-4 pb-4">
            <button onClick={() => setResult(null)}
              className="w-full py-2.5 rounded-xl bg-[#1d6faa] text-white font-semibold text-sm hover:bg-[#1557a0] transition">
              Close
            </button>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">

        {/* Date — auto today */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Date</label>
          <input type="date" value={form.collection_date} onChange={set('collection_date')}
            className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm font-mono bg-slate-50 focus:outline-none focus:border-[#1d6faa]"/>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <Clock size={10}/> Time recorded automatically: {format(new Date(),'hh:mm a')}
          </p>
        </div>

        {/* Collection Centre */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Collection Centre *</label>
          <div className="relative">
            <select value={form.farmer_id} onChange={set('farmer_id')}
              className={`w-full border rounded-xl px-3 py-3.5 text-sm appearance-none pr-10 bg-white focus:outline-none
                ${errors.farmer_id ? 'border-red-400' : 'border-slate-200 focus:border-[#1d6faa]'}`}>
              <option value="">Select centre…</option>
              {centres.map(c => (
                <option key={c.id} value={c.id}>{c.centre_name || c.name} ({c.farmer_code})</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
          </div>
          {errors.farmer_id && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={11}/>{errors.farmer_id}</p>}
          {selectedCentre && (
            <p className="text-xs text-slate-400 mt-1 px-1">Code: <strong>{selectedCentre.farmer_code}</strong></p>
          )}
        </div>

        {/* Milk Weight */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Milk (KG / Litres) *</label>
          <input type="number" inputMode="decimal" step="0.01" placeholder="0.00"
            value={form.quantity_liters} onChange={set('quantity_liters')}
            className={`w-full border rounded-xl px-3 py-4 text-2xl font-bold font-mono text-center focus:outline-none
              ${errors.quantity_liters ? 'border-red-400' : 'border-slate-200 focus:border-[#1d6faa]'}`}/>
          {errors.quantity_liters && <p className="text-red-500 text-xs mt-1">{errors.quantity_liters}</p>}
        </div>

        {/* FAT + LR */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Fat % *</label>
            <input type="number" inputMode="decimal" step="0.01" placeholder="0.00"
              value={form.fat_percentage} onChange={set('fat_percentage')}
              className={`w-full border rounded-xl px-3 py-4 text-xl font-bold font-mono text-center text-blue-600 focus:outline-none
                ${errors.fat_percentage ? 'border-red-400' : 'border-slate-200 focus:border-[#1d6faa]'}`}/>
            {errors.fat_percentage && <p className="text-red-500 text-xs mt-1">{errors.fat_percentage}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">LR *</label>
            <input type="number" inputMode="decimal" step="0.1" placeholder="0.0"
              value={form.lactometer_reading} onChange={set('lactometer_reading')}
              className={`w-full border rounded-xl px-3 py-4 text-xl font-bold font-mono text-center text-violet-600 focus:outline-none
                ${errors.lactometer_reading ? 'border-red-400' : 'border-slate-200 focus:border-[#1d6faa]'}`}/>
            {errors.lactometer_reading && <p className="text-red-500 text-xs mt-1">{errors.lactometer_reading}</p>}
          </div>
        </div>

        {/* TS Standard — editable, default 13 */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            TS Standard <span className="normal-case font-normal text-slate-400">(default: 13)</span>
          </label>
          <input type="number" inputMode="decimal" step="0.01" placeholder="13"
            value={form.target_ts} onChange={set('target_ts')}
            className="w-full border border-slate-200 rounded-xl px-3 py-3 text-base font-mono text-center text-slate-600 focus:outline-none focus:border-[#1d6faa]"/>
        </div>

        {/* Drop to Shop */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Drop to Shop</label>
          <div className="relative">
            <select value={form.shop_id} onChange={set('shop_id')}
              className="w-full border border-slate-200 rounded-xl px-3 py-3.5 text-sm appearance-none pr-10 bg-white focus:outline-none focus:border-[#1d6faa]">
              <option value="">Select shop…</option>
              {shops.map(s => <option key={s.id} value={s.id}>{s.shop_name}</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Notes <span className="normal-case font-normal text-slate-400">(optional)</span></label>
          <input value={form.notes} onChange={set('notes')} placeholder="Any remarks…"
            className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-[#1d6faa]"/>
        </div>

        {/* Live TS Preview */}
        {(prevLoad || preview) && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calculator size={14} className="text-blue-500"/>
              <p className="text-sm font-semibold text-blue-700">Live Calculation</p>
              {prevLoad && <RefreshCw size={12} className="animate-spin text-blue-400 ml-auto"/>}
            </div>
            {preview && !prevLoad && (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { l:'TS',              v: preview.ts,              c:'text-blue-700' },
                  { l:'Standardised TS', v: preview.standardised_ts, c:'text-violet-700' },
                  { l:'SNF',             v: preview.snf_computed,    c:'text-emerald-700' },
                  { l:'Sp. Gravity',     v: preview.sp_gravity,      c:'text-slate-700' },
                  // Rate/amount only if backend returns them (admin role)
                  ...(preview.rate_per_unit !== undefined ? [
                    { l:'Rate/Unit', v:`Rs ${Number(preview.rate_per_unit).toFixed(2)}`, c:'text-slate-700' },
                    { l:'Total',     v:`Rs ${Number(preview.total_payout).toLocaleString('en-PK',{maximumFractionDigits:0})}`, c:'text-emerald-700 font-bold' },
                  ] : []),
                ].map(({ l, v, c }) => (
                  <div key={l} className="bg-white rounded-xl p-2.5 border border-blue-100 text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">{l}</p>
                    <p className={`font-mono font-bold text-sm ${c}`}>{v}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <button type="submit" disabled={saving}
          className="w-full py-4 rounded-2xl bg-[#1d6faa] hover:bg-[#1557a0] active:scale-[0.98]
                     text-white font-bold text-lg flex items-center justify-center gap-3
                     transition-all disabled:opacity-60 shadow-md">
          {saving
            ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"/>
            : <><Milk size={21}/>Save Collection</>}
        </button>
      </form>

      {/* Today's entries */}
      {todayRecs.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today ({todayRecs.length})</p>
          {todayRecs.map(r => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white border border-slate-200">
              <div>
                <p className="text-sm font-semibold text-slate-700">{r.centre_name || r.farmer_name}</p>
                <p className="text-xs text-slate-400 font-mono">
                  {parseFloat(r.quantity_liters).toFixed(1)}L · FAT {parseFloat(r.fat_percentage).toFixed(1)}%
                  {r.lactometer_reading ? ` · LR ${parseFloat(r.lactometer_reading).toFixed(1)}` : ''}
                  {r.shop_name ? ` → ${r.shop_name}` : ''}
                </p>
              </div>
              <div className="text-right">
                {r.ts_value ? <p className="text-xs font-mono text-blue-600 font-semibold">TS {parseFloat(r.ts_value).toFixed(2)}</p> : null}
                {r.collection_time ? <p className="text-xs text-slate-400">{format(new Date(r.collection_time),'hh:mm a')}</p> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
