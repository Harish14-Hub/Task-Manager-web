const db = require('../config/db');
const bcrypt = require('bcrypt');

// ---------------------------------------------------------------------------
// Helper: Check if gen_random_uuid() is available (pgcrypto or PG >= 13 built-in)
// ---------------------------------------------------------------------------
async function ensureUuidSupport() {
  try {
    // Try enabling pgcrypto — works on most hosted Postgres instances
    await db.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    console.log('[ensureSchema] pgcrypto extension enabled ✅');
  } catch (err) {
    // Render free tier (and some others) disallow CREATE EXTENSION
    console.warn('[ensureSchema] pgcrypto extension could not be enabled (this is OK on PG >= 13):', err.message);
  }

  // Verify gen_random_uuid() actually works regardless of how it was provided
  try {
    await db.query('SELECT gen_random_uuid()');
    console.log('[ensureSchema] gen_random_uuid() is available ✅');
  } catch (err) {
    // Fatal — we rely on UUID generation
    console.error('[ensureSchema] gen_random_uuid() is NOT available. Cannot proceed.');
    throw new Error('gen_random_uuid() is not available. Ensure PostgreSQL >= 13 or enable pgcrypto.');
  }
}

// ---------------------------------------------------------------------------
// Create default admin user (idempotent)
// ---------------------------------------------------------------------------
async function createDefaultAdmin() {
  try {
    const user = await db.query(
      'SELECT id FROM users WHERE email = $1',
      ['admin@test.com']
    );

    if (user.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('123456', 10);

      await db.query(
        `INSERT INTO users (name, email, password, role, is_first_login)
         VALUES ($1, $2, $3, $4, $5)`,
        ['Admin', 'admin@test.com', hashedPassword, 'admin', false]
      );

      console.log('[ensureSchema] Default admin created ✅');
    } else {
      console.log('[ensureSchema] Admin user already exists ✅');
    }
  } catch (err) {
    // Non-fatal — app can still run without the seed admin
    console.error('[ensureSchema] Error creating default admin:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Main schema initializer — idempotent & safe for production
// ---------------------------------------------------------------------------
async function ensureSchema() {
  console.log('[ensureSchema] started');

  // ── Step 1: Test database connectivity ──────────────────────────────────
  try {
    await db.query('SELECT 1');
    console.log('[ensureSchema] Database connection OK ✅');
  } catch (err) {
    console.error('[ensureSchema] Database connection FAILED:', err.message);
    throw new Error('Cannot connect to database');
  }

  // ── Step 2: Ensure UUID support ─────────────────────────────────────────
  await ensureUuidSupport();

  // ── Step 3: Create tables (order matters — foreign keys) ────────────────
  try {
    // 3a — users
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) CHECK (role IN ('admin', 'member')) DEFAULT 'member',
        job_role VARCHAR(100),
        is_first_login BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[ensureSchema] Table "users" ready ✅');

    // 3b — projects
    await db.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[ensureSchema] Table "projects" ready ✅');

    // 3c — project_members
    await db.query(`
      CREATE TABLE IF NOT EXISTS project_members (
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (project_id, user_id)
      );
    `);
    console.log('[ensureSchema] Table "project_members" ready ✅');

    // 3d — tasks
    await db.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) CHECK (status IN ('todo', 'in_progress', 'completed')) DEFAULT 'todo',
        assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
        due_date TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[ensureSchema] Table "tasks" ready ✅');
  } catch (err) {
    console.error('[ensureSchema] CRITICAL — table creation failed:', err.message);
    throw err; // Let server.js handle the fatal error
  }

  // ── Step 4: Safe column migrations (for existing databases) ─────────────
  try {
    // Rename legacy password_hash → password
    await db.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'password_hash'
        ) THEN
          ALTER TABLE users RENAME COLUMN password_hash TO password;
        END IF;
      END $$;
    `);

    await db.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS job_role VARCHAR(100)
    `);

    await db.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_first_login BOOLEAN DEFAULT true
    `);

    console.log('[ensureSchema] Column migrations done ✅');
  } catch (err) {
    // Non-fatal — columns may already exist
    console.warn('[ensureSchema] Column migration warning:', err.message);
  }

  // ── Step 5: Data defaults ───────────────────────────────────────────────
  try {
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

    console.log('[ensureSchema] Data defaults applied ✅');
  } catch (err) {
    // Non-fatal
    console.warn('[ensureSchema] Data defaults warning:', err.message);
  }

  // ── Step 6: Seed default admin ──────────────────────────────────────────
  await createDefaultAdmin();

  console.log('[ensureSchema] Schema ready 🚀');
}

module.exports = { ensureSchema };