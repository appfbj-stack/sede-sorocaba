import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { formatarMoeda, CATEGORIAS_PATRIMONIO } from '../../lib/utils';
import { Package, Plus, Edit, Trash2, Upload } from 'lucide-react';

function FormPatrimonio({ item, onFechar }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    codigo: '', categoria: '', descricao: '', valor: '', localizacao: '', ...item,
  });
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(item?.foto_url || null);

  const salvar = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, v); });
      if (foto) fd.append('foto', foto);
      return item?.id ? api.put(`/patrimonio/${item.id}`, fd) : api.post('/patrimonio', fd);
    },
    onSuccess: () => { qc.invalidateQueries(['patrimonio']); onFechar(); },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4">
      <div className="bg-white w-full lg:max-w-lg lg:rounded-2xl max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold">{item ? 'Editar' : 'Novo'} Item</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 border flex items-center justify-center">
              {preview ? <img src={preview} alt="foto" className="w-full h-full object-cover" /> : <Package size={28} className="text-gray-300" />}
            </div>
            <label className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg cursor-pointer text-sm">
              <Upload size={16} /> Foto
              <input type="file" accept="image/*" onChange={e => { setFoto(e.target.files[0]); setPreview(URL.createObjectURL(e.target.files[0])); }} className="hidden" />
            </label>
          </div>
          {[
            { name: 'descricao', label: 'Descrição *' },
            { name: 'codigo', label: 'Código' },
            { name: 'valor', label: 'Valor (R$)', type: 'number' },
            { name: 'localizacao', label: 'Localização' },
          ].map(({ name, label, type = 'text' }) => (
            <div key={name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input type={type} value={form[name] || ''} onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select value={form.categoria || ''} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500">
              <option value="">Selecione...</option>
              {CATEGORIAS_PATRIMONIO.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t sticky bottom-0 bg-white">
          <button onClick={onFechar} className="flex-1 border rounded-lg py-2 text-sm">Cancelar</button>
          <button onClick={() => salvar.mutate()} disabled={salvar.isPending || !form.descricao}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {salvar.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Patrimonio() {
  const [modal, setModal] = useState(null);
  const [categoria, setCategoria] = useState('');
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ['patrimonio', categoria],
    queryFn: () => api.get('/patrimonio', { params: categoria ? { categoria } : {} }).then(r => r.data),
  });

  const deletar = useMutation({
    mutationFn: (id) => api.put(`/patrimonio/${id}`, { ativo: '0' }),
    onSuccess: () => qc.invalidateQueries(['patrimonio']),
  });

  const valorTotal = data.reduce((s, i) => s + (i.valor || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patrimônio</h1>
          <p className="text-gray-500 text-sm">{data.length} itens • Total: {formatarMoeda(valorTotal)}</p>
        </div>
        <button onClick={() => setModal({})} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={16} /> Novo Item
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setCategoria('')} className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${!categoria ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Todos</button>
        {CATEGORIAS_PATRIMONIO.map(c => (
          <button key={c.value} onClick={() => setCategoria(c.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${categoria === c.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            {c.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : data.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><Package size={48} className="mx-auto mb-2 opacity-30" /><p>Nenhum item cadastrado</p></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.map(item => (
            <div key={item.id} className="bg-white rounded-xl border overflow-hidden hover:shadow-md transition-shadow">
              {item.foto_url ? (
                <img src={item.foto_url} alt={item.descricao} className="w-full h-36 object-cover" />
              ) : (
                <div className="w-full h-36 bg-gray-100 flex items-center justify-center"><Package size={32} className="text-gray-300" /></div>
              )}
              <div className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{item.descricao}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {item.categoria && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{CATEGORIAS_PATRIMONIO.find(c => c.value === item.categoria)?.label || item.categoria}</span>}
                      {item.codigo && <span className="text-xs text-gray-400">#{item.codigo}</span>}
                    </div>
                    {item.valor > 0 && <p className="text-sm font-semibold text-green-700 mt-1">{formatarMoeda(item.valor)}</p>}
                    {item.localizacao && <p className="text-xs text-gray-500 mt-0.5">📍 {item.localizacao}</p>}
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button onClick={() => setModal(item)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Edit size={14} /></button>
                    <button onClick={() => { if (confirm('Remover item?')) deletar.mutate(item.id); }} className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && <FormPatrimonio item={modal?.id ? modal : null} onFechar={() => setModal(null)} />}
    </div>
  );
}
