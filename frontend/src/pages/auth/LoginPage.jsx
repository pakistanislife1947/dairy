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
  const [appName, setAppName]   = useState('Brimi Dairy');
  const { login } = useAuthStore();
  const navigate  = useNavigate();
  const { register, handleSubmit, formState:{ errors } } = useForm();

  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      if (data.settings?.logo_url)  setLogo(data.settings.logo_url);
      if (data.settings?.app_name)  setAppName(data.settings.app_name);
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
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f0f4f8', fontFamily:'Inter,sans-serif', padding:'24px' }}>

      {/* Card */}
      <div style={{ width:'100%', maxWidth:440, background:'#fff', borderRadius:20, boxShadow:'0 8px 40px rgba(0,0,0,0.10)', padding:'44px 44px 36px', border:'1px solid #e8edf3' }}>

        {/* Logo + Name */}
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:36 }}>
          {logo
            ? <img src={logo} alt="logo" style={{ height:52, width:52, objectFit:'contain', borderRadius:12 }}/>
            : <div style={{ width:52, height:52, borderRadius:12, background:'linear-gradient(135deg,#1b6ca8,#1e90d6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:900, color:'#fff' }}>
                {appName[0]}
              </div>
          }
          <div>
            <p style={{ margin:0, fontWeight:800, fontSize:20, color:'#0a2540' }}>{appName}</p>
            <p style={{ margin:0, fontSize:12, color:'#94a3b8' }}>Management System</p>
          </div>
        </div>

        <h2 style={{ margin:'0 0 4px', fontSize:22, fontWeight:700, color:'#0a2540' }}>Sign in</h2>
        <p style={{ margin:'0 0 28px', fontSize:13, color:'#94a3b8' }}>Enter your credentials to continue</p>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:6 }}>Email</label>
            <input type="email" placeholder="admin@dairy.local" autoComplete="email"
              style={{ width:'100%', padding:'11px 14px', border:'1.5px solid #e2e8f0', borderRadius:10, fontSize:14, color:'#1a2636', background:'#f8fafc', outline:'none', boxSizing:'border-box' }}
              {...register('email', { required:'Required' })}/>
            {errors.email && <p style={{ color:'#ef4444', fontSize:11, marginTop:4 }}>{errors.email.message}</p>}
          </div>

          <div style={{ marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'#374151' }}>Password</label>
              <Link to="/forgot-password" style={{ fontSize:11, color:'#1b6ca8', textDecoration:'none', fontWeight:500 }}>Forgot password?</Link>
            </div>
            <div style={{ position:'relative' }}>
              <input type={showPass?'text':'password'} placeholder="••••••••" autoComplete="current-password"
                style={{ width:'100%', padding:'11px 42px 11px 14px', border:'1.5px solid #e2e8f0', borderRadius:10, fontSize:14, color:'#1a2636', background:'#f8fafc', outline:'none', boxSizing:'border-box' }}
                {...register('password', { required:'Required' })}/>
              <button type="button" onClick={()=>setShowPass(p=>!p)}
                style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:0, display:'flex' }}>
                {showPass?<EyeOff size={16}/>:<Eye size={16}/>}
              </button>
            </div>
            {errors.password && <p style={{ color:'#ef4444', fontSize:11, marginTop:4 }}>{errors.password.message}</p>}
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:24 }}>
            <input type="checkbox" id="rem" style={{ width:15, height:15, accentColor:'#1b6ca8' }} {...register('rememberMe')}/>
            <label htmlFor="rem" style={{ fontSize:12, color:'#64748b', cursor:'pointer' }}>Remember me (30 days)</label>
          </div>

          <button type="submit" disabled={loading}
            style={{ width:'100%', padding:'12px 0', borderRadius:10, border:'none',
              background: loading?'#94a3b8':'#1b6ca8', color:'#fff', fontWeight:700, fontSize:14,
              cursor:loading?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              boxShadow:'0 4px 14px rgba(27,108,168,0.3)', transition:'background 0.15s' }}>
            {loading
              ? <><div style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTop:'2px solid #fff', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>Signing in…</>
              : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign:'center', fontSize:11, color:'#cbd5e1', marginTop:28 }}>
          Developed by <span style={{ fontWeight:600 }}>Quantum Solution Group</span> · © 2025
        </p>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );
}
