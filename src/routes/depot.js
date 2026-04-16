const express = require('express');
const router = express.Router();
const depotController = require('../controllers/depotController');

router.get('/', depotController.getPositions);
router.post('/', depotController.createPosition);
router.put('/:id', depotController.updatePosition);
router.delete('/:id', depotController.deletePosition);
router.get('/history/:ticker/:range', depotController.getHistory);

module.exports = router;