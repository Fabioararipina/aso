const express = require('express');
const router = express.Router();
const TvMidiaController = require('../controllers/TvMidiaController');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads/tv');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadDir); },
  filename: function (req, file, cb) { cb(null, 'tv-' + Date.now() + path.extname(file.originalname)); }
});
const uploadTv = multer({ storage: storage });


router.get('/', TvMidiaController.listar);
router.post('/', uploadTv.single('arquivo'), TvMidiaController.criar);
router.delete('/:id', TvMidiaController.excluir);

module.exports = router;
