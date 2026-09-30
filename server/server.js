require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const app = express();

// Uploaded avatars and business logos live under /uploads and are served
// statically by Express (client renders them straight from the URL).
const UPLOADS_DIR = path.join(__dirname, 'uploads');
for (const sub of ['avatars', 'logos']) {
  fs.mkdirSync(path.join(UPLOADS_DIR, sub), { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use('/api/auth', require('./routes/auth'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/estimates', require('./routes/estimates'));
// Public quote links — no auth, authenticated by the unguessable token only.
app.use('/api/estimate', require('./routes/estimate-view'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/products', require('./routes/products'));
app.use('/api/account', require('./routes/account'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/workspaces', require('./routes/workspaces'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/emails', require('./routes/emails'));
app.use('/api/search', require('./routes/search'));
app.use('/api/recurring', require('./routes/recurring'));
app.use('/api/pay', require('./routes/pay'));
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
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Phase 4: in-process recurring + overdue scheduler.
const { startScheduler } = require('./lib/scheduler');
startScheduler();