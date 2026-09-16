require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use('/api/auth', require('./routes/auth'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/account', require('./routes/account'));
// Health check route — confirms the server is alive
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes will be added here as we build them:
// app.use('/api/auth', require('./routes/auth'));
// app.use('/api/clients', require('./routes/clients'));
// app.use('/api/invoices', require('./routes/invoices'));

// 404 handler — catches any route that doesn't exist
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler — catches anything thrown in routes
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});