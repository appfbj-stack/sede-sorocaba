import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, RotateCcw, ArrowRight, ArrowLeft, Loader2, X } from 'lucide-react';
import api from '../../services/api';
import { analisarArquivo, obterPreview, executarImportacao, obterHistorico, desfazerImportacao } from '../../services/importacao';

const ETAPAS = ['Upload', 'Mapeamento', 'Preview', 'Executar', 'Relatorio'];
const CAMPOS_KAIROS = ['nome','cpf','rg','data_nascimento','telefone','whatsapp','endereco','estado_civil','data_conversao','data_batismo','cargo','status','observacoes','email'];

export default function Importacao() {
  const [etapa, setEtapa] = useState(0);
  const [arquivo, setArquivo] = useState(null);
  const [congregacaoId, setCongregacaoId] = useState('');
  const [sessaoId, setSessaoId] = useState('');
  const [mapeamento, setMapeamento] = useState({});
  const [amostra, setAmostra] = useState([]);
  const [colunas, setColunas] = useState([]);
  const [preview, setPreview] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [decisoesDuplicados, setDecisoesDuplicados] = useState({});
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [arrastar, setArrastar] = useState(false);
  const inputRef = useRef();

  const { data: congregacoes = [] } = useQuery({
    queryKey: ['congregacoes'],
    queryFn: async () => { const { data } = await api.get('/congregacoes'); return data; },
  });
  const { data: historico = [], refetch: refetchHistorico } = useQuery({
    queryKey: ['importacao-historico'],
    queryFn: obterHistorico,
  });

  const handleArquivo = (file) => {
    if (!file) return;
    const ext = file.name.toLowerCase().split('.').pop();
    if (!['csv','xlsx','xls','pdf'].includes(ext)) {
      setErro('Formato nao suportado. Use CSV, Excel (.xlsx) ou PDF.'); return;
    }
    setArquivo(file); setErro('');
  };

  const handleAnalisar = async () => {
    if (!arquivo || !congregacaoId) { setErro('Selecione o arquivo e a congregacao.'); return; }
    setCarregando(true); setErro('');
    try {
      const dados = await analisarArquivo(arquivo, congregacaoId);
      setSessaoId(dados.sessao_id);
      setMapeamento(dados.mapeamento_sugerido);
      setColunas(dados.colunas);
      setAmostra(dados.amostra);
      setEtapa(1);
    } catch (e) {
      setErro(e.response?.data?.detail || 'Erro ao analisar arquivo.');
    } finally { setCarregando(false); }
  };

  const handlePreview = async () => {
    setCarregando(true); setErro('');
    try {
      const dados = await obterPreview({ sessaoId, mapeamento, congregacaoId });
      setPreview(dados); setEtapa(2);
    } catch (e) {
      setErro(e.response?.data?.detail || 'Erro ao gerar preview.');
    } finally { setCarregando(false); }
  };

  const handleExecutar = async () => {
    setCarregando(true); setErro('');
    try {
      const dados = await executarImportacao({ sessaoId, mapeamento, congregacaoId, decisoesDuplicados });
      setResultado(dados); setEtapa(4); refetchHistorico();
    } catch (e) {
      setErro(e.response?.data?.detail || 'Erro ao executar importacao.');
    } finally { setCarregando(false); }
  };

  const handleDesfazer = async (id) => {
    if (!window.confirm('Tem certeza? Todos os membros desta importacao serao removidos.')) return;
    try {
      await desfazerImportacao(id);
      refetchHistorico();
      alert('Importacao desfeita com sucesso!');
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao desfazer.');
    }
  };

  const reiniciar = () => {
    setEtapa(0); setArquivo(null); setSessaoId(''); setMapeamento({});
    setAmostra([]); setColunas([]); setPreview(null); setResultado(null);
    setDecisoesDuplicados({}); setErro('');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Importacao de Membros</h1>
        <p className="text-gray-500 text-sm mt-1">Importe membros de planilhas, CSV ou PDF de outros sistemas</p>
      </div>

      {/* Barra de progresso */}
      <div className="flex items-center mb-8 overflow-x-auto">
        {ETAPAS.map((e, i) => (
          <div key={i} className="flex items-center flex-shrink-0">
            <div className={"w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors " + (i < etapa ? 'bg-green-500 text-white' : i === etapa ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500')}>
              {i < etapa ? <CheckCircle size={16} /> : i + 1}
            </div>
            <span className={"text-xs ml-1 mr-2 " + (i === etapa ? 'text-blue-600 font-medium' : 'text-gray-400')}>{e}</span>
            {i < ETAPAS.length - 1 && <div className={"h-0.5 w-6 mr-2 " + (i < etapa ? 'bg-green-400' : 'bg-gray-200')} />}
          </div>
        ))}
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{erro}</p>
          <button onClick={() => setErro('')} className="ml-auto text-red-400 hover:text-red-600"><X size={14} /></button>
        </div>
      )}

      {/* ETAPA 0 - Upload */}
      {etapa === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">1. Selecione o arquivo e a congregacao</h2>
          <div
            onDragOver={(e) => { e.preventDefault(); setArrastar(true); }}
            onDragLeave={() => setArrastar(false)}
            onDrop={(e) => { e.preventDefault(); setArrastar(false); handleArquivo(e.dataTransfer.files[0]); }}
            onClick={() => inputRef.current?.click()}
            className={"border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors mb-4 " + (arrastar ? 'border-blue-400 bg-blue-50' : arquivo ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50')}
          >
            <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls,.pdf" className="hidden" onChange={(e) => handleArquivo(e.target.files[0])} />
            {arquivo ? (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet size={32} className="text-green-500" />
                <p className="font-medium text-green-700">{arquivo.name}</p>
                <p className="text-xs text-gray-500">{(arquivo.size / 1024).toFixed(0)} KB</p>
                <button onClick={(e) => { e.stopPropagation(); setArquivo(null); }} className="text-xs text-red-500 hover:text-red-700">Remover</button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload size={32} className="text-gray-400" />
                <p className="font-medium text-gray-600">Arraste o arquivo aqui ou clique para selecionar</p>
                <p className="text-xs text-gray-400">CSV, Excel (.xlsx, .xls) ou PDF com tabelas — max 20MB</p>
              </div>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Congregacao destino</label>
            <select value={congregacaoId} onChange={(e) => setCongregacaoId(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Selecione a congregacao...</option>
              {congregacoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          <button onClick={handleAnalisar} disabled={!arquivo || !congregacaoId || carregando} className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
            {carregando ? <><Loader2 size={16} className="animate-spin" /> Analisando arquivo...</> : <><ArrowRight size={16} /> Analisar arquivo</>}
          </button>

          {/* Historico */}
          {historico.length > 0 && (
            <div className="mt-8">
              <h3 className="font-medium text-gray-700 mb-3">Historico de importacoes</h3>
              <div className="space-y-2">
                {historico.slice(0, 5).map((h) => (
                  <div key={h.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{h.nome_arquivo}</p>
                      <p className="text-xs text-gray-500">{h.importados} importados, {h.duplicados} duplicados, {h.com_erro} erros</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={"text-xs px-2 py-1 rounded-full " + (h.status === 'concluido' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700')}>{h.status}</span>
                      {h.pode_desfazer && (
                        <button onClick={() => handleDesfazer(h.id)} className="text-red-500 hover:text-red-700" title="Desfazer importacao">
                          <RotateCcw size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ETAPA 1 - Mapeamento */}
      {etapa === 1 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-2">2. Confirme o mapeamento de campos</h2>
          <p className="text-sm text-gray-500 mb-4">A IA identificou automaticamente os campos. Ajuste se necessario.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {colunas.map((col) => (
              <div key={col} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-0.5">Coluna original</p>
                  <p className="text-sm font-medium text-gray-800 truncate">{col}</p>
                  {amostra[0]?.[col] && <p className="text-xs text-gray-400 truncate">Ex: {String(amostra[0][col]).slice(0, 30)}</p>}
                </div>
                <div className="w-36 flex-shrink-0">
                  <p className="text-xs text-gray-500 mb-0.5">Campo Kairos</p>
                  <select
                    value={mapeamento[col] || ''}
                    onChange={(e) => setMapeamento({ ...mapeamento, [col]: e.target.value || null })}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">-- ignorar --</option>
                    {CAMPOS_KAIROS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setEtapa(0)} className="flex items-center gap-1 text-gray-600 border border-gray-200 px-4 py-2 rounded-xl text-sm hover:bg-gray-50"><ArrowLeft size={14} /> Voltar</button>
            <button onClick={handlePreview} disabled={carregando} className="flex-1 bg-blue-600 text-white py-2 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
              {carregando ? <><Loader2 size={16} className="animate-spin" /> Gerando preview...</> : <><ArrowRight size={16} /> Ver preview</>}
            </button>
          </div>
        </div>
      )}

      {/* ETAPA 2 - Preview */}
      {etapa === 2 && preview && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">3. Revisao antes de importar</h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total', valor: preview.total, cor: 'blue' },
              { label: 'Validos', valor: preview.validos, cor: 'green' },
              { label: 'Problemas', valor: preview.com_problema, cor: 'red' },
              { label: 'Duplicados', valor: preview.duplicados, cor: 'yellow' },
            ].map(({ label, valor, cor }) => (
              <div key={label} className={"rounded-xl p-4 text-center bg-" + cor + "-50 border border-" + cor + "-100"}>
                <p className={"text-2xl font-bold text-" + cor + "-700"}>{valor}</p>
                <p className={"text-xs text-" + cor + "-600"}>{label}</p>
              </div>
            ))}
          </div>

          {preview.preview_problemas?.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-red-700 mb-2">Registros com problemas</h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {preview.preview_problemas.map((p, i) => (
                  <div key={i} className="text-xs bg-red-50 rounded-lg px-3 py-2">
                    <span className="font-medium">Linha {p.linha}:</span> {p.dados?.nome || 'Sem nome'} — {p.erros?.join(', ')}
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview.preview_duplicados?.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-yellow-700 mb-2">Possiveis duplicados — escolha a acao</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {preview.preview_duplicados.map((d, i) => (
                  <div key={i} className="text-xs bg-yellow-50 rounded-lg px-3 py-2 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{d.dados?.nome} (linha {d.linha})</p>
                      <p className="text-gray-500">Existente: {d.existente?.nome}</p>
                    </div>
                    <select
                      value={decisoesDuplicados[String(i)] || 'ignorar'}
                      onChange={(e) => setDecisoesDuplicados({ ...decisoesDuplicados, [String(i)]: e.target.value })}
                      className="text-xs border border-yellow-300 rounded-lg px-2 py-1"
                    >
                      <option value="ignorar">Ignorar</option>
                      <option value="atualizar">Atualizar existente</option>
                      <option value="criar">Criar novo</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button onClick={() => setEtapa(1)} className="flex items-center gap-1 text-gray-600 border border-gray-200 px-4 py-2 rounded-xl text-sm hover:bg-gray-50"><ArrowLeft size={14} /> Voltar</button>
            <button onClick={() => setEtapa(3)} disabled={preview.validos === 0} className="flex-1 bg-blue-600 text-white py-2 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
              <ArrowRight size={16} /> Confirmar e importar ({preview.validos} registros)
            </button>
          </div>
        </div>
      )}

      {/* ETAPA 3 - Confirmacao */}
      {etapa === 3 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">4. Confirmar importacao</h2>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-blue-800 font-medium mb-2">Voce esta prestes a importar:</p>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• <strong>{preview?.validos}</strong> novos membros serao cadastrados</li>
              <li>• <strong>{Object.values(decisoesDuplicados).filter(d => d === 'atualizar').length}</strong> membros existentes serao atualizados</li>
              <li>• <strong>{preview?.com_problema}</strong> registros com erro serao ignorados</li>
            </ul>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setEtapa(2)} className="flex items-center gap-1 text-gray-600 border border-gray-200 px-4 py-2 rounded-xl text-sm hover:bg-gray-50"><ArrowLeft size={14} /> Voltar</button>
            <button onClick={handleExecutar} disabled={carregando} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
              {carregando ? <><Loader2 size={16} className="animate-spin" /> Importando... aguarde</> : <><CheckCircle size={16} /> Executar importacao</>}
            </button>
          </div>
        </div>
      )}

      {/* ETAPA 4 - Relatorio */}
      {etapa === 4 && resultado && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="text-center mb-6">
            <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-gray-900">Importacao concluida!</h2>
            <p className="text-gray-500 text-sm mt-1">{resultado.mensagem}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total', valor: resultado.total, cor: 'blue' },
              { label: 'Importados', valor: resultado.importados, cor: 'green' },
              { label: 'Duplicados', valor: resultado.duplicados, cor: 'yellow' },
              { label: 'Erros', valor: resultado.com_erro, cor: 'red' },
            ].map(({ label, valor, cor }) => (
              <div key={label} className={"rounded-xl p-4 text-center bg-" + cor + "-50 border border-" + cor + "-100"}>
                <p className={"text-2xl font-bold text-" + cor + "-700"}>{valor}</p>
                <p className={"text-xs text-" + cor + "-600"}>{label}</p>
              </div>
            ))}
          </div>

          {resultado.erros?.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-red-700 mb-2">Erros encontrados</h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {resultado.erros.map((e, i) => (
                  <div key={i} className="text-xs bg-red-50 rounded-lg px-3 py-2">Linha {e.linha}: {e.motivo}</div>
                ))}
              </div>
            </div>
          )}

          <button onClick={reiniciar} className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors">
            Fazer outra importacao
          </button>
        </div>
      )}
    </div>
  );
}
