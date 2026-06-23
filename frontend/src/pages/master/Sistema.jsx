import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';

export default function Sistema() {
  const { data } = useQuery({
    queryKey: ['master-sistema'],
    queryFn: () => api.get('/master/sistema').then((r) => r.data),
  });

  if (!data) return null;

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Sistema</h1>

      <div className="bg-white rounded-xl border p-6 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-gray-500">Aplicativo</span><span className="font-medium">{data.app_name}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Slug</span><span className="font-medium">{data.app_slug}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Empresa</span><span className="font-medium">{data.tenant.nome}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Empresa ativa</span><span className="font-medium">{data.tenant.ativo ? 'Sim' : 'Não'}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Total de usuários</span><span className="font-medium">{data.total_usuarios}</span></div>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-gray-800 mb-3">Usuários por perfil</h2>
        <div className="space-y-2 text-sm">
          {Object.entries(data.usuarios_por_perfil || {}).map(([perfil, total]) => (
            <div key={perfil} className="flex justify-between">
              <span className="text-gray-500 capitalize">{perfil}</span>
              <span className="font-medium">{total}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
