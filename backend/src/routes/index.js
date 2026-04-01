const express = require('express');
const router = express.Router();
const PacienteController = require('../controllers/PacienteController');
const AtendimentoController = require('../controllers/AtendimentoController');
const FilaController = require('../controllers/FilaController');
const AuthController = require('../controllers/AsoAuthController');
const MetricasController = require('../controllers/MetricasController');
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

// Métricas
router.get('/metricas', auth, MetricasController.obterIndicadores);
router.get('/metricas/exames-sala', auth, MetricasController.obterExamesSala);

// Pacientes
router.post('/pacientes', auth, PacienteController.criar);
router.get('/pacientes/buscar', auth, PacienteController.buscarPorWhatsapp);

// Empresas — autocomplete
router.get('/empresas', auth, async (req, res) => {
  const pool = require('../config/database');
  const { q } = req.query;
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT empresa FROM atendimentos
       WHERE empresa ILIKE $1 AND empresa IS NOT NULL AND empresa <> ''
       ORDER BY empresa LIMIT 10`,
      [`%${q || ''}%`]
    );
    res.json(rows.map(r => r.empresa));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atendimentos
router.post('/atendimentos', auth, AtendimentoController.criar);
router.get('/atendimentos/hoje', auth, AtendimentoController.listarHoje);
router.put('/atendimentos/:id', auth, AtendimentoController.editar);
router.patch('/atendimentos/:id/cancelar', auth, AtendimentoController.cancelar);

// Fila
router.get('/fila/:sala_slug', auth, FilaController.listarPorSala);
router.post('/fila/:sala_slug/chamar', auth, FilaController.chamar);
router.post('/fila/:id/concluir', auth, FilaController.concluir);
router.post('/fila/:id/ausente', auth, FilaController.marcarAusente);
router.post('/fila/:id/reativar', auth, FilaController.reativarPaciente);
router.post('/fila/:sala_slug/atraso', auth, FilaController.registrarAtraso);

// Salas — CRUD completo
router.get('/salas', auth, async (req, res) => {
  const pool = require('../config/database');
  try {
    const { rows } = await pool.query(`
      SELECT s.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', te.id,
              'nome', te.nome,
              'subtipos', (
                SELECT COALESCE(
                  json_agg(json_build_object('id', se.id, 'nome', se.nome) ORDER BY se.nome),
                  '[]'::json
                )
                FROM subtipos_exame se
                WHERE se.tipo_exame_id = te.id AND se.ativo = true
              )
            ) ORDER BY te.nome
          ) FILTER (WHERE te.id IS NOT NULL AND te.ativo = true),
          '[]'::json
        ) as tipos_exame
      FROM salas s
      LEFT JOIN tipos_exame te ON te.sala_id = s.id
      GROUP BY s.id
      ORDER BY s.id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/salas', auth, async (req, res) => {
  const pool = require('../config/database');
  const { nome, slug, tempo_medio_min, administrativa, requer_adm, hora_inicio } = req.body;
  if (!nome || !slug) return res.status(400).json({ error: 'Nome e slug são obrigatórios' });
  try {
    await pool.query('ALTER TABLE salas ADD COLUMN IF NOT EXISTS requer_adm BOOLEAN DEFAULT false').catch(() => {});
    await pool.query('ALTER TABLE salas ADD COLUMN IF NOT EXISTS hora_inicio TIME DEFAULT NULL').catch(() => {});
    const { rows } = await pool.query(
      'INSERT INTO salas (nome, slug, tempo_medio_min, administrativa, requer_adm, hora_inicio) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [nome, slug.toLowerCase().replace(/\s+/g, '-'), tempo_medio_min || 15, administrativa || false, requer_adm || false, hora_inicio || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Slug já existe' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/salas/:id', auth, async (req, res) => {
  const pool = require('../config/database');
  const { nome, slug, tempo_medio_min, ativo, administrativa, requer_adm, hora_inicio } = req.body;
  try {
    await pool.query('ALTER TABLE salas ADD COLUMN IF NOT EXISTS requer_adm BOOLEAN DEFAULT false').catch(() => {});
    await pool.query('ALTER TABLE salas ADD COLUMN IF NOT EXISTS hora_inicio TIME DEFAULT NULL').catch(() => {});
    const { rows } = await pool.query(
      'UPDATE salas SET nome=$1, slug=$2, tempo_medio_min=$3, ativo=$4, administrativa=$5, requer_adm=$6, hora_inicio=$7 WHERE id=$8 RETURNING *',
      [nome, slug, tempo_medio_min, ativo !== undefined ? ativo : true, administrativa || false, requer_adm || false, hora_inicio || null, req.params.id]
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

// ─── Tipos de Exame por Sala ─────────────────────────────────────────────────
router.get('/salas/:id/tipos-exame', auth, async (req, res) => {
  const pool = require('../config/database');
  try {
    const { rows } = await pool.query(
      'SELECT * FROM tipos_exame WHERE sala_id = $1 ORDER BY nome',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/salas/:id/tipos-exame', auth, async (req, res) => {
  const pool = require('../config/database');
  const { nome } = req.body;
  if (!nome?.trim()) return res.status(400).json({ error: 'Nome obrigatório' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO tipos_exame (sala_id, nome) VALUES ($1, $2) RETURNING *',
      [req.params.id, nome.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/tipos-exame/:id', auth, async (req, res) => {
  const pool = require('../config/database');
  const { nome, ativo } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE tipos_exame SET nome = COALESCE($1, nome), ativo = COALESCE($2, ativo) WHERE id = $3 RETURNING *',
      [nome, ativo, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/tipos-exame/:id', auth, async (req, res) => {
  const pool = require('../config/database');
  try {
    await pool.query('DELETE FROM tipos_exame WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Sub-tipos de Exame por Tipo ─────────────────────────────────────────────
router.get('/tipos-exame/:id/subtipos', auth, async (req, res) => {
  const pool = require('../config/database');
  try {
    const { rows } = await pool.query(
      'SELECT * FROM subtipos_exame WHERE tipo_exame_id = $1 AND ativo = true ORDER BY nome',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/tipos-exame/:id/subtipos', auth, async (req, res) => {
  const pool = require('../config/database');
  const { nome } = req.body;
  if (!nome?.trim()) return res.status(400).json({ error: 'Nome obrigatório' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO subtipos_exame (tipo_exame_id, nome) VALUES ($1, $2) RETURNING *',
      [req.params.id, nome.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/subtipos-exame/:id', auth, async (req, res) => {
  const pool = require('../config/database');
  const { nome, ativo } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE subtipos_exame SET nome = COALESCE($1, nome), ativo = COALESCE($2, ativo) WHERE id = $3 RETURNING *',
      [nome, ativo, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/subtipos-exame/:id', auth, async (req, res) => {
  const pool = require('../config/database');
  try {
    await pool.query('DELETE FROM subtipos_exame WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Exames selecionados por entrada na fila ──────────────────────────────────
router.get('/fila-salas/:id/exames', auth, async (req, res) => {
  const pool = require('../config/database');
  try {
    const { rows } = await pool.query(`
      SELECT ase.id, ase.concluido,
             se.id as subtipo_exame_id, se.nome as subtipo_nome,
             te.id as tipo_exame_id, te.nome as tipo_nome
      FROM atendimento_sala_exames ase
      JOIN subtipos_exame se ON se.id = ase.subtipo_exame_id
      JOIN tipos_exame te ON te.id = se.tipo_exame_id
      WHERE ase.fila_sala_id = $1
      ORDER BY te.nome, se.nome
    `, [req.params.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/exames-selecionados/:id/concluir', auth, async (req, res) => {
  const pool = require('../config/database');
  const { concluido } = req.body;
  try {
    await pool.query(
      'UPDATE atendimento_sala_exames SET concluido = $1 WHERE id = $2',
      [concluido, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// TV dados (public — used by TV panel without auth)
router.get('/tv/dados', async (req, res) => {
  const pool = require('../config/database');
  try {
    const { rows } = await pool.query(`
      SELECT a.id, a.criado_em, a.status, p.nome as paciente_nome,
        json_agg(json_build_object(
          'sala_id', fs.sala_id,
          'sala_nome', s.nome,
          'sala_slug', s.slug,
          'status', fs.status,
          'posicao', fs.posicao,
          'tempo_medio_min', s.tempo_medio_min
        ) ORDER BY fs.sala_id) FILTER (WHERE s.administrativa = false OR s.administrativa IS NULL) as salas
      FROM atendimentos a
      JOIN pacientes p ON p.id = a.paciente_id
      LEFT JOIN fila_salas fs ON fs.atendimento_id = a.id
      LEFT JOIN salas s ON s.id = fs.sala_id
      WHERE a.criado_em::date = CURRENT_DATE AND a.status IN ('PRESENTE','EM_ATENDIMENTO')
        AND EXISTS (
          SELECT 1 FROM fila_salas fs2 JOIN salas s2 ON s2.id = fs2.sala_id
          WHERE fs2.atendimento_id = a.id AND (s2.administrativa = false OR s2.administrativa IS NULL)
        )
      GROUP BY a.id, a.criado_em, a.status, p.nome
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

// WhatsApp templates CRUD
router.get('/whatsapp/templates', auth, async (req, res) => {
  const pool = require('../config/database');
  try {
    const { rows } = await pool.query('SELECT * FROM wa_templates ORDER BY tipo');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/whatsapp/templates/:tipo', auth, async (req, res) => {
  const pool = require('../config/database');
  const { titulo, corpo } = req.body;
  if (!corpo?.trim()) return res.status(400).json({ error: 'Corpo obrigatório' });
  try {
    const { rows } = await pool.query(
      'UPDATE wa_templates SET titulo=$1, corpo=$2, atualizado_em=NOW() WHERE tipo=$3 RETURNING *',
      [titulo, corpo.trim(), req.params.tipo]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Template não encontrado' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// WhatsApp mensagens log
router.get('/whatsapp/log', auth, async (req, res) => {
  const pool = require('../config/database');
  const limit = parseInt(req.query.limit) || 50;
  const tipo = req.query.tipo || null;
  try {
    const { rows } = await pool.query(`
      SELECT wl.id, wl.tipo, wl.mensagem, wl.enviado_em,
             p.nome as paciente_nome, p.whatsapp
      FROM wa_mensagens_log wl
      LEFT JOIN pacientes p ON p.id = wl.paciente_id
      ${tipo ? 'WHERE wl.tipo = $2' : ''}
      ORDER BY wl.enviado_em DESC
      LIMIT $1
    `, tipo ? [limit, tipo] : [limit]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Auto-migrate
;(async () => {
  const pool = require('../config/database');
  try {
    await pool.query("ALTER TABLE tv_midias ADD COLUMN IF NOT EXISTS conteudo TEXT");
    await pool.query("ALTER TABLE fila_salas ADD COLUMN IF NOT EXISTS ultima_contagem_enviada INT DEFAULT NULL");
    await pool.query("ALTER TABLE salas ADD COLUMN IF NOT EXISTS administrativa BOOLEAN DEFAULT false");
    // v5: ausência/hibernação
    await pool.query("ALTER TABLE fila_salas DROP CONSTRAINT IF EXISTS fila_salas_status_check");
    await pool.query("ALTER TABLE fila_salas ADD CONSTRAINT fila_salas_status_check CHECK (status IN ('PENDENTE','EM_ATENDIMENTO','CONCLUIDO_SALA','HIBERNADO'))");
    await pool.query("ALTER TABLE fila_salas ADD COLUMN IF NOT EXISTS tentativas_ausencia INTEGER DEFAULT 0");
  } catch (_) {}
})();

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

// Create widget (TEMPO or NOTICIA — no file)
router.post('/tv/midias/widget', auth, async (req, res) => {
  const pool = require('../config/database');
  const { nome, tipo, conteudo, duracao_seg, ordem } = req.body;
  if (!['TEMPO', 'NOTICIA'].includes(tipo)) return res.status(400).json({ error: 'Tipo deve ser TEMPO ou NOTICIA' });
  if (!conteudo) return res.status(400).json({ error: 'Conteúdo obrigatório' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO tv_midias (nome, tipo, conteudo, duracao_seg, ordem) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [nome || (tipo === 'TEMPO' ? 'Previsão do Tempo' : 'Notícias'), tipo, conteudo.trim(), parseInt(duracao_seg) || 15, parseInt(ordem) || 0]
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
