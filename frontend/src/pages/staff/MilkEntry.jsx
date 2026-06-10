import { useState, useEffect, useRef } from 'react';
import { Milk, Sun, Moon, Calculator, CheckCircle, RefreshCw, AlertCircle, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import api from '../../api/client';
import useAuthStore from '../../store/authStore';

const todayStr = () => format(new Date(), 'yyyy-MM-dd');
const nowShift = () => parseInt(format(new Date(), 'HH')) < 12 ? 'morning' : 'evening';

const emptyForm = () => ({
  farmer_id:          '',
  collection_date:    todayStr(),
  shift:              nowShift(),
  quantity_liters:    '',
  fat_percentage:     '',
  lactometer_reading: '',
  snf_percentage:     '',
  notes:              '',
});

export default function MilkEntry() {
  const { user } = useAuthStore();
  const [farmers,   setFarmers]   = useState([]);
  const [form,      setForm]      = useState(emptyForm());
  const [preview,   setPreview]   = useState(null);
  const [prevLoad,  setPrevLoad]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [today,     setToday]     = useState([]);
  const [errors,    setErrors]    = useState({});
  const debounce = useRef(null);

  // Load farmers once
  useEffect(() => {
    api.get('/farmers?limit=200&active=1')
      .then(r => setFarmers(r.data.data || []))
      .catch(() => toast.error('Could not load farmers'));
    loadToday();
  }, []);

  const loadToday = () => {
    const d = todayStr();
    api.get(`/milk?date_from=${d}&date_to=${d}&limit=100`)
      .then(r => setToday(r.data.data || []))
      .catch(() => {});
  };

  const set = key => e => setForm(p => ({ ...p, [key]: e.target.value }));

  // Live TS preview — debounced 600ms
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
      })
        .then(r => setPreview(r.data.data))
        .catch(() => setPreview(null))
        .finally(() => setPrevLoad(false));
    }, 600);
    return () => clearTimeout(debounce.current);
  }, [form.fat_percentage, form.lactometer_reading, form.quantity_liters]);

  // Validate
  const validate = () => {
    const e = {};
    if (!form.farmer_id)          e.farmer_id          = 'Select a farmer';
    if (!form.quantity_liters || parseFloat(form.quantity_liters) <= 0) e.quantity_liters = 'Enter quantity';
    if (!form.fat_percentage  || parseFloat(form.fat_percentage)  < 0)  e.fat_percentage  = 'Enter FAT %';
    if (!form.lactometer_reading || parseFloat(form.lactometer_reading) < 0) e.lactometer_reading = 'Enter LR';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async e => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      // Always send numbers, never empty strings
      const payload = {
        farmer_id:          parseInt(form.farmer_id),
        collection_date:    form.collection_date,
        shift:              form.shift,
        quantity_liters:    parseFloat(form.quantity_liters),
        fat_percentage:     parseFloat(form.fat_percentage),
        lactometer_reading: parseFloat(form.lactometer_reading),
        snf_percentage:     form.snf_percentage ? parseFloat(form.snf_percentage) : null,
        notes:              form.notes || null,
      };

      const r = await api.post('/milk', payload);
      const result = r.data.data || {};
      const farmer = farmers.find(f => String(f.id) === String(form.farmer_id));

      setLastSaved({
        farmer: farmer?.name || '',
        liters: form.quantity_liters,
        fat:    form.fat_percentage,
        lr:     form.lactometer_reading,
        ts:     result.ts,
      });

      toast.success('✓ Milk record saved');
      setForm(p => ({ ...emptyForm(), collection_date: p.collection_date, shift: p.shift }));
      setPreview(null);
      setErrors({});
      loadToday();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Save failed';
      toast.error(msg);
    } finally { setSaving(false); }
  };

  const selectedFarmer = farmers.find(f => String(f.id) === String(form.farmer_id));

  return (
    <div className="space-y-5 pb-10 max-w-sm mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">Milk Collection Entry</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          {format(new Date(), 'EEEE, dd MMM yyyy')} · {format(new Date(), 'hh:mm a')}
        </p>
      </div>

      {/* Last saved badge */}
      {lastSaved && (
        <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
          <CheckCircle size={16} className="text-emerald-500 mt-0.5 flex-shrink-0"/>
          <div className="text-sm">
            <p className="font-semibold text-emerald-700">Last Saved</p>
            <p className="text-emerald-600 text-xs mt-0.5">
              {lastSaved.farmer} · {lastSaved.liters}L · FAT {lastSaved.fat}% · LR {lastSaved.lr}
              {lastSaved.ts ? ` · TS ${lastSaved.ts}` : ''}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">

        {/* Shift selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Shift *</label>
          <div className="grid grid-cols-2 gap-2.5">
            {['morning','evening'].map(s => (
              <button key={s} type="button"
                onClick={() => setForm(p => ({ ...p, shift: s }))}
                className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 font-semibold text-sm transition-all
                  ${form.shift === s
                    ? s === 'morning'
                      ? 'bg-amber-50 border-amber-400 text-amber-700'
                      : 'bg-blue-50 border-blue-400 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                {s === 'morning' ? <Sun size={17}/> : <Moon size={17}/>}
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Date</label>
          <input type="date" value={form.collection_date}
            onChange={set('collection_date')}
            className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm font-mono bg-slate-50 focus:outline-none focus:border-[#1d6faa]"/>
        </div>

        {/* Farmer */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Farmer / Centre *</label>
          <div className="relative">
            <select value={form.farmer_id} onChange={set('farmer_id')}
              className={`w-full border rounded-xl px-3 py-3.5 text-sm appearance-none pr-10 bg-white focus:outline-none
                ${errors.farmer_id ? 'border-red-400 focus:border-red-400' : 'border-slate-200 focus:border-[#1d6faa]'}`}>
              <option value="">Select farmer…</option>
              {farmers.map(f => <option key={f.id} value={f.id}>{f.name} ({f.farmer_code})</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
          </div>
          {errors.farmer_id && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={11}/>{errors.farmer_id}</p>}
          {selectedFarmer && (
            <div className="mt-1.5 px-3 py-2 rounded-xl bg-blue-50 border border-blue-100 text-xs text-slate-500 flex gap-4">
              <span>Code: <strong className="text-slate-700">{selectedFarmer.farmer_code}</strong></span>
              {selectedFarmer.village && <span>Village: <strong className="text-slate-700">{selectedFarmer.village}</strong></span>}
            </div>
          )}
        </div>

        {/* Milk Weight */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Milk Weight (KG / Litres) *</label>
          <input type="number" inputMode="decimal" step="0.01" placeholder="0.00"
            value={form.quantity_liters} onChange={set('quantity_liters')}
            className={`w-full border rounded-xl px-3 py-4 text-2xl font-bold font-mono text-center tracking-wide focus:outline-none
              ${errors.quantity_liters ? 'border-red-400' : 'border-slate-200 focus:border-[#1d6faa]'}`}/>
          {errors.quantity_liters && <p className="text-red-500 text-xs mt-1">{errors.quantity_liters}</p>}
        </div>

        {/* FAT + LR */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">FAT % *</label>
            <input type="number" inputMode="decimal" step="0.01" placeholder="0.00"
              value={form.fat_percentage} onChange={set('fat_percentage')}
              className={`w-full border rounded-xl px-3 py-3.5 text-xl font-bold font-mono text-center text-blue-600 focus:outline-none
                ${errors.fat_percentage ? 'border-red-400' : 'border-slate-200 focus:border-[#1d6faa]'}`}/>
            {errors.fat_percentage && <p className="text-red-500 text-xs mt-1">{errors.fat_percentage}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">LR (Lactometer) *</label>
            <input type="number" inputMode="decimal" step="0.1" placeholder="0.0"
              value={form.lactometer_reading} onChange={set('lactometer_reading')}
              className={`w-full border rounded-xl px-3 py-3.5 text-xl font-bold font-mono text-center text-violet-600 focus:outline-none
                ${errors.lactometer_reading ? 'border-red-400' : 'border-slate-200 focus:border-[#1d6faa]'}`}/>
            {errors.lactometer_reading && <p className="text-red-500 text-xs mt-1">{errors.lactometer_reading}</p>}
          </div>
        </div>

        {/* SNF */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            SNF % <span className="normal-case font-normal text-slate-400">(optional)</span>
          </label>
          <input type="number" inputMode="decimal" step="0.01" placeholder="0.00"
            value={form.snf_percentage} onChange={set('snf_percentage')}
            className="w-full border border-slate-200 rounded-xl px-3 py-3 text-lg font-mono text-center text-emerald-600 focus:outline-none focus:border-[#1d6faa]"/>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Notes <span className="normal-case font-normal text-slate-400">(optional)</span>
          </label>
          <input value={form.notes} onChange={set('notes')}
            placeholder="Any remarks…"
            className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-[#1d6faa]"/>
        </div>

        {/* ── TS / SNF Preview Panel ─────────────────────────────── */}
        {(prevLoad || preview) && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calculator size={15} className="text-blue-500"/>
              <p className="text-sm font-semibold text-blue-700">Live Calculation</p>
              {prevLoad && <RefreshCw size={12} className="text-blue-400 animate-spin ml-auto"/>}
            </div>

            {preview && !prevLoad && (
              <div className="space-y-2">
                {/* Row 1: TS + Standardised */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white rounded-xl p-3 border border-blue-100 text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Total Solids (TS)</p>
                    <p className="font-bold text-2xl font-mono text-blue-700">{preview.ts}</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-blue-100 text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Standardised TS</p>
                    <p className="font-bold text-2xl font-mono text-violet-700">{preview.standardised_ts}</p>
                  </div>
                </div>

                {/* SNF if entered */}
                {form.snf_percentage && parseFloat(form.snf_percentage) > 0 && (
                  <div className="bg-white rounded-xl p-3 border border-emerald-100 text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">SNF %</p>
                    <p className="font-bold text-xl font-mono text-emerald-700">{parseFloat(form.snf_percentage).toFixed(2)}%</p>
                  </div>
                )}

                {/* Price — only if backend returns it (admin sees, purchase staff doesn't) */}
                {preview.rate_per_unit !== undefined && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="bg-white rounded-xl p-3 border border-slate-100 text-center">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Rate / Unit</p>
                      <p className="font-bold text-base font-mono text-slate-700">
                        Rs {Number(preview.rate_per_unit).toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-emerald-200 text-center">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Total Payout</p>
                      <p className="font-bold text-xl font-mono text-emerald-700">
                        Rs {Number(preview.total_payout).toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        <button type="submit" disabled={saving}
          className="w-full py-4 rounded-2xl bg-[#1d6faa] hover:bg-[#1557a0] active:scale-[0.98]
                     text-white font-bold text-lg flex items-center justify-center gap-3
                     transition-all disabled:opacity-60 shadow-md mt-2">
          {saving
            ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"/>
            : <><Milk size={21}/>Save Collection</>}
        </button>

      </form>

      {/* Today's entries */}
      {today.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Today's Entries ({today.length})
          </p>
          <div className="space-y-2">
            {today.map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white border border-slate-200">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                    ${r.shift==='morning' ? 'bg-amber-50' : 'bg-slate-100'}`}>
                    {r.shift==='morning'
                      ? <Sun size={14} className="text-amber-500"/>
                      : <Moon size={14} className="text-slate-400"/>}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{r.farmer_name}</p>
                    <p className="text-xs text-slate-400 font-mono">
                      {parseFloat(r.quantity_liters).toFixed(1)}L
                      {r.fat_percentage ? ` · FAT ${parseFloat(r.fat_percentage).toFixed(1)}%` : ''}
                      {r.lactometer_reading ? ` · LR ${parseFloat(r.lactometer_reading).toFixed(1)}` : ''}
                      {r.snf_percentage ? ` · SNF ${parseFloat(r.snf_percentage).toFixed(1)}%` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {r.ts_value
                    ? <p className="text-xs font-mono font-semibold text-blue-600">TS: {parseFloat(r.ts_value).toFixed(2)}</p>
                    : null}
                  {r.total_amount != null
                    ? <p className="text-sm font-bold font-mono text-emerald-600">
                        Rs {Number(r.total_amount).toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                      </p>
                    : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
