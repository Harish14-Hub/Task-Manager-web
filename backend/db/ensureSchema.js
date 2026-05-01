const db = require('../config/db');

async function ensureSchema() {
  try {
    // 🔥 STEP 1: CREATE TABLE FIRST
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        email VARCHAR(100) UNIQUE,
        password TEXT,
        role VARCHAR(20),
        job_role VARCHAR(100),
        is_first_login BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 🔥 STEP 2: EXTENSION
    await db.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

    // 🔥 STEP 3: SAFE ALTER
    await db.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS job_role VARCHAR(100)
    `);

    await db.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_first_login BOOLEAN DEFAULT true
    `);

    // 🔥 STEP 4: DATA UPDATE
    await db.query(`
      UPDATE users
      SET job_role = 'Team Member'
      WHERE role = 'member' AND (job_role IS NULL OR btrim(job_role) = '')
    `);

    await db.query(`
      UPDATE users
      SET is_first_login = true
      WHERE role = 'member' AND is_first_login IS NULL
    `);

    await db.query(`
      UPDATE users
      SET is_first_login = false
      WHERE role = 'admin' AND is_first_login IS NULL
    `);

    console.log("Schema ready ✅");
  } catch (err) {
    console.error("Schema error:", err);
  }
}

module.exports = { ensureSchema };