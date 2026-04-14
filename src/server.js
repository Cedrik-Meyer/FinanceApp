const express = require('express');
const path = require('path');
require('dotenv').config();

const accountRoutes = require('./routes/accounts');

const app = express();

app.use(express.json()); // Wichtig, damit wir req.body lesen können
app.use(express.static(path.join(__dirname, '../public'))); // Stellt dein HTML/CSS/JS bereit

app.use('/api/accounts', accountRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});