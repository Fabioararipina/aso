const db = require('../config/database');

class TvMidia {
  static async listar() {
    const result = await db.query('SELECT * FROM tv_midias WHERE ativo = TRUE ORDER BY ordem ASC, id ASC');
    return result.rows;
  }

  static async criar(tipo, titulo, conteudo, duracao, ordem) {
    const result = await db.query(
      'INSERT INTO tv_midias (tipo, titulo, conteudo, duracao, ordem) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [tipo, titulo, conteudo, duracao, ordem]
    );
    return result.rows[0];
  }

  static async excluir(id) {
    await db.query('DELETE FROM tv_midias WHERE id = $1', [id]);
  }

  static async atualizarOrdem(id, ordem) {
    const result = await db.query(
      'UPDATE tv_midias SET ordem = $1 WHERE id = $2 RETURNING *',
      [ordem, id]
    );
    return result.rows[0];
  }

  static async atualizar(id, dados) {
    const { tipo, titulo, conteudo, duracao, ordem } = dados;
    const result = await db.query(
      'UPDATE tv_midias SET tipo = $1, titulo = $2, conteudo = $3, duracao = $4, ordem = $5 WHERE id = $6 RETURNING *',
      [tipo, titulo, conteudo, duracao, ordem, id]
    );
    return result.rows[0];
  }
}

module.exports = TvMidia;
