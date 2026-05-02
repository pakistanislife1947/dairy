import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/authStore';

import AdminLayout  from './components/layout/AdminLayout';
import StaffLayout  from './components/layout/StaffLayout';

import LoginPage          from './pages/auth/LoginPage';
import RegisterPage       from './pages/auth/RegisterPage';
import VerifyEmailPage    from './pages/auth/VerifyEmailPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage  from './pages/auth/ResetPasswordPage';
import OAuthCallback      from './pages/auth/OAuthCallback';

import Dashboard  from './pages/admin/Dashboard';
import Farmers    from './pages/admin/Farmers';
import MilkAdmin  from './pages/admin/MilkAdmin';
import Billing    from './pages/admin/Billing';
import Sales      from './pages/admin/Sales';
import Vehicles   from './pages/admin/Vehicles';
import Shops      from './pages/admin/Shops';
import HRPayroll  from './pages/admin/HRPayroll';
import Expenses   from './pages/admin/Expenses';
import Reports    from './pages/admin/Reports';
import AuditLogs  from './pages/admin/AuditLogs';
import Settings   from './pages/admin/Settings';
import Customers  from './pages/admin/Customers';
import Products   from './pages/admin/Products';   // ← was missing

import StaffDashboard from './pages/staff/StaffDashboard';
import MilkEntry      from './pages/staff/MilkEntry';

function RequireAuth({ children, adminOnly = false }) {
  const { isLoggedIn, isLoading, user } = useAuthStore();
  if (isLoading) return <PageSpinner />;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (adminOnly && user?.role !== 'admin') return <Navigate to="/staff" replace />;
  return children;
}

function PageSpinner() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  const init = useAuthStore(s => s.init);
  useEffect(() => { init(); }, []);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' },
          success: { iconTheme: { primary: '#10b981', secondary: '#1e293b' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#1e293b' } },
        }}
      />
      <Routes>
        {/* Public */}
        <Route path="/login"           element={<LoginPage />} />
        <Route path="/register"        element={<RegisterPage />} />
        <Route path="/verify-email"    element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password"  element={<ResetPasswordPage />} />
        <Route path="/oauth-callback"  element={<OAuthCallback />} />

        {/* Admin — all under RequireAuth + AdminLayout */}
        <Route path="/admin" element={<RequireAuth adminOnly><AdminLayout /></RequireAuth>}>
          <Route index             element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard"  element={<Dashboard />} />
          <Route path="farmers"    element={<Farmers />} />
          <Route path="milk"       element={<MilkAdmin />} />
          <Route path="billing"    element={<Billing />} />
          <Route path="sales"      element={<Sales />} />
          <Route path="vehicles"   element={<Vehicles />} />
          <Route path="shops"      element={<Shops />} />
          <Route path="hr"         element={<HRPayroll />} />
          <Route path="expenses"   element={<Expenses />} />
          <Route path="reports"    element={<Reports />} />
          <Route path="audit"      element={<AuditLogs />} />
          <Route path="settings"   element={<Settings />} />
          <Route path="customers"  element={<Customers />} />
          <Route path="products"   element={<Products />} />  {/* ← moved inside, now auth-protected */}
        </Route>

        {/* Staff */}
        <Route path="/staff" element={<RequireAuth><StaffLayout /></RequireAuth>}>
          <Route index       element={<StaffDashboard />} />
          <Route path="milk" element={<MilkEntry />} />
        </Route>

        <Route path="/"  element={<RootRedirect />} />
        <Route path="*"  element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function RootRedirect() {
  const { isLoggedIn, user, isLoading } = useAuthStore();
  if (isLoading) return <PageSpinner />;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <Navigate to={user?.role === 'admin' ? '/admin/dashboard' : '/staff'} replace />;
}
