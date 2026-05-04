const express = require('express');
const { getDashboardStats } = require('../controllers/dashboardController');
const { getAdminOverview } = require('../controllers/adminController');
const { authenticateToken, requireRole } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authenticateToken);

router.get('/overview', requireRole('admin'), getAdminOverview);
router.get('/stats', getDashboardStats);

module.exports = router;
