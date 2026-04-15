const db = require('../db');

exports.getAccounts = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM accounts ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching accounts:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.createAccount = async (req, res) => {
    const { name, balance } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO accounts (name, balance) VALUES ($1, $2) RETURNING *',
            [name, balance || 0]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating account:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.deleteAccount = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM accounts WHERE id = $1', [id]);
        res.status(200).json({ message: 'Account deleted' });
    } catch (err) {
        console.error('Error deleting account:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.updateAccount = async (req, res) => {
    const { id } = req.params;
    const { name, balance } = req.body;
    try {
        const result = await db.query(
            'UPDATE accounts SET name = $1, balance = $2 WHERE id = $3 RETURNING *',
            [name, balance, id]
        );
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('Error updating account:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};