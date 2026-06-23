import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [novaSenha, setNovaSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await api.post('/auth/reset-password', { token, nova_senha: novaSenha });
      navigate('/login', { replace: true });
    } catch (err) {
      setErro(err.response?.data?.detail || 'Não foi possível redefinir a senha.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-blue-900 mb-1">Redefinir senha</h1>
        <p className="text-gray-500 text-sm mb-6">Escolha uma nova senha para sua conta.</p>

        {!token ? (
          <p className="text-sm text-red-600">Link inválido. Solicite a recuperação novamente.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password" required minLength={8} value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Nova senha (mín. 8 caracteres)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <button
              type="submit" disabled={carregando}
              className="w-full bg-blue-900 hover:bg-blue-800 disabled:opacity-60 text-white font-medium py-3 rounded-xl transition-colors"
            >
              {carregando ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </form>
        )}

        <Link to="/login" className="block text-center text-sm text-blue-600 hover:underline mt-6">Voltar ao login</Link>
      </div>
    </div>
  );
}
