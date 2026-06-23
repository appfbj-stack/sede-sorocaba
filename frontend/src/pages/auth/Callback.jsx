import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';

function extrairToken() {
  // Pega o token de qualquer lugar: ?token= ou #token=
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
  return params.get('token') || hashParams.get('token');
}

export default function Callback() {
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const [token] = useState(extrairToken);
  const erro = token ? '' : 'Token não recebido. URL: ' + window.location.href;

  useEffect(() => {
    if (!token) return;
    localStorage.setItem('kairos_token', token);
    login(token);
    const timer = setTimeout(() => navigate('/dashboard', { replace: true }), 500);
    return () => clearTimeout(timer);
  }, [token, login, navigate]);

  if (erro) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-lg w-full">
        <h2 className="font-bold text-red-800 mb-2">Erro no login</h2>
        <p className="text-sm text-red-600 break-all">{erro}</p>
        <a href="/login" className="mt-4 inline-block bg-red-600 text-white px-4 py-2 rounded-lg text-sm">Tentar novamente</a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Autenticando...</p>
      </div>
    </div>
  );
}
