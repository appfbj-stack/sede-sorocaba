const jwt = require('jsonwebtoken');
const { getDb } = require('../db/schema');

function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token não fornecido' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const db = getDb();
    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ? AND ativo = 1').get(payload.id);
    if (!usuario) return res.status(401).json({ erro: 'Usuário inativo ou não encontrado' });
    req.usuario = usuario;
    next();
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}

function autorizar(...perfis) {
  return (req, res, next) => {
    if (!perfis.includes(req.usuario.perfil)) {
      return res.status(403).json({ erro: 'Acesso não permitido' });
    }
    next();
  };
}

function filtrarCongregacao(req, res, next) {
  if (req.usuario.perfil !== 'sede') {
    req.congregacaoFiltro = req.usuario.congregacao_id;
  }
  next();
}

module.exports = { autenticar, autorizar, filtrarCongregacao };
