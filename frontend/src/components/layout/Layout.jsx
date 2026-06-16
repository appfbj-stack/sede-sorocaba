import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard, Users, UserCheck, Building2, Package,
  FileText, Calendar, Upload, Bot, LogOut,
  Menu, X, CreditCard, Droplets, Settings
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/membros', label: 'Membros', icon: Users },
  { href: '/obreiros', label: 'Obreiros', icon: UserCheck },
  { href: '/carteirinhas', label: 'Carteirinhas', icon: CreditCard },
  { href: '/congregacoes', label: 'Congregações', icon: Building2, somentesSede: true },
  { href: '/patrimonio', label: 'Patrimônio', icon: Package },
  { href: '/documentos', label: 'Documentos', icon: FileText },
  { href: '/agenda', label: 'Agenda', icon: Calendar },
  { href: '/batismos', label: 'Batismos', icon: Droplets },
  { href: '/importacao', label: 'Importação', icon: Upload, somentesSede: true },
  { href: '/ia', label: 'Assistente IA', icon: Bot },
  { href: '/configuracoes', label: 'Configurações', icon: Settings, somentesSede: true },
];

export default function Layout({ children }) {
  const [sidebarAberta, setSidebarAberta] = useState(false);
  const { usuario, logout, isSede } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const itens = NAV_ITEMS.filter(i => !i.somentesSede || isSede());

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Overlay mobile */}
      {sidebarAberta && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarAberta(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed top-0 left-0 h-full w-64 bg-blue-900 text-white z-30 flex flex-col transition-transform duration-300',
        sidebarAberta ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className="p-6 border-b border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">⛪ Kairos</h1>
              <p className="text-xs text-blue-300 mt-0.5">OBPC Sorocaba Sede</p>
            </div>
            <button className="lg:hidden text-white" onClick={() => setSidebarAberta(false)}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Navegação */}
        <nav className="flex-1 overflow-y-auto py-4">
          {itens.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              to={href}
              onClick={() => setSidebarAberta(false)}
              className={cn(
                'flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors',
                location.pathname.startsWith(href)
                  ? 'bg-blue-700 text-white border-r-2 border-yellow-400'
                  : 'text-blue-200 hover:bg-blue-800 hover:text-white'
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>

        {/* Usuário */}
        <div className="p-4 border-t border-blue-800">
          <div className="flex items-center gap-3 mb-3">
            {usuario?.foto_url
              ? <img src={usuario.foto_url} alt={usuario.nome} className="w-8 h-8 rounded-full" />
              : <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">{usuario?.nome?.[0]}</div>
            }
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{usuario?.nome}</p>
              <p className="text-xs text-blue-300 capitalize">{usuario?.perfil}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-blue-300 hover:text-white text-sm w-full">
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Header mobile */}
        <header className="lg:hidden bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <button onClick={() => setSidebarAberta(true)} className="text-gray-600">
            <Menu size={24} />
          </button>
          <h1 className="font-bold text-blue-900">⛪ Kairos</h1>
          <div className="w-8" />
        </header>

        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
