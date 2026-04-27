const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const accountRoutes = require('./routes/accounts');
const transactionRoutes = require('./routes/transactions');
const depotRoutes = require('./routes/depot');
const authRoutes = require('./routes/auth');
const authMiddleware = require('./middleware/auth');

const app = express();

app.use(express.json());
app.use(cookieParser())
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/auth', authRoutes)
app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/depot', depotRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});