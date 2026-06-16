import { useState, useCallback } from 'react';
import api from '../../services/api';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, XCircle, ArrowRight } from 'lucide-react';

const ETAPAS = ['Upload', 'Mapeamento', 'Confirmação', 'Resultado'];

export default function Importacao() {
  const [etapa, setEtapa] = useState(0);
  const [arquivo, setArquivo] = useState(null);
  const [analise, setAnalise] = useState(null);
  const [mapeamento, setMapeamento] = useState({});
  const [modo, setModo] = useState('ignorar');
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [arrastando, setArrastando] = useState(false);

  const CAMPOS_DESTINO = [
    { value: '', label: '— Ignorar coluna —' },
    { value: 'nome', label: 'Nome' },
    { value: 'cpf', label: 'CPF' },
    { value: 'rg', label: 'RG' },
    { value: 'data_nascimento', label: 'Data de Nascimento' },
    { value: 'telefone', label: 'Telefone' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'endereco', label: 'Endereço' },
    { value: 'estado_civil', label: 'Estado Civil' },
    { value: 'data_conversao', label: 'Data de Conversão' },
    { value: 'data_batismo', label: 'Data de Batismo' },
    { value: 'cargo', label: 'Cargo' },
    { value: 'observacoes', label: 'Observações' },
  ];

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setArrastando(false);
    const file = e.dataTransfer.files[0];
    if (file) setArquivo(file);
  }, []);

  const analisar = async () => {
    if (!arquivo) return;
    setCarregando(true);
    try {
      const fd = new FormData();
      fd.append('arquivo', arquivo);
      const { data } = await api.post('/importacao/analisar', fd);
      setAnalise(data);
      setMapeamento(data.mapeamento_sugerido || {});
      setEtapa(1);
    } catch (err) {
      alert('Erro ao analisar arquivo: ' + (err.response?.data?.erro || err.message));
    } finally {
      setCarregando(false);
    }
  };

  const confirmar = async () => {
    setCarregando(true);
    try {
      const fd = new FormData();
      fd.append('arquivo_temp', analise.arquivo_temp);
      fd.append('mapeamento', JSON.stringify(mapeamento));
      fd.append('modo_duplicado', modo);
      const { data } = await api.post('/importacao/confirmar', fd);
      setResultado(data);
      setEtapa(3);
    } catch (err) {
      alert('Erro na importação: ' + (err.response?.data?.erro || err.message));
    } finally {
      setCarregando(false);
    }
  };

  const reiniciar = () => {
    setEtapa(0); setArquivo(null); setAnalise(null); setMapeamento({}); setResultado(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Importação Inteligente</h1>
        <p className="text-gray-500 text-sm">Importe membros de planilhas XLSX, CSV ou Google Sheets</p>
      </div>

      {/* Progresso */}
      <div className="flex items-center gap-2">
        {ETAPAS.map((e, i) => (
          <div key={e} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i <= etapa ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{i + 1}</div>
            <span className={`text-sm font-medium hidden lg:block ${i <= etapa ? 'text-blue-700' : 'text-gray-400'}`}>{e}</span>
            {i < ETAPAS.length - 1 && <div className={`flex-1 h-0.5 ${i < etapa ? 'bg-blue-600' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* Etapa 0: Upload */}
      {etapa === 0 && (
        <div className="space-y-4">
          <div
            onDragOver={e => { e.preventDefault(); setArrastando(true); }}
            onDragLeave={() => setArrastando(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors ${arrastando ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
          >
            <FileSpreadsheet size={48} className={`mx-auto mb-4 ${arrastando ? 'text-blue-500' : 'text-gray-400'}`} />
            <p className="text-gray-600 font-medium mb-1">Arraste seu arquivo aqui</p>
            <p className="text-gray-400 text-sm mb-4">ou clique para selecionar</p>
            <label className="bg-blue-600 text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-blue-700 text-sm font-medium inline-flex items-center gap-2">
              <Upload size={16} /> Selecionar arquivo
              <input type="file" accept=".xlsx,.xls,.csv" onChange={e => setArquivo(e.target.files[0])} className="hidden" />
            </label>
            <p className="text-xs text-gray-400 mt-3">Formatos: XLSX, XLS, CSV • Máx: 50MB</p>
          </div>

          {arquivo && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle size={20} className="text-green-600" />
              <div className="flex-1">
                <p className="font-medium text-green-800">{arquivo.name}</p>
                <p className="text-sm text-green-600">{(arquivo.size / 1024).toFixed(0)} KB</p>
              </div>
              <button onClick={analisar} disabled={carregando}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                {carregando ? 'Analisando...' : <><ArrowRight size={16} /> Analisar</>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Etapa 1: Mapeamento */}
      {etapa === 1 && analise && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-blue-800 font-medium">Arquivo analisado: {analise.total_linhas} registros encontrados</p>
            <p className="text-blue-600 text-sm mt-1">Ajuste o mapeamento das colunas conforme necessário</p>
          </div>

          <div className="bg-white rounded-xl border p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Mapeamento de Colunas</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {analise.headers.map(h => (
                <div key={h} className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 w-36 truncate" title={h}>{h}</span>
                  <ArrowRight size={14} className="text-gray-400 flex-shrink-0" />
                  <select value={mapeamento[h] || ''} onChange={e => setMapeamento(m => ({ ...m, [h]: e.target.value }))}
                    className="flex-1 border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-500">
                    {CAMPOS_DESTINO.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {analise.previa?.length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <h3 className="font-semibold text-gray-800 p-4 border-b">Prévia (primeiros 5 registros)</h3>
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead className="bg-gray-50">
                    <tr>{analise.headers.map(h => <th key={h} className="px-3 py-2 text-left text-gray-600">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y">
                    {analise.previa.map((r, i) => (
                      <tr key={i}>{analise.headers.map(h => <td key={h} className="px-3 py-2 text-gray-700">{r[h] || '—'}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setEtapa(0)} className="border rounded-lg px-4 py-2 text-sm">Voltar</button>
            <button onClick={() => setEtapa(2)} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
              Próximo <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Etapa 2: Confirmação */}
      {etapa === 2 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <h3 className="font-semibold text-gray-800">Configurações de Importação</h3>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Ao encontrar duplicado:</label>
              {[
                { value: 'ignorar', label: 'Ignorar (manter registro existente)' },
                { value: 'atualizar', label: 'Atualizar (sobrescrever com dados do arquivo)' },
              ].map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input type="radio" value={value} checked={modo === value} onChange={e => setModo(e.target.value)} />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
              <strong>Resumo:</strong> {analise?.total_linhas} registros serão processados. Campos mapeados: {Object.values(mapeamento).filter(Boolean).length}.
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setEtapa(1)} className="border rounded-lg px-4 py-2 text-sm">Voltar</button>
            <button onClick={confirmar} disabled={carregando}
              className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {carregando ? 'Importando...' : `Importar ${analise?.total_linhas} registros`}
            </button>
          </div>
        </div>
      )}

      {/* Etapa 3: Resultado */}
      {etapa === 3 && resultado && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold text-gray-800 mb-4 text-lg">Relatório de Importação</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <CheckCircle size={24} className="text-green-600 mx-auto mb-2" />
                <p className="text-3xl font-bold text-green-700">{resultado.importados}</p>
                <p className="text-sm text-green-600">Importados</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                <CheckCircle size={24} className="text-blue-600 mx-auto mb-2" />
                <p className="text-3xl font-bold text-blue-700">{resultado.atualizados}</p>
                <p className="text-sm text-blue-600">Atualizados</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                <AlertCircle size={24} className="text-yellow-600 mx-auto mb-2" />
                <p className="text-3xl font-bold text-yellow-700">{resultado.duplicados}</p>
                <p className="text-sm text-yellow-600">Duplicados</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <XCircle size={24} className="text-red-600 mx-auto mb-2" />
                <p className="text-3xl font-bold text-red-700">{resultado.rejeitados}</p>
                <p className="text-sm text-red-600">Rejeitados</p>
              </div>
            </div>

            {resultado.erros?.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-600 mb-2">Erros detalhados:</h4>
                <div className="bg-red-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                  {resultado.erros.map((e, i) => (
                    <p key={i} className="text-xs text-red-700">Linha {e.linha}: {e.erro}</p>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button onClick={reiniciar} className="bg-blue-600 text-white rounded-lg px-6 py-2 text-sm font-medium hover:bg-blue-700">
            Nova Importação
          </button>
        </div>
      )}
    </div>
  );
}
