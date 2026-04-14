const db = require('../db');

exports.createTransaction = async (req, res) => {
    const { account_id, type, amount, category, description } = req.body;

    try {
        await db.query('BEGIN');

        const insertQuery = `
            INSERT INTO transactions (account_id, type, amount, category, description)
            VALUES ($1, $2, $3, $4, $5) RETURNING *`;
        const resTransaction = await db.query(insertQuery, [account_id, type, amount, category, description]);

        const adjustment = type === 'INCOME' ? amount : -amount;
        await db.query(
            'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
            [adjustment, account_id]
        );

        await db.query('COMMIT');

        res.status(201).json(resTransaction.rows[0]);
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Transaction Error:', err);
        res.status(500).json({ error: 'Failed to process transaction' });
    }
};

exports.getTransactionsByAccount = async (req, res) => {
    const { accountId } = req.params;
    try {
        const result = await db.query(
            'SELECT * FROM transactions WHERE account_id = $1 ORDER BY transaction_date DESC',
            [accountId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching transactions' });
    }
};