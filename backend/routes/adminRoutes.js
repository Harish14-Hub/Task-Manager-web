const express = require('express');
const { createUser, getUsers, getAdminOverview, deleteUser, resetWorkspace } = require('../controllers/adminController');
const { authenticateToken, requireRole } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authenticateToken);
router.use(requireRole('admin'));

router.get('/overview', getAdminOverview);
router.delete('/users/:id', deleteUser);
router.delete('/reset-workspace', resetWorkspace);
router.post('/create-user', createUser);
router.get('/users', getUsers);

module.exports = router;
