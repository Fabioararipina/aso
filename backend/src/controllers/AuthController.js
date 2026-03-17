const db = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'TROQUE_ESSA_CHAVE_NO_ENV';

const AuthController = {
  async login(req, res) {
    const { usuario, senha } = req.body;
    if (!usuario || !senha) {
      return res.status(400).json({ error: 'Usuário e senha obrigatórios.' });
    }
    try {
      const result = await db.query(
        'SELECT * FROM usuarios WHERE usuario = $1 AND ativo = true',
        [usuario]
      );
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
      }
      const user = result.rows[0];
      const senhaCorreta = await bcrypt.compare(senha, user.senha_hash);
      if (!senhaCorreta) {
        return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
      }
      const token = jwt.sign(
        {
          id: user.id,
          usuario: user.usuario,
          perfil: user.perfil,
          nome: user.nome,
          medico_id: user.medico_id || null,
        },
        JWT_SECRET,
        { expiresIn: '8h' }
      );
      res.json({ token, perfil: user.perfil, nome: user.nome });
    } catch (err) {
      console.error('[AUTH] Erro no login:', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  },

  async criarUsuario(req, res) {
    // Somente ADMIN pode criar usuários
    if (req.usuario.perfil !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    const { nome, usuario, senha, perfil, medico_id } = req.body;
    if (!nome || !usuario || !senha || !perfil) {
      return res.status(400).json({ error: 'Nome, usuário, senha e perfil são obrigatórios.' });
    }
    if (!['ADMIN', 'RECEPCAO', 'MEDICO'].includes(perfil)) {
      return res.status(400).json({ error: 'Perfil inválido. Use: ADMIN, RECEPCAO ou MEDICO.' });
    }
    try {
      const senhaHash = await bcrypt.hash(senha, 10);
      const result = await db.query(
        `INSERT INTO usuarios (nome, usuario, senha_hash, perfil, medico_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, nome, usuario, perfil, medico_id`,
        [nome, usuario, senhaHash, perfil, medico_id || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Esse nome de usuário já existe.' });
      }
      console.error('[AUTH] Erro ao criar usuário:', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  },

  async listarUsuarios(req, res) {
    if (req.usuario.perfil !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    try {
      const result = await db.query(
        'SELECT id, nome, usuario, perfil, medico_id, ativo, criado_em FROM usuarios ORDER BY nome'
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  },

  async atualizarSenha(req, res) {
    if (req.usuario.perfil !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    const { id } = req.params;
    const { senha } = req.body;
    if (!senha || senha.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres.' });
    }
    try {
      const senhaHash = await bcrypt.hash(senha, 10);
      await db.query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [senhaHash, id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  },

  async gerarCodigoTv(req, res) {
    if (req.usuario.perfil !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    try {
      // Código legível sem caracteres ambíguos (0/O, 1/I)
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const codigo = `${seg()}-${seg()}-${seg()}`;

      const senhaHash = await bcrypt.hash(codigo, 10);

      // Cria ou substitui o usuário de TV (upsert por usuario='tv')
      await db.query(`
        INSERT INTO usuarios (nome, usuario, senha_hash, perfil)
        VALUES ('TV Sala de Espera', 'tv', $1, 'TV')
        ON CONFLICT (usuario) DO UPDATE SET senha_hash = $1, ativo = true
      `, [senhaHash]);

      res.json({ codigo });
    } catch (err) {
      console.error('[AUTH] Erro ao gerar código TV:', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  },

  async desativarUsuario(req, res) {
    if (req.usuario.perfil !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    const { id } = req.params;
    // Não deixa desativar a si mesmo
    if (parseInt(id) === req.usuario.id) {
      return res.status(400).json({ error: 'Você não pode desativar seu próprio usuário.' });
    }
    try {
      await db.query('UPDATE usuarios SET ativo = false WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  },
};

module.exports = AuthController;
