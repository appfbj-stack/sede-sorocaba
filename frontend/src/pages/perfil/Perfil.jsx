import { useAuthStore } from '../../stores/auth';
import { PERFIS } from '../../lib/utils';

export default function Perfil() {
  const { usuario } = useAuthStore();
  const perfilInfo = PERFIS[usuario?.perfil] ?? { label: usuario?.perfil, color: 'bg-gray-100 text-gray-800' };

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Meu perfil</h1>

      <div className="bg-white rounded-xl border p-6 flex items-center gap-4">
        {usuario?.foto_url
          ? <img src={usuario.foto_url} alt={usuario.nome} className="w-16 h-16 rounded-full object-cover" />
          : <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-bold">{usuario?.nome?.[0]}</div>
        }
        <div>
          <p className="text-lg font-semibold text-gray-900">{usuario?.nome}</p>
          <p className="text-sm text-gray-500">{usuario?.email}</p>
          <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${perfilInfo.color}`}>
            {perfilInfo.label}
          </span>
        </div>
      </div>
    </div>
  );
}
