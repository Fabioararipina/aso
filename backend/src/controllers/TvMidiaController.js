const TvMidia = require('../models/TvMidia');

class TvMidiaController {
  static async listar(req, res) {
    try {
      const midias = await TvMidia.listar();
      res.json(midias);
    } catch (error) {
      res.status(500).json({ erro: error.message });
    }
  }

  static async criar(req, res) {
    try {
      console.log('Recebendo nova mídia TV...');
      console.log('Body:', req.body);
      console.log('File:', req.file);

      // Se for upload de imagem
      let conteudo = req.body.conteudo;
      if (req.file) {
        conteudo = req.file.filename;
      }

      const { tipo, titulo, duracao, ordem } = req.body;
      const midia = await TvMidia.criar(tipo, titulo, conteudo, duracao, ordem);
      res.json(midia);
    } catch (error) {
      console.error('ERRO AO CRIAR MÍDIA:', error);
      res.status(500).json({ erro: error.message });
    }
  }

  static async excluir(req, res) {
    try {
      await TvMidia.excluir(req.params.id);
      res.json({ sucesso: true });
    } catch (error) {
      res.status(500).json({ erro: error.message });
    }
  }
}

module.exports = TvMidiaController;
