const bcrypt = require('bcrypt');
const db = require('../config/db');

async function seedData() {
  try {
    const adminRes = await db.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (adminRes.rows.length === 0) {
      console.log("No admin found. Run seedAdmin.js first.");
      process.exit(1);
    }
    const adminId = adminRes.rows[0].id;

    console.log("Creating 5 members...");
    const members = [];
    for (let i = 1; i <= 5; i++) {
      const email = `member${i}@taskmanager.com`;
      const pass = await bcrypt.hash('password123', 10);
      
      // Check if exists first to avoid conflict errors if run multiple times
      let userRes = await db.query("SELECT id, name FROM users WHERE email = $1", [email]);
      if (userRes.rows.length === 0) {
        userRes = await db.query(
          "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name",
          [`Team Member ${i}`, email, pass, 'member']
        );
      }
      members.push(userRes.rows[0]);
    }

    console.log("Creating project...");
    const projRes = await db.query(
      "INSERT INTO projects (name, description, created_by) VALUES ($1, $2, $3) RETURNING id",
      ['Alpha Project', 'Main team project', adminId]
    );
    const projectId = projRes.rows[0].id;

    console.log("Adding members to project and assigning tasks...");
    for (let i = 0; i < members.length; i++) {
      // Add to project_members so they can see the project
      await db.query(
        "INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)",
        [projectId, members[i].id]
      );

      // Create a task
      await db.query(
        "INSERT INTO tasks (title, description, status, project_id, assigned_to) VALUES ($1, $2, $3, $4, $5)",
        [`Task ${i+1} for ${members[i].name}`, `Please complete this assigned task.`, 'todo', projectId, members[i].id]
      );
    }

    console.log("Successfully created 5 team members, 1 project, and assigned 1 task to each member!");
    process.exit(0);
  } catch (err) {
    console.error("Error seeding data:", err);
    process.exit(1);
  }
}

seedData();
