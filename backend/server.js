const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const adminRoutes = require('./routes/adminRoutes');
const memberRoutes = require('./routes/memberRoutes');
const { ensureSchema } = require('./db/ensureSchema');

const app = express();

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[API REQUEST] ${req.method} ${req.originalUrl}`);
  res.on('finish', () => {
    console.log(`[API RESPONSE] ${req.method} ${req.originalUrl} -> ${res.statusCode}`);
  });
  next();
});

// Health check
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Debug route - list tables (remove in production)
const db = require('./config/db');
app.get('/debug-db', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    res.json(result.rows);
  } catch (err) {
    res.json({ error: err.message });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/members', memberRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  console.log('Starting server...');

  try {
    await ensureSchema();
    console.log('Schema initialized successfully');
  } catch (err) {
    console.error('Schema initialization failed:', err.message);
    console.log('Continuing server startup anyway...');
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API base: http://localhost:${PORT}/api`);
  });
}

startServer();
