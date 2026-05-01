import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, Milk, FileText, TrendingUp,
  Truck, Store, UserCheck, Receipt, BarChart3, Shield,
  LogOut, ChevronLeft, ChevronRight, Menu, Settings,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import api from '../../api/client';
import toast from 'react-hot-toast';

const NAV = [
  { to: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: 'farmers',   icon: Users,           label: 'Collection Centre' },
  { to: 'milk',      icon: Milk,            label: 'Milk Collection' },
  { to: 'billing',   icon: FileText,        label: 'Billing' },
  { to: 'customers', icon: UserCheck,        label: 'Customers' },
  { to: 'sales',     icon: TrendingUp,      label: 'Sales' },
  { to: 'vehicles',  icon: Truck,           label: 'Vehicles' },
  { to: 'shops',     icon: Store,           label: 'Shops' },
  { to: 'hr',        icon: UserCheck,       label: 'HR & Payroll' },
  { to: 'expenses',  icon: Receipt,         label: 'Expenses' },
  { to: 'reports',   icon: BarChart3,       label: 'Reports' },
  { to: 'audit',     icon: Shield,          label: 'Audit Logs' },
  { to: 'settings',  icon: Settings,        label: 'Settings' },
];

export default function AdminLayout() {
  const [collapsed, setCollapsed]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoUrl, setLogoUrl]       = useState('');
  const [appName, setAppName]       = useState('Brimi Dairy');
  const { user, logout }            = useAuthStore();
  const navigate                    = useNavigate();

  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      if (data.settings?.logo_url)  setLogoUrl(data.settings.logo_url);
      if (data.settings?.app_name)  setAppName(data.settings.app_name);
    }).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f0f4f8' }}>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-20 bg-black/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 68 : 240 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`
          relative z-30 flex flex-col flex-shrink-0
          border-r border-[#d1dce8] bg-white shadow-sm
          lg:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          fixed lg:static inset-y-0 left-0 transition-transform
        `}
      >
        {/* Logo area */}
        <div className="flex items-center gap-3 h-16 px-4 border-b border-[#d1dce8]">
          {logoUrl
            ? <img src={logoUrl} alt="Logo" className="w-9 h-9 object-contain rounded-lg flex-shrink-0" />
            : <div className="w-9 h-9 rounded-xl bg-[#1d6faa] flex items-center justify-center flex-shrink-0">
                <Milk className="w-5 h-5 text-white" />
              </div>
          }
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }} className="overflow-hidden"
              >
                <p className="font-bold text-sm text-slate-800 whitespace-nowrap">{appName}</p>
                <p className="text-xs text-slate-500">Admin Panel</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to} to={to}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-150
                ${isActive
                  ? 'bg-[#1d6faa] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-blue-50 hover:text-[#1d6faa]'
                }
              `}
            >
              <Icon className="flex-shrink-0" size={18} />
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
        <div className="border-t border-[#d1dce8] p-3 space-y-1">
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="px-2 py-1"
              >
                <p className="text-sm font-semibold text-slate-700 truncate">{user?.name}</p>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <button onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium
                       text-red-500 hover:bg-red-50 transition-colors">
            <LogOut size={18} className="flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>

        {/* Footer */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="px-4 py-3 border-t border-[#d1dce8]"
            >
              <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                Developed by <span className="font-semibold text-[#1d6faa]">Quantum Solution Group</span><br />
                © 2025 All rights reserved
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 bg-white border border-[#d1dce8]
                     rounded-full items-center justify-center text-slate-400 hover:text-[#1d6faa]
                     transition-colors z-10 shadow-sm"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </motion.aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center h-14 px-4 border-b border-[#d1dce8] bg-white shadow-sm">
          <button onClick={() => setMobileOpen(o => !o)} className="text-slate-500">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2 ml-3">
            {logoUrl
              ? <img src={logoUrl} alt="Logo" className="h-7 w-7 object-contain rounded" />
              : <Milk className="w-5 h-5 text-[#1d6faa]" />
            }
            <span className="font-bold text-sm text-slate-800">{appName}</span>
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
