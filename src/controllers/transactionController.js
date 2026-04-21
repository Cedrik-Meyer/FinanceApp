const db = require('../db');

exports.createTransaction = async (req, res) => {
    const { account_id, type, amount, category, description, transaction_date } = req.body;

    try {
        await db.query('BEGIN');

        const insertQuery = `
            INSERT INTO transactions (account_id, type, amount, category, description, transaction_date)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
        const resTransaction = await db.query(insertQuery, [
            account_id,
            type,
            amount,
            category,
            description,
            transaction_date || new Date()
        ]);

        const adjustment = type === 'INCOME' ? amount : -amount;
        await db.query(
            'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
            [adjustment, account_id]
        );

        await db.query('COMMIT');

        res.status(201).json(resTransaction.rows[0]);
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: 'Failed to process transaction' });
    }
};

exports.getTransactionsByAccount = async (req, res) => {
    const { accountId } = req.params;
    try {
        const query = `
            SELECT t.*, 
                   EXISTS(SELECT 1 FROM depot_positions dp WHERE t.id = dp.transaction_id OR t.id = dp.fee_transaction_id) as is_depot_linked
            FROM transactions t
            WHERE t.account_id = $1 
            ORDER BY t.transaction_date DESC
        `;
        const result = await db.query(query, [accountId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching transactions' });
    }
};

exports.updateTransaction = async (req, res) => {
    const { id } = req.params;
    const { type, amount, category, description, transaction_date } = req.body;

    try {
        await db.query('BEGIN');

        const checkRes = await db.query('SELECT 1 FROM depot_positions WHERE transaction_id = $1 OR fee_transaction_id = $1', [id]);
        if (checkRes.rows.length > 0) {
            await db.query('ROLLBACK');
            return res.status(403).json({ error: 'Cannot modify a transaction linked to a portfolio position.' });
        }

        const oldRes = await db.query('SELECT * FROM transactions WHERE id = $1', [id]);
        const old = oldRes.rows[0];

        if (!old) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const undoAdjustment = old.type === 'INCOME' ? -old.amount : old.amount;
        await db.query(
            'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
            [undoAdjustment, old.account_id]
        );

        const updateQuery = `
            UPDATE transactions
            SET type = $1, amount = $2, category = $3, description = $4, transaction_date = $5
            WHERE id = $6 RETURNING *`;
        const updatedRes = await db.query(updateQuery, [
            type,
            amount,
            category,
            description,
            transaction_date,
            id
        ]);

        const newAdjustment = type === 'INCOME' ? amount : -amount;
        await db.query(
            'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
            [newAdjustment, old.account_id]
        );

        await db.query('COMMIT');
        res.json(updatedRes.rows[0]);
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.deleteTransaction = async (req, res) => {
    const { id } = req.params;

    try {
        await db.query('BEGIN');

        const checkRes = await db.query('SELECT 1 FROM depot_positions WHERE transaction_id = $1 OR fee_transaction_id = $1', [id]);
        if (checkRes.rows.length > 0) {
            await db.query('ROLLBACK');
            return res.status(403).json({ error: 'Cannot delete a transaction linked to a portfolio position.' });
        }

        const transRes = await db.query('SELECT * FROM transactions WHERE id = $1', [id]);
        const transaction = transRes.rows[0];

        if (!transaction) throw new Error('Transaction not found');

        const adjustment = transaction.type === 'INCOME' ? -transaction.amount : transaction.amount;

        await db.query(
            'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
            [adjustment, transaction.account_id]
        );

        await db.query('DELETE FROM transactions WHERE id = $1', [id]);

        await db.query('COMMIT');
        res.status(200).json({ message: 'Transaction deleted' });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: 'Internal Server Error' });
    }
};