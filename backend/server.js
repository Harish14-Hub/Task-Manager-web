const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { ensureSchema } = require('./db/ensureSchema');

const app = express();

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.send("🔥 API is running...");
});

// DEBUG route (VERY IMPORTANT)
const db = require('./config/db');
app.get("/debug-db", async (req, res) => {
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

const PORT = process.env.PORT || 5000;

async function startServer() {
  console.log("🚀 Starting server...");

  try {
    await ensureSchema();
  } catch (err) {
    console.log("⚠️ Schema failed but continuing...");
  }

  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
}

startServer();