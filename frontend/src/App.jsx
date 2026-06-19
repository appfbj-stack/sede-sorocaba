import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/auth';
import Layout from './components/layout/Layout';
import Login from './pages/auth/Login';
import Callback from './pages/auth/Callback';
import Dashboard from './pages/dashboard/Dashboard';
import Membros from './pages/membros/Membros';
import Obreiros from './pages/obreiros/Obreiros';
import Congregacoes from './pages/congregacoes/Congregacoes';
import Patrimonio from './pages/patrimonio/Patrimonio';
import Agenda from './pages/agenda/Agenda';
import Carteirinhas from './pages/carteirinhas/Carteirinhas';

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30000, retry: 1 } } });

function RotaProtegida({ children }) {
  const { usuario, token, carregando } = useAuthStore();
  if (carregando) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!token && !usuario) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function SomentesSede({ children }) {
  const { isSede } = useAuthStore();
  if (!isSede()) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  const { carregarUsuario } = useAuthStore();
  useEffect(() => { carregarUsuario(); }, []);

  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<Callback />} />
          <Route path="/acesso-negado" element={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="bg-white rounded-2xl p-8 text-center shadow max-w-md">
                <div className="text-5xl mb-4">🚫</div>
                <h1 className="text-xl font-bold text-gray-900 mb-2">Acesso não permitido</h1>
                <p className="text-gray-500 text-sm mb-4">Seu e-mail não está cadastrado no sistema. Entre em contato com o administrador da sede.</p>
                <a href="/login" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium inline-block hover:bg-blue-700">Voltar ao Login</a>
              </div>
            </div>
          } />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"    element={<RotaProtegida><Dashboard /></RotaProtegida>} />
          <Route path="/membros"      element={<RotaProtegida><Membros /></RotaProtegida>} />
          <Route path="/obreiros"     element={<RotaProtegida><Obreiros /></RotaProtegida>} />
          <Route path="/carteirinhas" element={<RotaProtegida><Carteirinhas /></RotaProtegida>} />
          <Route path="/congregacoes" element={<RotaProtegida><SomentesSede><Congregacoes /></SomentesSede></RotaProtegida>} />
          <Route path="/patrimonio"   element={<RotaProtegida><Patrimonio /></RotaProtegida>} />
          <Route path="/agenda"       element={<RotaProtegida><Agenda /></RotaProtegida>} />
          <Route path="*"             element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
