import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import useAuthStore from '../../store/authStore';

const FEATURES = [
  'Milk collection & FAT/SNF pricing',
  'Bulk, Household & Cash customers',
  'Auto invoicing & billing',
  'HR, payroll & advance management',
  'Real-time reports & analytics',
];

export default function LoginPage() {
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [logo, setLogo]         = useState('');
  const [appName, setAppName]   = useState('Brimi Dairy');
  const { login } = useAuthStore();
  const navigate  = useNavigate();
  const { register, handleSubmit, formState:{ errors } } = useForm();

  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      if (data.settings?.logo_url) setLogo(data.settings.logo_url);
      if (data.settings?.app_name) setAppName(data.settings.app_name);
    }).catch(() => {});
  }, []);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', data);
      if (res.data.success) {
        login(res.data.data.user, res.data.data.accessToken, res.data.data.refreshToken);
        navigate(res.data.data.user.role === 'admin' ? '/admin/dashboard' : '/staff');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── LEFT PANEL ──────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[46%] min-h-screen p-12"
        style={{ background: '#0d2137' }}>

        {/* Logo */}
        <div className="flex items-center gap-4">
          {logo
            ? <img src={logo} alt="logo" className="w-12 h-12 rounded-xl object-contain" style={{ background:'rgba(255,255,255,0.1)', padding:4 }}/>
            : <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black text-white" style={{ background:'#1b6ca8' }}>{appName[0]}</div>
          }
          <div>
            <p className="text-white font-bold text-lg leading-none">{appName}</p>
            <p className="text-blue-400 text-xs mt-0.5">Dairy Management System</p>
          </div>
        </div>

        {/* Headline */}
        <div className="space-y-6">
          <div>
            <h1 className="text-4xl font-extrabold leading-tight" style={{ color: '#f1f5f9' }}>
              Complete dairy<br/>management,<br/>
              <span style={{ color: '#60a5fa' }}>simplified.</span>
            </h1>
            <p className="text-slate-400 mt-4 text-sm leading-relaxed max-w-xs">
              From farm gate to customer — track every liter, every payment, every employee.
            </p>
          </div>

          {/* Features list */}
          <ul className="space-y-3">
            {FEATURES.map(f => (
              <li key={f} className="flex items-center gap-3 text-sm text-slate-300">
                <CheckCircle size={15} className="text-blue-400 flex-shrink-0"/>
                {f}
              </li>
            ))}
          </ul>

          {/* Stats row */}
          <div className="flex gap-8 pt-2">
            {[['4+','Customer Types'],['Auto','Invoicing'],['Real-time','Reports']].map(([n,l])=>(
              <div key={l}>
                <p className="text-white font-bold text-xl">{n}</p>
                <p className="text-slate-500 text-xs mt-0.5">{l}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-slate-600 text-xs">
          Developed by <span className="text-slate-400 font-medium">Quantum Solution Group</span> · © 2025
        </p>
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center min-h-screen bg-slate-50 p-6">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            {logo
              ? <img src={logo} alt="logo" className="w-10 h-10 rounded-lg object-contain"/>
              : <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style={{ background:'#1b6ca8' }}>{appName[0]}</div>
            }
            <span className="font-bold text-slate-800">{appName}</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-800 mb-1">Welcome back</h2>
          <p className="text-slate-400 text-sm mb-8">Sign in to your account</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Email</label>
              <input type="email" placeholder="admin@dairy.local" autoComplete="email"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                {...register('email', { required: 'Required' })}/>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Password</label>
                <Link to="/forgot-password" className="text-xs text-blue-600 hover:text-blue-700 font-medium">Forgot?</Link>
              </div>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} placeholder="••••••••" autoComplete="current-password"
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                  {...register('password', { required: 'Required' })}/>
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="rem" className="w-4 h-4 rounded accent-blue-600" {...register('rememberMe')}/>
              <label htmlFor="rem" className="text-sm text-slate-500 cursor-pointer">Remember me for 30 days</label>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm transition
                         flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: loading ? '#94a3b8' : '#1b6ca8', boxShadow: '0 4px 14px rgba(27,108,168,0.35)' }}>
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Signing in…</>
                : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-8">
            Developed by <span className="font-medium text-slate-500">Quantum Solution Group</span>
          </p>
        </div>
      </div>
    </div>
  );
}
