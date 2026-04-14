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