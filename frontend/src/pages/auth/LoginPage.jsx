import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import useAuthStore from '../../store/authStore';

export default function LoginPage() {
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [logo, setLogo]         = useState('');
  const { login }  = useAuthStore();
  const navigate   = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm();

  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      if (data.settings?.logo_url) setLogo(data.settings.logo_url);
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
      toast.error(err.response?.data?.message || 'Login failed.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#fff' }}>

      {/* LEFT: Form */}
      <div style={{ width:'100%', maxWidth:480, display:'flex', flexDirection:'column',
                    justifyContent:'space-between', padding:'32px 48px', overflowY:'auto' }}>

        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {logo
            ? <img src={logo} alt="Logo" style={{ height:44, width:44, objectFit:'contain', borderRadius:10 }} />
            : <div style={{ width:44, height:44, borderRadius:10, background:'#1b6ca8',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            color:'#fff', fontWeight:800, fontSize:20 }}>B</div>
          }
          <div>
            <div style={{ fontWeight:700, fontSize:16, color:'#1a2636' }}>Brimi Dairy</div>
            <div style={{ fontSize:11, color:'#6b7a8d' }}>Management System</div>
          </div>
        </div>

        {/* Form */}
        <div>
          <h2 style={{ fontSize:26, fontWeight:700, color:'#1a2636', marginBottom:4 }}>Welcome Back!</h2>
          <p style={{ fontSize:13, color:'#6b7a8d', marginBottom:24 }}>Sign in to manage your dairy operations.</p>

          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Email */}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:6 }}>Email</label>
              <div style={{ position:'relative' }}>
                <Mail size={15} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }} />
                <input type="email" placeholder="Enter your email"
                  style={{ width:'100%', paddingLeft:38, paddingRight:14, paddingTop:11, paddingBottom:11,
                           border:'1px solid #e2e8f0', borderRadius:10, fontSize:13, background:'#f8fafc',
                           outline:'none', boxSizing:'border-box', color:'#1a2636' }}
                  {...register('email', { required: 'Required' })} />
              </div>
              {errors.email && <p style={{ color:'#ef4444', fontSize:11, marginTop:4 }}>{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div style={{ marginBottom:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <label style={{ fontSize:12, fontWeight:600, color:'#374151' }}>Password</label>
                <Link to="/forgot-password" style={{ fontSize:11, color:'#1b6ca8', textDecoration:'none' }}>Forgot Password?</Link>
              </div>
              <div style={{ position:'relative' }}>
                <Lock size={15} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }} />
                <input type={showPass ? 'text' : 'password'} placeholder="Enter your password"
                  style={{ width:'100%', paddingLeft:38, paddingRight:40, paddingTop:11, paddingBottom:11,
                           border:'1px solid #e2e8f0', borderRadius:10, fontSize:13, background:'#f8fafc',
                           outline:'none', boxSizing:'border-box', color:'#1a2636' }}
                  {...register('password', { required: 'Required' })} />
                <button type="button" onClick={() => setShowPass(p=>!p)}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                           background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:0 }}>
                  {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
              {errors.password && <p style={{ color:'#ef4444', fontSize:11, marginTop:4 }}>{errors.password.message}</p>}
            </div>

            {/* Remember */}
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20 }}>
              <input type="checkbox" id="rem" style={{ width:14, height:14 }} {...register('rememberMe')} />
              <label htmlFor="rem" style={{ fontSize:12, color:'#6b7a8d', cursor:'pointer' }}>Remember me (30 days)</label>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading}
              style={{ width:'100%', padding:'12px 0', borderRadius:10, border:'none',
                       background: loading ? '#94a3b8' : '#1b6ca8', color:'#fff',
                       fontWeight:600, fontSize:14, cursor: loading ? 'not-allowed' : 'pointer',
                       display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {loading
                ? <><div style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.4)',
                                  borderTop:'2px solid #fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />Signing in...</>
                : 'Sign In'}
            </button>
          </form>

          <p style={{ textAlign:'center', fontSize:12, color:'#6b7a8d', marginTop:16 }}>
            No account?{' '}
            <Link to="/register" style={{ color:'#1b6ca8', fontWeight:600, textDecoration:'none' }}>Register</Link>
          </p>
        </div>

        {/* Footer */}
        <p style={{ fontSize:11, color:'#9ca3af', textAlign:'center' }}>
          Developed by <span style={{ fontWeight:600, color:'#6b7a8d' }}>Quantum Solution Group</span> · © 2025
        </p>
      </div>

      {/* RIGHT: Dark panel */}
      <div style={{ flex:1, background:'linear-gradient(160deg,#0d3b6e 0%,#1b6ca8 45%,#1e90d6 100%)',
                    display:'flex', flexDirection:'column', justifyContent:'space-between',
                    padding:'40px 56px', overflow:'hidden' }}
           className="hidden-mobile">

        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {logo
            ? <img src={logo} alt="Logo" style={{ height:44, width:44, objectFit:'contain', borderRadius:10,
                                                   background:'rgba(255,255,255,0.15)', padding:4 }} />
            : <div style={{ width:44, height:44, borderRadius:10, background:'rgba(255,255,255,0.2)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            color:'#fff', fontWeight:800, fontSize:20 }}>B</div>
          }
          <div>
            <div style={{ color:'#fff', fontWeight:700, fontSize:16 }}>Brimi Dairy</div>
            <div style={{ color:'rgba(255,255,255,0.6)', fontSize:11 }}>Management System</div>
          </div>
        </div>

        <div>
          <h1 style={{ color:'#fff', fontSize:36, fontWeight:700, lineHeight:1.3, marginBottom:16 }}>
            Manage your dairy<br />
            <span style={{ color:'rgba(255,255,255,0.7)' }}>operations with ease.</span>
          </h1>
          <p style={{ color:'rgba(255,255,255,0.75)', fontSize:14, lineHeight:1.7, marginBottom:32, maxWidth:380 }}>
            Complete farm-to-sale dairy management — milk collection, billing, payroll, and real-time analytics.
          </p>
          <div style={{ background:'rgba(255,255,255,0.12)', borderRadius:16, padding:24,
                        border:'1px solid rgba(255,255,255,0.2)', maxWidth:400, marginBottom:32 }}>
            <p style={{ color:'rgba(255,255,255,0.9)', fontSize:13, lineHeight:1.7, marginBottom:16 }}>
              "This system has completely transformed how we manage our dairy. Real-time insights into every operation."
            </p>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.3)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            color:'#fff', fontWeight:700, fontSize:14 }}>M</div>
              <div>
                <div style={{ color:'#fff', fontWeight:600, fontSize:13 }}>Muhammad Shahid</div>
                <div style={{ color:'rgba(255,255,255,0.6)', fontSize:11 }}>Dairy Farm Owner, Multan</div>
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:32 }}>
            {[['10+','Farms'],['500+','Daily Records'],['100%','Uptime']].map(([n,l]) => (
              <div key={l} style={{ textAlign:'center' }}>
                <div style={{ color:'#fff', fontSize:24, fontWeight:700 }}>{n}</div>
                <div style={{ color:'rgba(255,255,255,0.6)', fontSize:11, marginTop:2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ color:'rgba(255,255,255,0.5)', fontSize:11 }}>
          Powered by <span style={{ color:'#fff', fontWeight:600 }}>Quantum Solution Group</span>
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) { .hidden-mobile { display: none !important; } }
      `}</style>
    </div>
  );
}
