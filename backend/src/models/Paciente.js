const db = require('../config/database');

class Paciente {
  static async criar(dados) {
    const { nome, whatsapp, email, cpf, data_nascimento, endereco, convenio } = dados;
    const result = await db.query(
      'INSERT INTO pacientes (nome, whatsapp, email, cpf, data_nascimento, endereco, convenio) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [nome, whatsapp, email, cpf, data_nascimento, endereco, convenio]
    );
    return result.rows[0];
  }

  static async buscarPorWhatsapp(whatsapp) {
    const result = await db.query('SELECT * FROM pacientes WHERE whatsapp = $1', [whatsapp]);
    return result.rows[0];
  }
}

module.exports = Paciente;
