const bcrypt = require('bcrypt');
const db = require('../config/db');
const { normalizeJobRole } = require('../utils/jobRoles');

const createUser = async (req, res) => {
  try {
    const { name, email, jobRole } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ message: 'Valid name is required.' });
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ message: 'Valid email is required.' });
    }
    const normalizedJobRole = normalizeJobRole(jobRole);
    if (!normalizedJobRole) {
      return res.status(400).json({ message: 'Select a valid member job role.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const defaultPassword = 'password123';

    // Check for duplicate email
    const userExists = await db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (userExists.rows.length > 0) {
      return res.status(409).json({ message: 'User already exists with this email.' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(defaultPassword, saltRounds);

    // Hardcode role to member as per requirements
    const role = 'member';

    const insertQuery = `
      INSERT INTO users (name, email, password, role, job_role, is_first_login)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, email, role, job_role, is_first_login, created_at
    `;
    const result = await db.query(insertQuery, [
      name.trim(),
      normalizedEmail,
      hashedPassword,
      role,
      normalizedJobRole,
      true,
    ]);
    
    res.status(201).json({
      message: 'User created successfully',
      defaultPassword,
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Error creating user:', error);
    if (error.code === '23505') {
      return res.status(409).json({ message: 'User already exists with this email.' });
    }
    res.status(500).json({ message: 'Server error during user creation.' });
  }
};

const getUsers = async (req, res) => {
  try {
    const result = await db.query(
      `
        SELECT id, name, email, COALESCE(job_role, 'Team Member') AS job_role, created_at
        FROM users
        WHERE role = $1
        ORDER BY created_at DESC
      `,
      ['member']
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error fetching users' });
  }
};

const getAdminOverview = async (req, res) => {
  try {
    const userId = String(req.user.id);
    console.log("User ID:", userId, typeof userId);

    const [statsResult, membersResult, projectsResult, tasksResult] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*)::int AS total_tasks,
          COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_tasks,
          COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress_tasks,
          COUNT(*) FILTER (WHERE status <> 'completed' AND due_date IS NOT NULL AND due_date < CURRENT_TIMESTAMP)::int AS overdue_tasks
        FROM tasks
      `),
      db.query(`
        SELECT
          u.id,
          u.name,
          u.email,
          COALESCE(u.job_role, 'Team Member') AS job_role,
          u.created_at,
          COUNT(DISTINCT pm.project_id)::int AS project_count,
          COUNT(t.id)::int AS assigned_task_count,
          COUNT(t.id) FILTER (WHERE t.status = 'completed')::int AS completed_task_count
        FROM users u
        LEFT JOIN project_members pm ON pm.user_id::text = u.id::text
        LEFT JOIN tasks t ON t.assigned_to::text = u.id::text
        WHERE u.role = 'member'
        GROUP BY u.id
        ORDER BY u.created_at DESC
      `),
      db.query(`
        SELECT
          p.id,
          p.name,
          p.description,
          p.created_at,
          COUNT(DISTINCT CASE WHEN u.role = 'member' THEN pm.user_id END)::int AS member_count,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', u.id,
                'name', u.name,
                'email', u.email,
                'role', u.role,
                'job_role', COALESCE(u.job_role, 'Team Member')
              )
            ) FILTER (WHERE u.id IS NOT NULL AND u.role = 'member'),
            '[]'::json
          ) AS members
        FROM projects p
        LEFT JOIN project_members pm ON pm.project_id::text = p.id::text
        LEFT JOIN users u ON u.id::text = pm.user_id::text
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `),
      db.query(`
        SELECT
          t.id,
          t.title,
          t.description,
          t.status,
          t.due_date,
          t.created_at,
          p.id AS project_id,
          p.name AS project_name,
          u.id AS assignee_id,
          u.name AS assignee_name,
          COALESCE(u.job_role, 'Team Member') AS assignee_job_role
        FROM tasks t
        JOIN projects p ON p.id::text = t.project_id::text
        LEFT JOIN users u ON u.id::text = t.assigned_to::text
        ORDER BY t.created_at DESC
      `),
    ]);

    res.json({
      stats: statsResult.rows[0],
      members: membersResult.rows,
      projects: projectsResult.rows,
      tasks: tasksResult.rows,
    });
  } catch (error) {
    console.error('Error fetching admin overview:', error);
    res.status(500).json({ message: 'Server error fetching admin overview.' });
  }
};

const deleteUser = async (req, res) => {
  const client = await db.connect();

  try {
    const { id } = req.params;

    const userResult = await client.query(
      `
        SELECT id, name, email, role
        FROM users
        WHERE id = $1::uuid
      `,
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Member not found.' });
    }

    if (userResult.rows[0].role !== 'member') {
      return res.status(400).json({ message: 'Only member accounts can be deleted.' });
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM tasks WHERE assigned_to = $1::uuid', [id]);
    await client.query('DELETE FROM project_members WHERE user_id = $1::uuid', [id]);
    await client.query('DELETE FROM users WHERE id = $1::uuid', [id]);
    await client.query('COMMIT');

    res.json({
      message: 'Member deleted successfully.',
      user: userResult.rows[0],
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
    console.error('Error deleting member:', error);
    res.status(500).json({ message: 'Server error deleting member.' });
  } finally {
    client.release();
  }
};

const resetWorkspace = async (req, res) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM tasks');
    await client.query('DELETE FROM project_members');
    await client.query('DELETE FROM projects');
    await client.query("DELETE FROM users WHERE role = 'member'");
    await client.query('COMMIT');

    res.json({ message: 'Workspace reset successfully.' });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
    console.error('Error resetting workspace:', error);
    res.status(500).json({ message: 'Server error resetting workspace.' });
  } finally {
    client.release();
  }
};

module.exports = { createUser, getUsers, getAdminOverview, deleteUser, resetWorkspace };
