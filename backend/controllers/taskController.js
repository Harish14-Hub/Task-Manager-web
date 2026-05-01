const db = require('../config/db');

// Get tasks with cursor pagination and optimized JOINs
const getTasks = async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { cursor, limit = 50 } = req.query;
    const userRole = req.user.role;
    const userId = req.user.id;

    let query = `
      SELECT t.id, t.title, t.description, t.status, t.due_date, t.created_at,
             u.id as assignee_id, u.name as assignee_name, u.email as assignee_email,
             p.name as project_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.project_id = $1
    `;
    const params = [projectId, parseInt(limit)];
    let paramIndex = 3;

    // Members only see tasks assigned to them
    if (userRole === 'member') {
      query += ` AND t.assigned_to = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    // Cursor-based pagination on created_at
    if (cursor) {
      query += ` AND t.created_at < $${paramIndex}`;
      params.push(cursor);
    }

    query += ` ORDER BY t.created_at DESC LIMIT $2`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create task
const createTask = async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { title, description, assigned_to, due_date } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ message: 'Task title is required' });
    }
    if (!assigned_to) {
      return res.status(400).json({ message: 'Task must be assigned to a member' });
    }

    const projectCheck = await db.query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Validate that the assigned user is actually a member of the project
    const memberCheck = await db.query(
      `
        SELECT 1
        FROM project_members pm
        JOIN users u ON u.id = pm.user_id
        WHERE pm.project_id = $1 AND pm.user_id = $2 AND u.role = 'member'
      `,
      [projectId, assigned_to]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(400).json({ message: 'Assigned user must be a member of this project' });
    }

    const result = await db.query(
      `INSERT INTO tasks (project_id, title, description, assigned_to, due_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [projectId, title.trim(), description?.trim() || null, assigned_to, due_date || null]
    );

    const createdTask = await db.query(
      `
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
          u.email AS assignee_email
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        LEFT JOIN users u ON u.id = t.assigned_to
        WHERE t.id = $1
      `,
      [result.rows[0].id]
    );

    res.status(201).json(createdTask.rows[0]);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update task status
const updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['todo', 'in_progress', 'completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const taskResult = await db.query(
      'SELECT id, assigned_to FROM tasks WHERE id = $1',
      [id]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (req.user.role === 'member' && taskResult.rows[0].assigned_to !== req.user.id) {
      return res.status(403).json({ message: 'You can only update tasks assigned to you.' });
    }

    const result = await db.query(
      `
        UPDATE tasks
        SET status = $1
        WHERE id = $2
        RETURNING id, project_id, title, description, status, due_date, created_at, assigned_to
      `,
      [status, id]
    );

    const updatedTask = await db.query(
      `
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
          u.email AS assignee_email
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        LEFT JOIN users u ON u.id = t.assigned_to
        WHERE t.id = $1
      `,
      [result.rows[0].id]
    );

    res.json(updatedTask.rows[0]);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get tasks assigned to logged-in user across all projects
const getMyTasks = async (req, res) => {
  try {
    const userId = req.user.id;
    const query = `
      SELECT t.id, t.title, t.description, t.status, t.due_date, t.created_at,
             p.id as project_id, p.name as project_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.assigned_to = $1
      ORDER BY t.created_at DESC
    `;
    const result = await db.query(query, [userId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching my tasks:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getTasks, createTask, updateTaskStatus, getMyTasks };
