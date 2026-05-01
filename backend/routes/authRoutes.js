const express = require('express');
const { register, login, changePassword } = require('../controllers/authController');
const { authenticateToken } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/change-password', authenticateToken, changePassword);

module.exports = router;
