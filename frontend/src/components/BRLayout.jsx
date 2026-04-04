import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Users,
  MessageSquare,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Upload,
  BarChart2,
  TrendingUp,
} from 'lucide-react';

const BR_NAV = [
  { to: '/br', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/br/properties', icon: Building2, label: 'Propiedades' },
  { to: '/br/properties/new', icon: Upload, label: 'Agregar Inmueble' },
  { to: '/br/leads', icon: Users, label: 'Leads' },
  { to: '/br/messages', icon: MessageSquare, label: 'Mensajes' },
  { to: '/br/documents', icon: FileText, label: 'Documentos' },
  { to: '/br/analytics', icon: BarChart2, label: 'Analíticas' },
  { to: '/br/settings', icon: Settings, label: 'Configuración' },
];

function BRSidebarLink({ to, icon: Icon, label, onClick, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-emerald-50 text-emerald-700 shadow-sm'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`
      }
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="flex-1">{label}</span>
    </NavLink>
  );
}

export default function BRLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = () => {
    signOut();
    navigate('/bre');
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* BR Logo */}
      <div className="flex items-center justify-center gap-2.5 border-b border-gray-200 px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-black text-white shadow-lg shadow-emerald-500/25">
          BR
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-gray-900 tracking-tight">Clienta</span>
          <span className="text-[10px] font-semibold text-emerald-600 -mt-0.5 tracking-wider">BIENES RAÍCES</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {BR_NAV.map((item) => (
          <BRSidebarLink
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            end={item.end}
            onClick={() => setMobileOpen(false)}
          />
        ))}
      </nav>

      <div className="border-t border-gray-200 px-3 py-4">
        {user && (
          <div className="mb-3 truncate px-3 text-xs text-gray-500">{user.email}</div>
        )}
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          Cerrar Sesión
        </button>
        <a
          href="https://aws.amazon.com/what-is-cloud-computing"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center px-3 py-2 text-gray-400 hover:text-gray-500"
        >
          <img src="https://d0.awsstatic.com/logos/powered-by-aws.png" alt="Powered by AWS" className="h-6" />
        </a>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-gray-200 bg-white lg:block">
        {sidebar}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="fixed inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="relative z-50 w-64 bg-white shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1 text-gray-500 hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center border-b border-gray-200 bg-white px-4 lg:px-6">
          <button onClick={() => setMobileOpen(true)} className="mr-3 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
            Bienes Raíces
          </span>
        </header>

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
