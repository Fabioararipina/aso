const pool = require('../config/database');

exports.criar = async (req, res) => {
  const { nome, whatsapp, cpf, data_nascimento } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO pacientes (nome, whatsapp, cpf, data_nascimento) VALUES ($1,$2,$3,$4) RETURNING *',
      [nome, whatsapp || null, cpf || null, data_nascimento || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.buscarPorWhatsapp = async (req, res) => {
  const { whatsapp } = req.query;
  try {
    const { rows } = await pool.query('SELECT * FROM pacientes WHERE whatsapp = $1 LIMIT 1', [whatsapp]);
    res.json(rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
