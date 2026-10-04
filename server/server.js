
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

// Route imports
const authRoutes = require('./routes/auth');
const clientsRoutes = require('./routes/clients');
const invoicesRoutes = require('./routes/invoices');
const estimatesRoutes = require('./routes/estimates');
const estimateViewRoutes = require('./routes/estimate-view');
const paymentsRoutes = require('./routes/payments');
const productsRoutes = require('./routes/products');
const accountRoutes = require('./routes/account');
const reportsRoutes = require('./routes/reports');
const workspacesRoutes = require('./routes/workspaces');
const notificationsRoutes = require('./routes/notifications');
const emailsRoutes = require('./routes/emails');
const searchRoutes = require('./routes/search');
const recurringRoutes = require('./routes/recurring');
const payRoutes = require('./routes/pay');

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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/estimates', estimatesRoutes);
app.use('/api/estimate', estimateViewRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/workspaces', workspacesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/emails', emailsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/recurring', recurringRoutes);
app.use('/api/pay', payRoutes);

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

