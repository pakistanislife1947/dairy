import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import {
  LayoutDashboard, Users, Milk, FileText, TrendingUp,
  Truck, Store, UserCheck, Receipt, BarChart3, Shield,
  LogOut, ChevronLeft, ChevronRight, Menu, Droplets,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const NAV = [
  { to: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: 'farmers',   icon: Users,           label: 'Farmers' },
  { to: 'milk',      icon: Milk,            label: 'Milk Collection' },
  { to: 'billing',   icon: FileText,        label: 'Billing' },
  { to: 'sales',     icon: TrendingUp,      label: 'Sales' },
  { to: 'vehicles',  icon: Truck,           label: 'Vehicles' },
  { to: 'shops',     icon: Store,           label: 'Shops' },
  { to: 'hr',        icon: UserCheck,       label: 'HR & Payroll' },
  { to: 'expenses',  icon: Receipt,         label: 'Expenses' },
  { to: 'reports',   icon: BarChart3,       label: 'Reports' },
  { to: 'audit',     icon: Shield,          label: 'Audit Logs' },
];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-20 bg-black/60 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}

      
      <motion.aside
        animate={{ width: collapsed ? 72 : 240 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`
          relative z-30 flex flex-col flex-shrink-0
          bg-card border-r border-border
          lg:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          fixed lg:static inset-y-0 left-0 transition-transform
        `}
      >
        {/* Logo */}


        // In AdminLayout.jsx or your Sidebar component
import { useLogo } from '../../hooks/useLogo';

function Sidebar() {
  const { logo, name } = useLogo();

  return (
    <div className="sidebar">
      <div className="logo-area flex items-center gap-2 p-4">
        {logo
          ? <img src={logo} alt="Logo" className="h-8 w-8 object-contain" />
          : <span className="text-xl">🥛</span>   // default icon
        }
        <span className="font-bold text-lg">{name}</span>
      </div>
      {/* rest of sidebar */}
    </div>
  );
}
        
        <div className="flex items-center gap-3 h-16 px-4 border-b border-border">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center flex-shrink-0">
            <Droplets className="w-5 h-5 text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }} className="overflow-hidden"
              >
                <p className="font-bold text-sm text-slate-100 whitespace-nowrap">Dairy ERP</p>
                <p className="text-xs text-muted">Admin Panel</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to} to={to}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-150 group
                ${isActive
                  ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
                  : 'text-slate-400 hover:bg-slate-700/40 hover:text-slate-200'
                }
              `}
            >
              <Icon className="w-4.5 h-4.5 flex-shrink-0" size={18} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="whitespace-nowrap overflow-hidden"
                  >{label}</motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          ))}
        </nav>

        {/* User + logout */}
        <div className="border-t border-border p-3 space-y-2">
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="px-2 py-1"
              >
                <p className="text-sm font-semibold text-slate-200 truncate">{user?.name}</p>
                <p className="text-xs text-muted truncate">{user?.email}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <button onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium
                       text-red-400 hover:bg-red-500/10 transition-colors">
            <LogOut size={18} className="flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>

        {/* Collapse toggle (desktop) */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 bg-card border border-border
                     rounded-full items-center justify-center text-muted hover:text-slate-300
                     transition-colors z-10"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </motion.aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center h-14 px-4 border-b border-border bg-card">
          <button onClick={() => setMobileOpen(o => !o)} className="text-muted">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2 ml-3">
            <Droplets className="w-5 h-5 text-brand-400" />
            <span className="font-bold text-sm">Dairy ERP</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
