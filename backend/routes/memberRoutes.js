const express = require('express');
const { getUsers } = require('../controllers/adminController');
const { authenticateToken, requireRole } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authenticateToken);
router.use(requireRole('admin'));

router.get('/', getUsers);

module.exports = router;
