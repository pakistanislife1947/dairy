import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import useAuthStore from '../../store/authStore';

export default function LoginPage() {
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const { login }  = useAuthStore();
  const navigate   = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', data);
      if (res.data.success) {
        login(res.data.data.user, res.data.data.accessToken, res.data.data.refreshToken);
        navigate(res.data.data.user.role === 'admin' ? '/admin/dashboard' : '/staff');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#f0f4f8' }}>

      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12"
        style={{ background: 'linear-gradient(135deg, #0f4c75 0%, #1b6ca8 50%, #187bcd 100%)' }}>
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Brimi Dairy" className="h-12 w-12 object-contain rounded-xl"
            onError={e => e.target.style.display='none'} />
          <div>
            <p className="text-white font-bold text-xl">Brimi Dairy</p>
            <p className="text-blue-200 text-xs">Management System</p>
          </div>
        </div>

        <div>
          <h1 className="text-white text-4xl font-bold leading-tight mb-4">
            Manage your dairy<br />
            <span className="text-blue-200">smarter, faster.</span>
          </h1>
          <p className="text-blue-100 text-base leading-relaxed mb-10">
            Complete farm-to-sale dairy management — milk collection, billing, payroll, and real-time analytics.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {['Dynamic Pricing','Auto Payroll','P&L Reports','Audit Trail'].map(f => (
              <div key={f} className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20">
                <p className="text-white font-semibold text-sm">{f}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-blue-200 text-xs">
          Developed by <span className="text-white font-semibold">Quantum Solution Group</span> &nbsp;|&nbsp; © 2025
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: '#1b6ca8' }}>
            <span className="text-white font-bold text-lg">B</span>
          </div>
          <div>
            <p className="font-bold text-slate-800">Brimi Dairy</p>
            <p className="text-xs text-slate-500">Management System</p>
          </div>
        </div>

        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg border border-[#d1dce8] p-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-1">Welcome back</h2>
            <p className="text-slate-500 text-sm mb-7">Sign in to your account</p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  placeholder="admin@dairy.local"
                  className="input"
                  {...register('email', { required: 'Email required' })}
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="input pr-10"
                    {...register('password', { required: 'Password required' })}
                  />
                  <button type="button" onClick={() => setShowPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" className="rounded" {...register('rememberMe')} />
                  Remember me (30 days)
                </label>
                <Link to="/forgot-password" className="text-xs font-medium" style={{ color: '#1b6ca8' }}>
                  Forgot password?
                </Link>
              </div>

              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                           text-white font-semibold text-sm transition-all
                           disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
                style={{ background: loading ? '#94a3b8' : 'linear-gradient(135deg, #1b6ca8, #187bcd)' }}>
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Signing in...</>
                ) : (
                  <><LogIn size={16} />Sign In</>
                )}
              </button>
            </form>

            <p className="text-center text-sm text-slate-500 mt-6">
              No account?{' '}
              <Link to="/register" className="font-semibold" style={{ color: '#1b6ca8' }}>Register</Link>
            </p>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            Developed by <span className="font-semibold text-slate-500">Quantum Solution Group</span> &nbsp;·&nbsp; © 2025 All rights reserved
          </p>
        </div>
      </div>
    </div>
  );
}
