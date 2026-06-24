import { useNavigate } from 'react-router-dom';

const ROTAS_ACAO = {
  cadastrar_membro: '/membros',
  cadastrar_evento: '/agenda',
  cadastrar_congregacao: '/congregacoes',
  listar_obreiros: '/obreiros',
  buscar_membro: '/membros',
  buscar_eventos: '/agenda',
};

export default function CardAjuda({ card, onVoltar }) {
  const navigate = useNavigate();
  if (!card) return null;

  const handleFazerAgora = () => {
    const rota = ROTAS_ACAO[card.acao] || '/dashboard';
    navigate(rota);
    onVoltar?.();
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 my-2">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{card.emoji || 'ð'}</span>
        <h3 className="font-semibold text-blue-900 text-sm">{card.titulo}</h3>
      </div>
      <ol className="space-y-1 mb-4">
        {card.passos?.map((passo, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
              {i + 1}
            </span>
            {passo}
          </li>
        ))}
      </ol>
      <div className="flex gap-2 flex-wrap">
        {card.botoes?.map((botao, i) => (
          <button
            key={i}
            onClick={i === 0 ? handleFazerAgora : onVoltar}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${i === 0 ? 'bg-blue-600 text-white hover:bv-blue-700' : 'bg-white border border-blue-300 text-blue-700 hover:bg-blue-50'}`}
          >
            {botao}
          </button>
        ))}
      </div>
    </div>
  );
}
