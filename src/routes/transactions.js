const express = require('express');
const router = express.Router();
const multer = require('multer');
const transactionController = require('../controllers/transactionController');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/', transactionController.createTransaction);
router.get('/:accountId', transactionController.getTransactionsByAccount);
router.get('/stats/analysis/:startDate/:endDate', transactionController.getExpenseAnalysis);
router.post('/import/:accountId', upload.single('file'), transactionController.importTransactions);
router.put('/:id', transactionController.updateTransaction);
router.delete('/:id', transactionController.deleteTransaction);

module.exports = router;