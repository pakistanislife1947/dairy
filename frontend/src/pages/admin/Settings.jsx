import { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, Upload, Link, Save, RotateCcw, Building2 } from 'lucide-react';
import api from '../../api/client';
import toast from 'react-hot-toast';

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [preview, setPreview]   = useState(null);
  const [logoName, setLogoName] = useState('Brimi Dairy');
  const [logoUrl, setLogoUrl]   = useState('');
  const [mode, setMode]         = useState('upload');
  const fileRef                 = useRef(null);

  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      setSettings(data.settings || {});
      setPreview(data.settings?.logo_url || null);
      setLogoName(data.settings?.logo_name || 'Brimi Dairy');
    }).finally(() => setLoading(false));
  }, []);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/png','image/jpeg','image/svg+xml','image/webp'].includes(file.type)) {
      toast.error('Only PNG, JPG, SVG, WebP allowed'); return;
    }
    if (file.size > 300 * 1024) { toast.error('Max 300KB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const saveLogo = async () => {
    const logoValue = mode === 'upload' ? preview : logoUrl;
    if (!logoValue) { toast.error('Select a logo first'); return; }
    setSaving(true);
    try {
      await api.post('/settings/logo', { logo: logoValue, name: logoName });
      toast.success('Logo updated!');
      window.dispatchEvent(new Event('logo-updated'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save logo');
    } finally { setSaving(false); }
  };

  const resetLogo = async () => {
    if (!window.confirm('Reset logo?')) return;
    setSaving(true);
    try {
      await api.delete('/settings/logo');
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
      toast.success('Logo reset');
      window.dispatchEvent(new Event('logo-updated'));
    } catch { toast.error('Failed'); } finally { setSaving(false); }
  };

  const saveSetting = async (key, value) => {
    try {
      await api.put(`/settings/${key}`, { value });
      toast.success('Saved');
    } catch { toast.error('Failed to save'); }
  };

  if (loading) return <div className="p-8 text-slate-500">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <SettingsIcon size={24} className="text-[#1d6faa]" /> Settings
        </h1>
      </div>

      {/* Logo */}
      <div className="card space-y-5">
        <h2 className="font-semibold text-slate-700 flex items-center gap-2">
          <Building2 size={18} className="text-[#1d6faa]" /> Company Logo
        </h2>

        <div className="flex items-center gap-4">
          <div className="w-20 h-20 border-2 border-dashed border-[#d1dce8] rounded-xl
                          flex items-center justify-center overflow-hidden bg-slate-50">
            {preview
              ? <img src={preview} alt="Logo" className="max-w-full max-h-full object-contain p-1" />
              : <span className="text-slate-400 text-xs text-center px-2">No logo</span>
            }
          </div>
          <div className="text-sm text-slate-500">
            <p>SVG or PNG recommended</p>
            <p>Max 300 KB</p>
          </div>
        </div>

        <div className="flex gap-2">
          {['upload','url'].map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition
                ${mode === m ? 'bg-[#1d6faa] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {m === 'upload' ? <><Upload size={13} className="inline mr-1" />Upload</> : <><Link size={13} className="inline mr-1" />URL</>}
            </button>
          ))}
        </div>

        {mode === 'upload'
          ? <input ref={fileRef} type="file" accept="image/*" onChange={handleFile}
              className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4
                         file:rounded-lg file:border-0 file:bg-blue-50 file:text-[#1d6faa]
                         hover:file:bg-blue-100 cursor-pointer" />
          : <input type="url" value={logoUrl} onChange={e => { setLogoUrl(e.target.value); setPreview(e.target.value); }}
              placeholder="https://..." className="input" />
        }

        <div>
          <label className="label">Company Name (next to logo)</label>
          <input type="text" value={logoName} onChange={e => setLogoName(e.target.value)}
            maxLength={60} className="input" />
        </div>

        <div className="flex gap-3">
          <button onClick={saveLogo} disabled={saving} className="btn-primary">
            <Save size={15} />{saving ? 'Saving...' : 'Save Logo'}
          </button>
          {preview && (
            <button onClick={resetLogo} disabled={saving} className="btn-danger">
              <RotateCcw size={15} />Reset
            </button>
          )}
        </div>
      </div>

      {/* General settings */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-slate-700">General Settings</h2>
        {[
          { key: 'app_name', label: 'Application Name' },
          { key: 'currency', label: 'Currency Symbol' },
          { key: 'timezone', label: 'Timezone' },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center gap-4">
            <label className="w-40 text-sm font-medium text-slate-600 shrink-0">{label}</label>
            <input type="text" defaultValue={settings[key] || ''} onBlur={e => saveSetting(key, e.target.value)}
              className="input flex-1" />
          </div>
        ))}
        <p className="text-xs text-slate-400">Saves automatically when you leave the field.</p>
      </div>
    </div>
  );
}
