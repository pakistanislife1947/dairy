import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import useAuthStore from '../../store/authStore';

export default function LoginPage() {
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [logo, setLogo]         = useState('');
  const { login } = useAuthStore();
  const navigate  = useNavigate();
  const { register, handleSubmit, formState:{ errors } } = useForm();

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
      toast.error(err.response?.data?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', fontFamily:'Inter,sans-serif' }}>

      {/* Left panel */}
      <div style={{
        flex:1, position:'relative', overflow:'hidden',
        background:'linear-gradient(145deg,#0a2540 0%,#1b6ca8 60%,#1e90d6 100%)',
        display:'flex', flexDirection:'column', justifyContent:'space-between', padding:'40px 56px',
      }} className="hidden lg:flex">
        {/* Subtle grid overlay */}
        <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)', backgroundSize:'32px 32px', pointerEvents:'none' }}/>

        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:14, position:'relative' }}>
          {logo
            ? <img src={logo} alt="logo" style={{ height:48, width:48, objectFit:'contain', borderRadius:12, background:'rgba(255,255,255,0.15)', padding:4 }}/>
            : <div style={{ width:48, height:48, borderRadius:12, background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, fontWeight:800, color:'#fff' }}>B</div>
          }
          <div>
            <p style={{ color:'#fff', fontWeight:700, fontSize:18, margin:0 }}>Brimi Dairy</p>
            <p style={{ color:'rgba(255,255,255,0.55)', fontSize:12, margin:0 }}>Management System</p>
          </div>
        </div>

        {/* Center content */}
        <div style={{ position:'relative' }}>
          <h1 style={{ color:'#fff', fontSize:40, fontWeight:800, lineHeight:1.2, margin:'0 0 20px' }}>
            Smart dairy<br/>
            <span style={{ color:'rgba(255,255,255,0.6)' }}>management.</span>
          </h1>

          {/* Stats */}
          <div style={{ display:'flex', gap:32, marginBottom:40 }}>
            {[['500+','Daily Records'],['4 Types','Customers'],['100%','Automated']].map(([n,l])=>(
              <div key={l}>
                <p style={{ color:'#fff', fontSize:22, fontWeight:800, margin:0 }}>{n}</p>
                <p style={{ color:'rgba(255,255,255,0.5)', fontSize:11, margin:0 }}>{l}</p>
              </div>
            ))}
          </div>

          {/* Testimonial card */}
          <div style={{ background:'rgba(255,255,255,0.1)', backdropFilter:'blur(12px)', borderRadius:16, padding:'20px 24px', border:'1px solid rgba(255,255,255,0.15)', maxWidth:420 }}>
            <p style={{ color:'rgba(255,255,255,0.85)', fontSize:13, lineHeight:1.7, margin:'0 0 14px' }}>
              "Real-time insight into every operation — milk collection, billing, payroll, all in one place."
            </p>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:34, height:34, borderRadius:'50%', background:'rgba(255,255,255,0.25)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:13 }}>M</div>
              <div>
                <p style={{ color:'#fff', fontWeight:600, fontSize:12, margin:0 }}>Muhammad Shahid</p>
                <p style={{ color:'rgba(255,255,255,0.5)', fontSize:11, margin:0 }}>Dairy Owner, Multan</p>
              </div>
            </div>
          </div>
        </div>

        <p style={{ color:'rgba(255,255,255,0.35)', fontSize:11, position:'relative' }}>
          Developed by <span style={{ color:'rgba(255,255,255,0.6)', fontWeight:600 }}>Quantum Solution Group</span> · © 2025
        </p>
      </div>

      {/* Right panel - Form */}
      <div style={{ width:'100%', maxWidth:480, display:'flex', flexDirection:'column', justifyContent:'center', padding:'48px 48px', background:'#f8fafc', overflowY:'auto' }}>

        {/* Mobile logo */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:36 }} className="lg:hidden">
          {logo
            ? <img src={logo} alt="logo" style={{ height:36, width:36, objectFit:'contain', borderRadius:8 }}/>
            : <div style={{ width:36, height:36, borderRadius:8, background:'#1b6ca8', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800 }}>B</div>
          }
          <span style={{ fontWeight:700, fontSize:15, color:'#1a2636' }}>Brimi Dairy</span>
        </div>

        <h2 style={{ fontSize:26, fontWeight:800, color:'#0a2540', margin:'0 0 6px' }}>Welcome back</h2>
        <p style={{ fontSize:13, color:'#94a3b8', margin:'0 0 32px' }}>Sign in to continue to your dashboard</p>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Email */}
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:6, letterSpacing:'0.05em', textTransform:'uppercase' }}>Email</label>
            <input type="email" placeholder="admin@dairy.local"
              style={{ width:'100%', padding:'12px 14px', border:'1.5px solid #e2e8f0', borderRadius:10, fontSize:14,
                       background:'#fff', color:'#1a2636', outline:'none', boxSizing:'border-box', transition:'border-color 0.15s' }}
              onFocus={e=>e.target.style.borderColor='#1b6ca8'}
              onBlur={e=>e.target.style.borderColor='#e2e8f0'}
              {...register('email', { required:'Email required' })}/>
            {errors.email && <p style={{ color:'#ef4444', fontSize:11, marginTop:4 }}>{errors.email.message}</p>}
          </div>

          {/* Password */}
          <div style={{ marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'#374151', letterSpacing:'0.05em', textTransform:'uppercase' }}>Password</label>
              <Link to="/forgot-password" style={{ fontSize:11, color:'#1b6ca8', textDecoration:'none', fontWeight:500 }}>Forgot?</Link>
            </div>
            <div style={{ position:'relative' }}>
              <input type={showPass?'text':'password'} placeholder="••••••••"
                style={{ width:'100%', padding:'12px 40px 12px 14px', border:'1.5px solid #e2e8f0', borderRadius:10,
                         fontSize:14, background:'#fff', color:'#1a2636', outline:'none', boxSizing:'border-box', transition:'border-color 0.15s' }}
                onFocus={e=>e.target.style.borderColor='#1b6ca8'}
                onBlur={e=>e.target.style.borderColor='#e2e8f0'}
                {...register('password', { required:'Password required' })}/>
              <button type="button" onClick={()=>setShowPass(p=>!p)}
                style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:0, display:'flex' }}>
                {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
            {errors.password && <p style={{ color:'#ef4444', fontSize:11, marginTop:4 }}>{errors.password.message}</p>}
          </div>

          {/* Remember */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:24 }}>
            <input type="checkbox" id="rem" style={{ width:15, height:15, accentColor:'#1b6ca8' }} {...register('rememberMe')}/>
            <label htmlFor="rem" style={{ fontSize:12, color:'#64748b', cursor:'pointer' }}>Remember me for 30 days</label>
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading}
            style={{ width:'100%', padding:'13px 0', borderRadius:10, border:'none',
                     background: loading ? '#94a3b8' : 'linear-gradient(135deg,#1b6ca8,#1e90d6)',
                     color:'#fff', fontWeight:700, fontSize:14, cursor: loading?'not-allowed':'pointer',
                     display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'opacity 0.15s', boxShadow:'0 4px 14px rgba(27,108,168,0.35)' }}>
            {loading
              ? <><div style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTop:'2px solid #fff', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>Signing in…</>
              : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign:'center', fontSize:12, color:'#94a3b8', marginTop:24 }}>
          No account? <Link to="/register" style={{ color:'#1b6ca8', fontWeight:600, textDecoration:'none' }}>Register</Link>
        </p>

        <p style={{ textAlign:'center', fontSize:10, color:'#cbd5e1', marginTop:32 }}>
          Developed by <span style={{ fontWeight:600 }}>Quantum Solution Group</span> · © 2025
        </p>
      </div>

      <style>{`@keyframes spin { to { transform:rotate(360deg); } } @media(max-width:1024px){ .lg\\:hidden{display:flex!important;} .lg\\:flex{display:none!important;} }`}</style>
    </div>
  );
}
