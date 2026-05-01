const db = require('../config/db');
const bcrypt = require('bcrypt');

async function createDefaultAdmin() {
  try {
    const user = await db.query(
      "SELECT * FROM users WHERE email = $1",
      ["admin@test.com"]
    );

    if (user.rows.length === 0) {
      const hashedPassword = await bcrypt.hash("123456", 10);

      await db.query(
        `INSERT INTO users (name, email, password, role, is_first_login)
         VALUES ($1, $2, $3, $4, $5)`,
        ["Admin", "admin@test.com", hashedPassword, "admin", false]
      );

      console.log("Default admin created ✅");
    } else {
      console.log("Admin user already exists ✅");
    }
  } catch (err) {
    console.error("Error creating default admin:", err);
  }
}

async function ensureSchema() {
  try {
    // STEP 1: Enable UUID extension
    await db.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

    // STEP 2: Create users table
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

    // STEP 2b: Rename password_hash to password if old column exists
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

    // STEP 3: Create projects table
    await db.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // STEP 4: Create project_members table
    await db.query(`
      CREATE TABLE IF NOT EXISTS project_members (
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (project_id, user_id)
      );
    `);

    // STEP 5: Create tasks table
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

    // STEP 6: Safe column additions (for existing databases)
    await db.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS job_role VARCHAR(100)
    `);

    await db.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_first_login BOOLEAN DEFAULT true
    `);

    // STEP 7: Data defaults
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

    // Seed default admin if database is empty
    await createDefaultAdmin();
  } catch (err) {
    console.error("Schema error:", err);
  }
}

module.exports = { ensureSchema };