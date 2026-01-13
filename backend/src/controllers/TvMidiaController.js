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

  static async atualizarOrdem(req, res) {
    try {
      const { ordem } = req.body;
      const midia = await TvMidia.atualizarOrdem(req.params.id, ordem);
      res.json(midia);
    } catch (error) {
      res.status(500).json({ erro: error.message });
    }
  }

  static async atualizar(req, res) {
    try {
      console.log('Atualizando mídia TV:', req.params.id);
      console.log('Body:', req.body);
      console.log('File:', req.file);

      const { tipo, titulo, duracao, ordem, conteudoExistente } = req.body;
      let conteudo = req.file ? req.file.filename : conteudoExistente;

      if (!conteudo) {
         console.warn('Conteúdo vazio na atualização.');
         // Se for imagem e não tem arquivo nem conteudoExistente, pode ser um problema.
         // Mas se o usuário estiver mudando para Texto, ok.
      }

      const midia = await TvMidia.atualizar(req.params.id, {
        tipo, 
        titulo, 
        conteudo, 
        duracao: parseInt(duracao), 
        ordem: parseInt(ordem)
      });
      res.json(midia);
    } catch (error) {
      console.error('ERRO AO ATUALIZAR MÍDIA:', error);
      res.status(500).json({ erro: error.message });
    }
  }
}

module.exports = TvMidiaController;
