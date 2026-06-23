import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { formatarData, LICENCA_STATUS } from '../../lib/utils';

const STATUS_OPCOES = ['teste', 'ativo', 'suspenso', 'expirado'];

export default function Licenca() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['master-licenca'],
    queryFn: () => api.get('/master/licenca').then((r) => r.data),
  });

  const [plano, setPlano] = useState('');
  const [status, setStatus] = useState('');

  const atualizar = useMutation({
    mutationFn: (payload) => api.put('/master/licenca', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['master-licenca'] }),
  });

  const iniciarTeste = useMutation({
    mutationFn: (dias) => api.post('/master/licenca/iniciar-teste', { dias }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['master-licenca'] }),
  });

  if (!data) return null;
  const statusInfo = LICENCA_STATUS[data.status];

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Licença</h1>

      <div className="bg-white rounded-xl border p-6 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Status atual</span>
          <span className={`text-xs font-medium px-3 py-1 rounded-full ${statusInfo?.color}`}>{statusInfo?.label}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Plano</span>
          <span className="font-medium">{data.plano}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Válida até</span>
          <span className="font-medium">{formatarData(data.data_validade)}</span>
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); atualizar.mutate({ plano: plano || undefined, status: status || undefined }); }}
        className="bg-white rounded-xl border p-6 space-y-4"
      >
        <h2 className="font-semibold text-gray-800">Alterar licença</h2>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Novo plano" value={plano} onChange={(e) => setPlano(e.target.value)}
                 className="border rounded-lg px-3 py-2" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded-lg px-3 py-2">
            <option value="">Manter status</option>
            {STATUS_OPCOES.map((s) => <option key={s} value={s}>{LICENCA_STATUS[s].label}</option>)}
          </select>
        </div>
        <button type="submit" className="bg-blue-900 text-white rounded-lg px-4 py-2">Salvar</button>
      </form>

      <button
        onClick={() => iniciarTeste.mutate(14)}
        className="text-sm text-blue-700 hover:underline"
      >
        Reiniciar período de teste (14 dias)
      </button>
    </div>
  );
}
