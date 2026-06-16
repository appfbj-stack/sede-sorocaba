import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { formatarData } from '../../lib/utils';
import { FileText, Plus, Trash2, Download, Search, FolderOpen } from 'lucide-react';

function FormDocumento({ onFechar }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ nome: '', tipo: '', pasta: 'Geral' });
  const [arquivo, setArquivo] = useState(null);

  const salvar = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      if (arquivo) fd.append('arquivo', arquivo);
      return api.post('/documentos', fd);
    },
    onSuccess: () => { qc.invalidateQueries(['documentos']); onFechar(); },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4">
      <div className="bg-white w-full lg:max-w-md lg:rounded-2xl max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold">Novo Documento</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="Ex: Ata Reunião Janeiro 2025" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pasta</label>
            <input value={form.pasta} onChange={e => setForm(f => ({ ...f, pasta: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="Ex: Atas, Financeiro, Membros..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Arquivo</label>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <FileText size={24} className="text-gray-400" />
              <span className="text-sm text-gray-500">{arquivo ? arquivo.name : 'Clique para selecionar'}</span>
              <input type="file" onChange={e => { setArquivo(e.target.files[0]); if (!form.nome) setForm(f => ({ ...f, nome: e.target.files[0].name })); }} className="hidden" />
            </label>
          </div>
          <p className="text-xs text-blue-600">📁 O arquivo será salvo no Google Drive da sede</p>
        </div>
        <div className="flex gap-2 p-4 border-t sticky bottom-0 bg-white">
          <button onClick={onFechar} className="flex-1 border rounded-lg py-2 text-sm">Cancelar</button>
          <button onClick={() => salvar.mutate()} disabled={salvar.isPending || !form.nome}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {salvar.isPending ? 'Enviando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Documentos() {
  const [modal, setModal] = useState(false);
  const [busca, setBusca] = useState('');
  const [pasta, setPasta] = useState('');
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ['documentos'],
    queryFn: () => api.get('/documentos').then(r => r.data),
  });

  const deletar = useMutation({
    mutationFn: (id) => api.delete(`/documentos/${id}`),
    onSuccess: () => qc.invalidateQueries(['documentos']),
  });

  const pastas = [...new Set(data.map(d => d.pasta).filter(Boolean))];
  const filtrados = data.filter(d => {
    const matchBusca = !busca || d.nome.toLowerCase().includes(busca.toLowerCase());
    const matchPasta = !pasta || d.pasta === pasta;
    return matchBusca && matchPasta;
  });

  const icone = (nome) => {
    const ext = nome?.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext)) return '📄';
    if (['doc', 'docx'].includes(ext)) return '📝';
    if (['xls', 'xlsx'].includes(ext)) return '📊';
    if (['jpg', 'jpeg', 'png'].includes(ext)) return '🖼️';
    return '📁';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documentos</h1>
          <p className="text-gray-500 text-sm">{data.length} documentos</p>
        </div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={16} /> Novo
        </button>
      </div>

      <div className="flex gap-2">
        <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 flex-1">
          <Search size={16} className="text-gray-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar documentos..."
            className="flex-1 outline-none text-sm" />
        </div>
        {pastas.length > 0 && (
          <select value={pasta} onChange={e => setPasta(e.target.value)}
            className="bg-white border rounded-lg px-3 py-2 text-sm outline-none">
            <option value="">Todas as pastas</option>
            {pastas.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><FolderOpen size={48} className="mx-auto mb-2 opacity-30" /><p>Nenhum documento encontrado</p></div>
      ) : (
        <div className="bg-white rounded-xl border divide-y">
          {filtrados.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 p-3 hover:bg-gray-50">
              <span className="text-2xl">{icone(doc.nome)}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{doc.nome}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                  {doc.pasta && <span className="bg-gray-100 px-2 py-0.5 rounded-full">{doc.pasta}</span>}
                  <span>{formatarData(doc.criado_em)}</span>
                </div>
              </div>
              <div className="flex gap-1">
                {doc.drive_url && (
                  <a href={doc.drive_url} target="_blank" rel="noreferrer" className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                    <Download size={15} />
                  </a>
                )}
                <button onClick={() => { if (confirm('Remover documento?')) deletar.mutate(doc.id); }} className="p-1.5 text-gray-400 hover:text-red-600 rounded">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <FormDocumento onFechar={() => setModal(false)} />}
    </div>
  );
}
