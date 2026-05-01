const express = require('express');
const { getProjects, createProject, getProjectMembers, addMemberToProject, deleteProject } = require('../controllers/projectController');
const { authenticateToken, requireRole } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authenticateToken);

router.get('/', getProjects);
// Only admins can create projects according to our plan considerations
router.post('/', requireRole('admin'), createProject);
router.delete('/:id', requireRole('admin'), deleteProject);

// Project Members
router.get('/:id/members', getProjectMembers);
router.post('/:id/members', requireRole('admin'), addMemberToProject);

module.exports = router;
