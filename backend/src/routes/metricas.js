const express = require('express');
const router = express.Router();
const MetricasController = require('../controllers/MetricasController');
const auth = require('../middleware/auth');

router.get('/', auth, MetricasController.obterIndicadores);

module.exports = router;
