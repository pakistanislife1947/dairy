import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Mail, Lock, Milk } from 'lucide-react';
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
    <div className="min-h-screen flex bg-white">

      {/* ── Left: Form ──────────────────────────── */}
      <div className="flex flex-col justify-between w-full lg:w-[45%] px-8 py-10 md:px-16">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: '#1b6ca8' }}>
            <Milk size={20} className="text-white" />
          </div>
          <span className="font-bold text-slate-800 text-lg">Brimi Dairy</span>
        </div>

        {/* Form */}
        <div className="max-w-sm w-full mx-auto">
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Welcome Back!</h2>
          <p className="text-slate-500 text-sm mb-8">
            Sign in to access your dashboard and manage your dairy operations.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="email" placeholder="Enter your email"
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm
                             text-slate-800 placeholder-slate-400 bg-slate-50
                             focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500
                             focus:bg-white transition-all"
                  {...register('email', { required: 'Email is required' })} />
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-slate-700">Password</label>
                <Link to="/forgot-password" className="text-xs font-medium text-blue-600 hover:text-blue-700">
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type={showPass ? 'text' : 'password'} placeholder="Enter your password"
                  className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl text-sm
                             text-slate-800 placeholder-slate-400 bg-slate-50
                             focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500
                             focus:bg-white transition-all"
                  {...register('password', { required: 'Password is required' })} />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="rem" className="w-4 h-4 rounded border-slate-300 text-blue-600"
                {...register('rememberMe')} />
              <label htmlFor="rem" className="text-sm text-slate-600 cursor-pointer">Remember me (30 days)</label>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm
                         flex items-center justify-center gap-2 transition-all shadow-md
                         disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: '#1b6ca8' }}>
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Signing in...</>
                : 'Sign In'}
            </button>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400">OR</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <button type="button"
              className="w-full py-3 rounded-xl text-slate-700 font-medium text-sm border border-slate-200
                         flex items-center justify-center gap-2 hover:bg-slate-50 transition-all">
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.5 33.4 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l6-6C34.4 6.5 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-7.9 19.7-20 0-1.3-.1-2.7-.1-4z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.9 5.1C14.9 16 19.1 13 24 13c3 0 5.7 1.1 7.8 2.9l6-6C34.4 6.5 29.5 4 24 4 16.2 4 9.5 8.4 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.4 0 10.2-1.9 13.9-5.1l-6.4-5.4C29.5 35.1 26.9 36 24 36c-5.2 0-9.5-3.5-11.2-8.3l-6.9 5.3C9.4 39.5 16.2 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.5-2.6 4.6-4.8 6l6.4 5.4C40.9 35.4 44 30.1 44 24c0-1.3-.1-2.7-.4-4z"/>
              </svg>
              Continue with Google
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Don't have an Account?{' '}
            <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700">Sign Up</Link>
          </p>
        </div>

        {/* Footer */}
        <p className="text-xs text-slate-400 text-center">
          Developed by <span className="font-semibold text-slate-500">Quantum Solution Group</span> · © 2025
        </p>
      </div>

      {/* ── Right: Info Panel ──────────────────── */}
      <div className="hidden lg:flex flex-col justify-between flex-1 p-14 rounded-l-3xl"
        style={{ background: 'linear-gradient(160deg, #0d3b6e 0%, #1b6ca8 45%, #1e90d6 100%)' }}>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
            <Milk size={22} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg">Brimi Dairy</p>
            <p className="text-blue-200 text-xs">Management System</p>
          </div>
        </div>

        <div>
          <h1 className="text-white text-4xl font-bold leading-tight mb-5">
            Manage your dairy<br />
            <span className="text-blue-200">operations with ease.</span>
          </h1>
          <p className="text-blue-100 text-base leading-relaxed mb-10 max-w-md">
            Complete farm-to-sale dairy management — milk collection, billing, payroll, and real-time analytics — all in one place.
          </p>

          {/* Testimonial style */}
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 max-w-md">
            <p className="text-white/90 text-sm leading-relaxed mb-4">
              "This system has completely transformed how we manage our dairy. It's reliable, efficient, and gives us real-time insight into every operation."
            </p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/30 flex items-center justify-center text-white font-bold text-sm">M</div>
              <div>
                <p className="text-white font-semibold text-sm">Muhammad Shahid</p>
                <p className="text-blue-200 text-xs">Dairy Farm Owner, Multan</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-8 max-w-md">
            {[
              { n: '10+', l: 'Farms Managed' },
              { n: '500+', l: 'Daily Records' },
              { n: '100%', l: 'Uptime' },
            ].map(({ n, l }) => (
              <div key={l} className="text-center">
                <p className="text-white text-2xl font-bold">{n}</p>
                <p className="text-blue-200 text-xs mt-1">{l}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-blue-300 text-xs">
          Powered by <span className="text-white font-semibold">Quantum Solution Group</span>
        </p>
      </div>
    </div>
  );
}
