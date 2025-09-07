const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');

// Authentication Routes
router.post('/register', usersController.registerUser);
router.post('/login', usersController.loginUser);
router.post('/logout', usersController.logoutUser);

module.exports = router;