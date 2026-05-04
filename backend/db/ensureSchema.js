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

      console.log("✅ Default admin created");
    } else {
      console.log("✅ Admin already exists");
    }
  } catch (err) {
    console.error("❌ Admin error:", err.message);
  }
}

async function ensureSchema() {
  console.log("🚀 ensureSchema started...");

  try {
    // Extension
    try {
      await db.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
    } catch {
      console.log("⚠️ pgcrypto not allowed");
    }

    // DB test
    await db.query("SELECT 1");
    console.log("✅ DB connected");

    // USERS
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT DEFAULT 'member',
          job_role TEXT,
          is_first_login BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log("✅ users ready");
    } catch (err) {
      console.log("❌ users error:", err.message);
    }

    // PROJECTS
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS projects (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          description TEXT,
          created_by UUID,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log("✅ projects ready");
    } catch (err) {
      console.log("❌ projects error:", err.message);
    }

    // PROJECT MEMBERS
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS project_members (
          project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          PRIMARY KEY (project_id, user_id)
        );
      `);
      console.log("✅ project_members ready");
    } catch (err) {
      console.log("❌ project_members error:", err.message);
    }

    // TASKS
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS tasks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
          title TEXT,
          description TEXT,
          status TEXT DEFAULT 'todo',
          assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
          due_date TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log("✅ tasks ready");
    } catch (err) {
      console.log("❌ tasks error:", err.message);
    }

    console.log("🎉 All schema attempts done");

    await createDefaultAdmin();

  } catch (err) {
    console.error("❌ Fatal schema error:", err.message);
  }
}

module.exports = { ensureSchema };