const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const db = require('../db');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

exports.getPositions = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM depot_positions ORDER BY id ASC');
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
                    currentPrice,
                    currentValue,
                    performanceAbs,
                    performanceRel
                };
            } catch (e) {
                return {
                    ...pos,
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
    const { name, isin, ticker_symbol, quantity, buy_price, buy_date } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO depot_positions (name, isin, ticker_symbol, quantity, buy_price, buy_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [name, isin, ticker_symbol, quantity, buy_price, buy_date || new Date()]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.updatePosition = async (req, res) => {
    const { id } = req.params;
    const { name, isin, ticker_symbol, quantity, buy_price, buy_date } = req.body;
    try {
        const result = await db.query(
            'UPDATE depot_positions SET name = $1, isin = $2, ticker_symbol = $3, quantity = $4, buy_price = $5, buy_date = $6 WHERE id = $7 RETURNING *',
            [name, isin, ticker_symbol, quantity, buy_price, buy_date, id]
        );
        res.status(200).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.deletePosition = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM depot_positions WHERE id = $1', [id]);
        res.status(200).json({ message: 'Position deleted' });
    } catch (err) {
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