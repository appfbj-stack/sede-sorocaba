import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '../../services/api';

export default function Configuracoes() {
  const { data } = useQuery({
    queryKey: ['configuracoes'],
    queryFn: () => api.get('/admin/configuracoes').then((r) => r.data),
  });

  const [nomeExibicaoEditado, setNomeExibicaoEditado] = useState(null);
  const nomeExibicao = nomeExibicaoEditado ?? data?.configuracoes?.nome_exibicao ?? '';
  const [salvo, setSalvo] = useState(false);

  const salvar = useMutation({
    mutationFn: () => api.put('/admin/configuracoes', { configuracoes: { ...data?.configuracoes, nome_exibicao: nomeExibicao } }),
    onSuccess: () => setSalvo(true),
  });

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>

      <form onSubmit={(e) => { e.preventDefault(); salvar.mutate(); }} className="bg-white rounded-xl border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
          <input disabled value={data?.nome ?? ''} className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome de exibição</label>
          <input value={nomeExibicao} onChange={(e) => setNomeExibicaoEditado(e.target.value)}
                 className="w-full border border-gray-300 rounded-lg px-3 py-2" />
        </div>
        {salvo && <p className="text-sm text-green-700">Configurações salvas.</p>}
        <button type="submit" className="bg-blue-900 text-white rounded-lg px-4 py-2">Salvar</button>
      </form>
    </div>
  );
}
