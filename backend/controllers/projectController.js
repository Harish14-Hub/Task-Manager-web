const db = require('../config/db');

// Get projects for logged-in user (Cursor pagination)
const getProjects = async (req, res) => {
  try {
    const { cursor, limit = 20 } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    const parsedLimit = Number.parseInt(limit, 10) || 20;
    let query = `
      SELECT DISTINCT p.id, p.name, p.description, p.created_by, p.created_at
      FROM projects p
      LEFT JOIN project_members pm ON p.id = pm.project_id
    `;
    const params = [];

    if (userRole !== 'admin') {
      params.push(userId);
      query += ` WHERE (pm.user_id = $${params.length} OR p.created_by = $${params.length})`;
    }

    if (cursor) {
      query += params.length > 0 ? ` AND p.created_at < $${params.length + 1}` : ` WHERE p.created_at < $${params.length + 1}`;
      params.push(cursor);
    }

    params.push(parsedLimit);
    query += ` ORDER BY p.created_at DESC LIMIT $${params.length}`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a project (Admin only conceptually, but checking role)
const createProject = async (req, res) => {
  const client = await db.connect();

  try {
    const { name, description, member_ids = [] } = req.body;
    const userId = req.user.id;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ message: 'Project name is required' });
    }

    const memberIds = Array.isArray(member_ids)
      ? [...new Set(member_ids.filter(Boolean))]
      : [];

    if (memberIds.length > 0) {
      const membersResult = await client.query(
        'SELECT id FROM users WHERE role = $1 AND id = ANY($2::uuid[])',
        ['member', memberIds]
      );

      if (membersResult.rows.length !== memberIds.length) {
        return res.status(400).json({ message: 'Only valid team members can be assigned to a project.' });
      }
    }

    // Begin Transaction
    await client.query('BEGIN');

    const result = await client.query(
      'INSERT INTO projects (name, description, created_by) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), description?.trim() || null, userId]
    );

    const project = result.rows[0];

    await client.query(
      'INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)',
      [project.id, userId]
    );

    for (const memberId of memberIds) {
      await client.query(
        'INSERT INTO project_members (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [project.id, memberId]
      );
    }

    await client.query('COMMIT');

    const projectMembersResult = await db.query(
      `
        SELECT u.id, u.name, u.email, u.role, COALESCE(u.job_role, 'Team Member') AS job_role
        FROM users u
        JOIN project_members pm ON pm.user_id = u.id
        WHERE pm.project_id = $1 AND u.role = 'member'
        ORDER BY u.name
      `,
      [project.id]
    );

    res.status(201).json({
      ...project,
      members: projectMembersResult.rows,
      member_count: projectMembersResult.rows.length,
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
    console.error('Error creating project:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
};

const getProjectMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT u.id, u.name, u.email, u.role, COALESCE(u.job_role, 'Team Member') AS job_role
      FROM users u
      JOIN project_members pm ON u.id = pm.user_id
      WHERE pm.project_id = $1 AND u.role = 'member'
      ORDER BY u.name
    `;
    const result = await db.query(query, [id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching project members:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const addMemberToProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const memberResult = await db.query(
      `
        SELECT id, name, email, COALESCE(job_role, 'Team Member') AS job_role
        FROM users
        WHERE id = $1 AND role = $2
      `,
      [user_id, 'member']
    );

    if (memberResult.rows.length === 0) {
      return res.status(400).json({ message: 'Only existing team members can be added to a project.' });
    }

    // Check if user already in project
    const checkUser = await db.query(
      'SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2',
      [id, user_id]
    );

    if (checkUser.rows.length > 0) {
      return res.status(400).json({ message: 'User is already a member of this project' });
    }

    await db.query(
      'INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)',
      [id, user_id]
    );

    res.status(201).json({
      message: 'Member added to project successfully',
      member: memberResult.rows[0],
    });
  } catch (error) {
    console.error('Error adding member to project:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    const projectResult = await db.query(
      `
        SELECT id, name
        FROM projects
        WHERE id = $1
      `,
      [id]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    await db.query('DELETE FROM projects WHERE id = $1', [id]);

    res.json({
      message: 'Project deleted successfully.',
      project: projectResult.rows[0],
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ message: 'Server error deleting project.' });
  }
};

module.exports = { getProjects, createProject, getProjectMembers, addMemberToProject, deleteProject };
