const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'TROQUE_ESSA_CHAVE_NO_ENV';

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado. Faça login para continuar.' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.usuario = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado. Faça login novamente.' });
  }
}

module.exports = auth;
