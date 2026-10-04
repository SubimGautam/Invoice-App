require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const app = express();

// Uploaded avatars and business logos live under /uploads and are served
// statically by Express (client renders them straight from the URL).
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!process.env.VERCEL) {
  for (const sub of ['avatars', 'logos']) {
    fs.mkdirSync(path.join(UPLOADS_DIR, sub), { recursive: true });
  }

  app.use('/uploads', express.static(UPLOADS_DIR));
}


// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
function mountRoute(path, modulePath) {
  const route = require(modulePath);
  console.log(`[route] ${path} -> ${typeof route}`);
  app.use(path, route);
}

mountRoute('/api/auth', './routes/auth');
mountRoute('/api/clients', './routes/clients');
mountRoute('/api/invoices', './routes/invoices');
mountRoute('/api/estimates', './routes/estimates');
mountRoute('/api/estimate', './routes/estimate-view');
mountRoute('/api/payments', './routes/payments');
mountRoute('/api/products', './routes/products');
mountRoute('/api/account', './routes/account');
mountRoute('/api/reports', './routes/reports');
mountRoute('/api/workspaces', './routes/workspaces');
mountRoute('/api/notifications', './routes/notifications');
mountRoute('/api/emails', './routes/emails');
mountRoute('/api/search', './routes/search');
mountRoute('/api/recurring', './routes/recurring');
mountRoute('/api/pay', './routes/pay');
// Health check route — confirms the server is alive
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

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

// Start the server only when running locally.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Local development scheduler.
  const { startScheduler } = require('./lib/scheduler');
  startScheduler();
}

module.exports = app;
