const db = require('../config/db');

const getDashboardStats = async (req, res) => {
  try {
    const userId = String(req.user.id);
    const userRole = req.user.role;

    console.log("User ID:", userId, typeof userId);

    if (userRole === 'admin') {
      // Admin sees global stats
      const statsQuery = `
        SELECT 
          COUNT(t.id)::int as total_tasks,
          COUNT(t.id) FILTER (WHERE t.status = 'completed')::int as completed_tasks,
          COUNT(t.id) FILTER (WHERE t.status = 'in_progress')::int as in_progress_tasks,
          COUNT(t.id) FILTER (WHERE t.status != 'completed' AND t.due_date IS NOT NULL AND t.due_date < CURRENT_TIMESTAMP)::int as overdue_tasks
        FROM tasks t
      `;
      const statsResult = await db.query(statsQuery);
      
      const memberStatsQuery = `
        SELECT u.name as member_name, COUNT(t.id) as total
        FROM tasks t
        JOIN users u ON t.assigned_to::text = u.id::text
        GROUP BY u.name
      `;
      const membersResult = await db.query(memberStatsQuery);
      
      res.json({
        ...statsResult.rows[0],
        members_stats: membersResult.rows
      });
    } else {
      // Member sees their own stats
      const query = `
        SELECT 
          COUNT(t.id)::int as total_tasks,
          COUNT(t.id) FILTER (WHERE t.status = 'completed')::int as completed_tasks,
          COUNT(t.id) FILTER (WHERE t.status = 'in_progress')::int as in_progress_tasks,
          COUNT(t.id) FILTER (WHERE t.status != 'completed' AND t.due_date IS NOT NULL AND t.due_date < CURRENT_TIMESTAMP)::int as overdue_tasks
        FROM tasks t
        WHERE t.assigned_to = $1::uuid
      `;
      const result = await db.query(query, [userId]);
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getDashboardStats };
