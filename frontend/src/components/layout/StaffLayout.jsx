import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Droplets, Milk, LayoutDashboard, LogOut } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

export default function StaffLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-[#d1dce8] px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center">
            <Droplets className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm text-slate-800 leading-none">Dairy ERP</p>
            <p className="text-xs text-muted leading-none mt-0.5">{user?.name}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="text-muted hover:text-red-400 transition-colors p-2">
          <LogOut size={18} />
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="bg-white border-t border-[#d1dce8] px-6 py-3 flex items-center justify-around sticky bottom-0">
        {[
          { to: '/staff',      icon: LayoutDashboard, label: 'Home', end: true },
          { to: '/staff/milk', icon: Milk,            label: 'Milk Entry' },
        ].map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-5 py-1 rounded-xl transition-all
              ${isActive ? 'text-brand-400' : 'text-muted hover:text-slate-600'}`
            }
          >
            <Icon size={22} />
            <span className="text-xs font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
