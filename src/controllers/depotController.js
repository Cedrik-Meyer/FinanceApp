const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const db = require('../db');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

exports.getPositions = async (req, res) => {
    try {
        // Join mit der transactions-Tabelle, um den Betrag der Gebühr zu erhalten
        const result = await db.query(`
            SELECT dp.*, t_fee.amount as fee_amount 
            FROM depot_positions dp
            LEFT JOIN transactions t_fee ON dp.fee_transaction_id = t_fee.id
            ORDER BY dp.id ASC
        `);
        const positions = result.rows;

        const enrichedPositions = await Promise.all(positions.map(async (pos) => {
            try {
                const cleanTicker = pos.ticker_symbol.trim();
                const quote = await yahooFinance.quote(cleanTicker);

                const currentPrice = quote.regularMarketPrice;
                const currentValue = currentPrice * pos.quantity;
                const buyValue = pos.buy_price * pos.quantity;
                const performanceAbs = currentValue - buyValue;
                const performanceRel = (performanceAbs / buyValue) * 100;

                return {
                    ...pos,
                    fee: pos.fee_amount || 0, // Gebühr für das Frontend bereitstellen
                    currentPrice,
                    currentValue,
                    performanceAbs,
                    performanceRel
                };
            } catch (e) {
                return {
                    ...pos,
                    fee: pos.fee_amount || 0,
                    currentPrice: Number(pos.buy_price),
                    currentValue: pos.buy_price * pos.quantity,
                    performanceAbs: 0,
                    performanceRel: 0
                };
            }
        }));

        res.json(enrichedPositions);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.createPosition = async (req, res) => {
    const { name, isin, ticker_symbol, quantity, buy_price, buy_date, account_id, fee } = req.body;
    try {
        await db.query('BEGIN');

        const purchaseAmount = quantity * buy_price;
        const orderFee = parseFloat(fee) || 0;

        const buyTransRes = await db.query(
            'INSERT INTO transactions (account_id, type, amount, category, description, transaction_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [account_id, 'EXPENSE', purchaseAmount, 'Stock Purchase', `Buy ${quantity} ${ticker_symbol}`, buy_date || new Date()]
        );
        const transactionId = buyTransRes.rows[0].id;

        let feeTransactionId = null;
        if (orderFee > 0) {
            const feeTransRes = await db.query(
                'INSERT INTO transactions (account_id, type, amount, category, description, transaction_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                [account_id, 'EXPENSE', orderFee, 'Order Fee', `Fee for ${ticker_symbol} purchase`, buy_date || new Date()]
            );
            feeTransactionId = feeTransRes.rows[0].id;
        }

        await db.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [purchaseAmount + orderFee, account_id]);

        const result = await db.query(
            'INSERT INTO depot_positions (name, isin, ticker_symbol, quantity, buy_price, buy_date, transaction_id, fee_transaction_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [name, isin, ticker_symbol, quantity, buy_price, buy_date || new Date(), transactionId, feeTransactionId]
        );

        await db.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.updatePosition = async (req, res) => {
    const { id } = req.params;
    const { name, isin, ticker_symbol, quantity, buy_price, buy_date, fee } = req.body;

    try {
        await db.query('BEGIN');

        const posRes = await db.query('SELECT * FROM depot_positions WHERE id = $1', [id]);
        const oldPos = posRes.rows[0];
        if (!oldPos) throw new Error('Position not found');

        const newPurchaseAmount = quantity * buy_price;
        const newFeeAmount = parseFloat(fee) || 0;

        const mainTransRes = await db.query('SELECT amount, account_id FROM transactions WHERE id = $1', [oldPos.transaction_id]);
        const oldMainTrans = mainTransRes.rows[0];
        const accountId = oldMainTrans.account_id;

        let oldFeeAmount = 0;
        if (oldPos.fee_transaction_id) {
            const feeTransRes = await db.query('SELECT amount FROM transactions WHERE id = $1', [oldPos.fee_transaction_id]);
            if (feeTransRes.rows[0]) oldFeeAmount = parseFloat(feeTransRes.rows[0].amount);
        }

        const balanceAdjustment = (oldMainTrans.amount + oldFeeAmount) - (newPurchaseAmount + newFeeAmount);
        await db.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [balanceAdjustment, accountId]);

        await db.query(
            'UPDATE transactions SET amount = $1, description = $2, transaction_date = $3 WHERE id = $4',
            [newPurchaseAmount, `Buy ${quantity} ${ticker_symbol}`, buy_date, oldPos.transaction_id]
        );

        let feeTransactionId = oldPos.fee_transaction_id;
        if (newFeeAmount > 0) {
            if (feeTransactionId) {
                await db.query(
                    'UPDATE transactions SET amount = $1, transaction_date = $2 WHERE id = $3',
                    [newFeeAmount, buy_date, feeTransactionId]
                );
            } else {
                const newFeeRes = await db.query(
                    'INSERT INTO transactions (account_id, type, amount, category, description, transaction_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                    [accountId, 'EXPENSE', newFeeAmount, 'Order Fee', `Fee for ${ticker_symbol}`, buy_date]
                );
                feeTransactionId = newFeeRes.rows[0].id;
            }
        } else if (feeTransactionId) {
            await db.query('DELETE FROM transactions WHERE id = $1', [feeTransactionId]);
            feeTransactionId = null;
        }

        const result = await db.query(
            'UPDATE depot_positions SET name = $1, isin = $2, ticker_symbol = $3, quantity = $4, buy_price = $5, buy_date = $6, fee_transaction_id = $7 WHERE id = $8 RETURNING *',
            [name, isin, ticker_symbol, quantity, buy_price, buy_date, feeTransactionId, id]
        );

        await db.query('COMMIT');
        res.status(200).json(result.rows[0]);
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.deletePosition = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('BEGIN');

        const posRes = await db.query('SELECT transaction_id, fee_transaction_id FROM depot_positions WHERE id = $1', [id]);
        const pos = posRes.rows[0];

        if (pos) {
            const ids = [pos.transaction_id, pos.fee_transaction_id].filter(val => val !== null);
            for (const tId of ids) {
                const tRes = await db.query('SELECT amount, account_id FROM transactions WHERE id = $1', [tId]);
                if (tRes.rows[0]) {
                    await db.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [tRes.rows[0].amount, tRes.rows[0].account_id]);
                    await db.query('DELETE FROM transactions WHERE id = $1', [tId]);
                }
            }
        }

        await db.query('DELETE FROM depot_positions WHERE id = $1', [id]);
        await db.query('COMMIT');
        res.status(200).json({ message: 'Position deleted' });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.getHistory = async (req, res) => {
    const { ticker, range } = req.params;
    const now = new Date();
    let period1;
    let interval;

    switch (range) {
        case '1d':
            period1 = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
            interval = '5m';
            break;
        case '5d':
            period1 = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
            interval = '15m';
            break;
        case '1mo':
            period1 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            interval = '1d';
            break;
        case '1y':
            period1 = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            interval = '1d';
            break;
        case '5y':
            period1 = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);
            interval = '1wk';
            break;
        case 'max':
        default:
            period1 = new Date('1970-01-01');
            interval = '1mo';
            break;
    }

    try {
        const result = await yahooFinance.chart(ticker, {
            period1: period1,
            interval: interval
        });

        const validQuotes = result.quotes.filter(q => q.close !== null);
        res.json(validQuotes);
    } catch (err) {
        console.error("Chart Error:", err.message || err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};