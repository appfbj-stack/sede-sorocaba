import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { useAuthStore } from '../../stores/auth';
import { formatarData, LICENCA_STATUS } from '../../lib/utils';
import { Users, UserCheck, Building2, AlertTriangle, Calendar, Gift, TrendingUp, ShieldCheck } from 'lucide-react';

function StatCard({ titulo, valor, icone: Icon, cor = 'blue', sublabel }) {
  const cores = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
  };
  return (
    <div className={`rounded-xl border p-4 ${cores[cor]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium opacity-80">{titulo}</span>
        <Icon size={20} className="opacity-60" />
      </div>
      <p className="text-3xl font-bold">{valor ?? '—'}</p>
      {sublabel && <p className="text-xs opacity-70 mt-1">{sublabel}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { usuario, isAdmin } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then(r => r.data),
    refetchInterval: 60000,
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
        <h1 className="text-2xl font-bold text-gray-900">
          Olá, {usuario?.nome?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {isAdmin() ? 'Visão geral de todas as congregações' : 'Visão da sua congregação'} • {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
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

      {data?.lista_aniversariantes_hoje?.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Gift size={18} className="text-yellow-600" />
            <h2 className="font-semibold text-yellow-800">🎂 Aniversariantes hoje ({data.aniversariantes_hoje})</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.lista_aniversariantes_hoje.map(m => (
              <div key={m.id} className="flex items-center gap-2 bg-white border border-yellow-200 rounded-lg px-3 py-1.5">
                {m.foto_url
                  ? <img src={m.foto_url} alt={m.nome} className="w-6 h-6 rounded-full object-cover" />
                  : <div className="w-6 h-6 rounded-full bg-yellow-300 flex items-center justify-center text-xs font-bold text-yellow-800">{m.nome[0]}</div>
                }
                <span className="text-sm font-medium text-gray-700">{m.nome}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isAdmin() && <StatCard titulo="Congregações" valor={data?.congregacoes} icone={Building2} cor="blue" />}
        <StatCard titulo="Total Membros" valor={data?.total_membros} icone={Users} cor="blue" />
        <StatCard titulo="Membros Ativos" valor={data?.membros_ativos} icone={Users} cor="green" />
        <StatCard titulo="Membros Inativos" valor={data?.membros_inativos} icone={Users} cor="gray" />
        <StatCard titulo="Batizados" valor={data?.batizados} icone={UserCheck} cor="green" />
        <StatCard titulo="Não Batizados" valor={data?.nao_batizados} icone={Users} cor="yellow" sublabel="membros ativos" />
        <StatCard titulo="Obreiros Ativos" valor={data?.total_obreiros} icone={UserCheck} cor="blue" />
        <StatCard titulo="Credenciais Vencidas" valor={data?.credenciais_vencidas} icone={AlertTriangle} cor={data?.credenciais_vencidas > 0 ? 'red' : 'green'} />
        <StatCard titulo="Carteirinhas Vencidas" valor={data?.carteirinhas_vencidas} icone={AlertTriangle} cor={data?.carteirinhas_vencidas > 0 ? 'yellow' : 'green'} />
        <StatCard titulo="Patrimônio" valor={data?.total_patrimonio} icone={Building2} cor="blue" sublabel="itens cadastrados" />
        <StatCard titulo="Eventos (30 dias)" valor={data?.eventos_proximos} icone={Calendar} cor="blue" />
        <StatCard titulo="Aniversariantes/mês" valor={data?.aniversariantes_mes} icone={Gift} cor="yellow" />
      </div>

      {data?.crescimento?.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-blue-600" />
            <h2 className="font-semibold text-gray-800">Novos membros (últimos 6 meses)</h2>
          </div>
          <div className="flex items-end gap-2 h-32">
            {data.crescimento.map((m, i) => {
              const max = Math.max(...data.crescimento.map(x => x.total));
              const altura = max > 0 ? (m.total / max) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-bold text-blue-700">{m.total}</span>
                  <div className="w-full bg-blue-100 rounded-t" style={{ height: `${altura}%`, minHeight: 4 }}>
                    <div className="w-full h-full bg-blue-600 rounded-t" />
                  </div>
                  <span className="text-xs text-gray-500">{m.mes?.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
