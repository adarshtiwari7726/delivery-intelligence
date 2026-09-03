require('dotenv').config();
const express = require('express');
const cors = require('cors');

const deliveryRoutes = require('./routes/delivery');
const historyRoutes = require('./routes/history');
const settingsRoutes = require('./routes/settings');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

require('./database/db'); // ensures schema is created on boot

const app = express();

app.use(
    cors({
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'DELETE'],
    })
);
app.use(express.json({ limit: '5mb' }));
app.use('/api', apiLimiter);

app.get('/api/health', (req, res) => res.json({ success: true, status: 'ok' }));

app.use('/api/delivery', deliveryRoutes);
app.use('/api/delivery/history', historyRoutes);
app.use('/api/settings', settingsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Delivery Intelligence backend listening on http://localhost:${PORT}`);
    console.log(`Active provider: ${process.env.DELIVERY_PROVIDER || 'mock'}`);
});
