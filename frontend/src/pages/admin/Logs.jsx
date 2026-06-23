import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { formatarDataHora } from '../../lib/utils';

export default function Logs() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-logs'],
    queryFn: () => api.get('/admin/logs').then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Logs de atividade</h1>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left px-4 py-2">Data</th>
              <th className="text-left px-4 py-2">Ação</th>
              <th className="text-left px-4 py-2">Detalhes</th>
              <th className="text-left px-4 py-2">IP</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="px-4 py-3" colSpan={4}>Carregando...</td></tr>}
            {data?.map((log) => (
              <tr key={log.id} className="border-t">
                <td className="px-4 py-2 whitespace-nowrap">{formatarDataHora(log.criado_em)}</td>
                <td className="px-4 py-2 font-medium">{log.acao}</td>
                <td className="px-4 py-2 text-gray-500">{log.detalhes ?? '—'}</td>
                <td className="px-4 py-2 text-gray-400">{log.ip ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
