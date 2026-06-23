import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCarregando(true);
    try {
      await api.post('/auth/forgot-password', { email });
    } finally {
      setCarregando(false);
      setEnviado(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-blue-900 mb-1">Recuperar senha</h1>
        <p className="text-gray-500 text-sm mb-6">Informe seu e-mail para receber as instruções de recuperação.</p>

        {enviado ? (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
            Se o e-mail informado estiver cadastrado, você receberá as instruções em breve.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit" disabled={carregando}
              className="w-full bg-blue-900 hover:bg-blue-800 disabled:opacity-60 text-white font-medium py-3 rounded-xl transition-colors"
            >
              {carregando ? 'Enviando...' : 'Enviar instruções'}
            </button>
          </form>
        )}

        <Link to="/login" className="block text-center text-sm text-blue-600 hover:underline mt-6">Voltar ao login</Link>
      </div>
    </div>
  );
}
