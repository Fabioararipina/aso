const express = require('express');
const router = express.Router();
const PacienteController = require('../controllers/PacienteController');
const AtendimentoController = require('../controllers/AtendimentoController');
const FilaController = require('../controllers/FilaController');
const AuthController = require('../controllers/AsoAuthController');
const auth = require('../middleware/auth');

// Alias for named import compatibility
const authenticateToken = auth;

// Auth
router.post('/auth/login', AuthController.login);
router.get('/auth/usuarios', auth, AuthController.listarUsuarios);
router.post('/auth/usuarios', auth, AuthController.criarUsuario);
router.put('/auth/usuarios/:id/senha', auth, AuthController.atualizarSenha);
router.delete('/auth/usuarios/:id', auth, AuthController.desativarUsuario);
router.post('/auth/tv-token', auth, AuthController.gerarCodigoTv);

// Pacientes
router.post('/pacientes', auth, PacienteController.criar);
router.get('/pacientes/buscar', auth, PacienteController.buscarPorWhatsapp);

// Atendimentos
router.post('/atendimentos', auth, AtendimentoController.criar);
router.get('/atendimentos/hoje', auth, AtendimentoController.listarHoje);
router.patch('/atendimentos/:id/cancelar', auth, AtendimentoController.cancelar);

// Fila
router.get('/fila/:sala_slug', auth, FilaController.listarPorSala);
router.post('/fila/:sala_slug/chamar', auth, FilaController.chamar);
router.post('/fila/:id/concluir', auth, FilaController.concluir);

// Salas — CRUD completo
router.get('/salas', auth, async (req, res) => {
  const pool = require('../config/database');
  try {
    const { rows } = await pool.query('SELECT * FROM salas ORDER BY id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/salas', auth, async (req, res) => {
  const pool = require('../config/database');
  const { nome, slug, tempo_medio_min } = req.body;
  if (!nome || !slug) return res.status(400).json({ error: 'Nome e slug são obrigatórios' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO salas (nome, slug, tempo_medio_min) VALUES ($1,$2,$3) RETURNING *',
      [nome, slug.toLowerCase().replace(/\s+/g, '-'), tempo_medio_min || 15]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Slug já existe' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/salas/:id', auth, async (req, res) => {
  const pool = require('../config/database');
  const { nome, slug, tempo_medio_min, ativo } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE salas SET nome=$1, slug=$2, tempo_medio_min=$3, ativo=$4 WHERE id=$5 RETURNING *',
      [nome, slug, tempo_medio_min, ativo !== undefined ? ativo : true, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Sala não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Slug já existe' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/salas/:id', auth, async (req, res) => {
  const pool = require('../config/database');
  try {
    const { rows: emUso } = await pool.query(
      "SELECT 1 FROM fila_salas WHERE sala_id=$1 AND status IN ('PENDENTE','EM_ATENDIMENTO') LIMIT 1",
      [req.params.id]
    );
    if (emUso.length > 0) return res.status(409).json({ error: 'Sala com pacientes na fila — não pode excluir' });
    await pool.query('DELETE FROM salas WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TV dados (public — used by TV panel without auth)
router.get('/tv/dados', async (req, res) => {
  const pool = require('../config/database');
  try {
    const { rows } = await pool.query(`
      SELECT a.*, p.nome as paciente_nome,
        json_agg(json_build_object('sala_id',fs.sala_id,'sala_nome',s.nome,'sala_slug',s.slug,'status',fs.status,'posicao',fs.posicao) ORDER BY fs.sala_id) as salas
      FROM atendimentos a
      JOIN pacientes p ON p.id = a.paciente_id
      LEFT JOIN fila_salas fs ON fs.atendimento_id = a.id
      LEFT JOIN salas s ON s.id = fs.sala_id
      WHERE a.criado_em::date = CURRENT_DATE AND a.status IN ('PRESENTE','EM_ATENDIMENTO')
      GROUP BY a.id, p.nome
      ORDER BY a.criado_em ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TV Mídia — CRUD
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '../../uploads/tv');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `tv_${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|mp4|webm|mov/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
  }
});

// List all TV media (public - used by TV panel)
router.get('/tv/midias', async (req, res) => {
  const pool = require('../config/database');
  try {
    const { rows } = await pool.query('SELECT * FROM tv_midias WHERE ativo=true ORDER BY ordem ASC, id ASC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// List all (admin - includes inactive)
router.get('/tv/midias/all', auth, async (req, res) => {
  const pool = require('../config/database');
  try {
    const { rows } = await pool.query('SELECT * FROM tv_midias ORDER BY ordem ASC, id ASC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Upload
router.post('/tv/midias', auth, upload.single('arquivo'), async (req, res) => {
  const pool = require('../config/database');
  if (!req.file) return res.status(400).json({ error: 'Arquivo obrigatório' });
  const { nome, duracao_seg, ordem } = req.body;
  const ext = path.extname(req.file.originalname).toLowerCase();
  const tipo = ['.mp4', '.webm', '.mov'].includes(ext) ? 'VIDEO' : 'IMAGEM';
  try {
    const { rows } = await pool.query(
      'INSERT INTO tv_midias (nome, tipo, arquivo, duracao_seg, ordem) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [nome || req.file.originalname, tipo, `/uploads/tv/${req.file.filename}`, parseInt(duracao_seg) || 10, parseInt(ordem) || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update (nome, duracao, ordem, ativo)
router.put('/tv/midias/:id', auth, async (req, res) => {
  const pool = require('../config/database');
  const { nome, duracao_seg, ordem, ativo } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE tv_midias SET nome=$1, duracao_seg=$2, ordem=$3, ativo=$4 WHERE id=$5 RETURNING *',
      [nome, duracao_seg, ordem, ativo, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete
router.delete('/tv/midias/:id', auth, async (req, res) => {
  const pool = require('../config/database');
  try {
    const { rows } = await pool.query('DELETE FROM tv_midias WHERE id=$1 RETURNING arquivo', [req.params.id]);
    if (rows[0]) {
      const filePath = path.join(__dirname, '../../', rows[0].arquivo);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
