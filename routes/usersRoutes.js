const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const { isAuth, requireAdmin } = require('../middleware/isAuth');

// Public Routes (no authentication required)
router.post('/register', usersController.registerUser);
router.post('/login', usersController.loginUser);
router.post('/logout', usersController.logoutUser);

// Authenticated Routes (require user to be logged in)
router.get('/profile', isAuth, usersController.getUserDetails);
router.put('/profile', isAuth, usersController.updateUser);
router.put('/change-password/:userId', isAuth, usersController.changePassword);

// Admin-only routes (require authentication + admin role)
router.get('/admin/all', requireAdmin, usersController.getAllUsers);
router.get('/admin/:userId', requireAdmin, usersController.getUserDetailsFromId);
router.put('/admin/:userId', requireAdmin, usersController.updateUser);
router.delete('/admin/:userId', requireAdmin, usersController.deleteUser);

module.exports = router;