import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatarData(data) {
  if (!data) return '—';
  return new Date(data).toLocaleDateString('pt-BR');
}

export function formatarDataHora(data) {
  if (!data) return '—';
  return new Date(data).toLocaleString('pt-BR');
}

export function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}

export function formatarCPF(cpf) {
  if (!cpf) return '';
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function calcularIdade(dataNasc) {
  if (!dataNasc) return null;
  const hoje = new Date();
  const nasc = new Date(dataNasc);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const mes = hoje.getMonth() - nasc.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

export const STATUS_MEMBRO = {
  ativo: { label: 'Ativo', color: 'bg-green-100 text-green-800' },
  inativo: { label: 'Inativo', color: 'bg-gray-100 text-gray-800' },
  transferido: { label: 'Transferido', color: 'bg-blue-100 text-blue-800' },
  falecido: { label: 'Falecido', color: 'bg-red-100 text-red-800' },
};

export const CATEGORIAS_OBREIRO = [
  { value: 'cooperador', label: 'Cooperador' },
  { value: 'diacono', label: 'Diácono' },
  { value: 'presbitero', label: 'Presbítero' },
  { value: 'evangelista', label: 'Evangelista' },
  { value: 'pastor', label: 'Pastor' },
];

export const TIPOS_EVENTO = [
  { value: 'culto', label: 'Culto' },
  { value: 'batismo', label: 'Batismo' },
  { value: 'santa_ceia', label: 'Santa Ceia' },
  { value: 'congresso', label: 'Congresso' },
  { value: 'reuniao', label: 'Reunião' },
];

export const CATEGORIAS_PATRIMONIO = [
  { value: 'instrumentos', label: 'Instrumentos' },
  { value: 'som', label: 'Som' },
  { value: 'computadores', label: 'Computadores' },
  { value: 'moveis', label: 'Móveis' },
  { value: 'veiculos', label: 'Veículos' },
  { value: 'projetores', label: 'Projetores' },
];

export const PERFIS = {
  master: { label: 'Master', color: 'bg-purple-100 text-purple-800' },
  admin: { label: 'Administrador', color: 'bg-blue-100 text-blue-800' },
  cliente: { label: 'Cliente', color: 'bg-gray-100 text-gray-800' },
};

export const LICENCA_STATUS = {
  teste: { label: 'Teste', color: 'bg-yellow-100 text-yellow-800' },
  ativo: { label: 'Ativo', color: 'bg-green-100 text-green-800' },
  suspenso: { label: 'Suspenso', color: 'bg-red-100 text-red-800' },
  expirado: { label: 'Expirado', color: 'bg-gray-100 text-gray-800' },
};
