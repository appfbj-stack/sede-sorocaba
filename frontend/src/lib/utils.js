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
