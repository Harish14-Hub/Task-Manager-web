const db = require('../config/db');

async function ensureSchema() {
  await db.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
  await db.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS job_role VARCHAR(100)
  `);
  await db.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_first_login BOOLEAN DEFAULT true
  `);
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
}

module.exports = { ensureSchema };
