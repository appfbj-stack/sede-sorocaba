import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { useAuthStore } from '../../stores/auth';
import { formatarData, LICENCA_STATUS } from '../../lib/utils';
import { Users, UserCheck, ShieldCheck } from 'lucide-react';

function StatCard({ titulo, valor, icone: Icon, cor = 'blue' }) {
  const cores = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  };
  return (
    <div className={`rounded-xl border p-4 ${cores[cor]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium opacity-80">{titulo}</span>
        <Icon size={20} className="opacity-60" />
      </div>
      <p className="text-3xl font-bold">{valor ?? '—'}</p>
    </div>
  );
}

export default function Dashboard() {
  const { usuario } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then((r) => r.data),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const licenca = data?.licenca;
  const statusInfo = licenca ? LICENCA_STATUS[licenca.status] : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Olá, {usuario?.nome?.split(' ')[0]} 👋</h1>
        <p className="text-gray-500 text-sm mt-1">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {licenca && (
        <div className="bg-white rounded-xl border p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck size={22} className="text-blue-700" />
            <div>
              <p className="font-semibold text-gray-800">Plano {licenca.plano}</p>
              <p className="text-xs text-gray-500">Válida até {formatarData(licenca.data_validade)}</p>
            </div>
          </div>
          <span className={`text-xs font-medium px-3 py-1 rounded-full ${statusInfo?.color}`}>
            {statusInfo?.label}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard titulo="Usuários" valor={data?.total_usuarios} icone={Users} cor="blue" />
        <StatCard titulo="Usuários ativos" valor={data?.usuarios_ativos} icone={UserCheck} cor="green" />
      </div>
    </div>
  );
}
