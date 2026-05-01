const express = require('express');
const { getTasks, createTask, updateTaskStatus, getMyTasks } = require('../controllers/taskController');
const { authenticateToken, requireRole } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authenticateToken);

// Project specific tasks
router.get('/projects/:id/tasks', getTasks);
router.post('/projects/:id/tasks', requireRole('admin'), createTask);

// General task updates
router.put('/tasks/:id/status', updateTaskStatus);

// Member specific routes
router.get('/tasks/my', getMyTasks);

module.exports = router;
