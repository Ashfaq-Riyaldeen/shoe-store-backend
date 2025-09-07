const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { isAuth, requireAdmin } = require('../middleware/isAuth');

// Public Routes (no authentication required)
router.get('/', reviewController.getAllReviews);
router.get('/stats', reviewController.getReviewStats);
router.get('/:id', reviewController.getReviewById);

// Authenticated Routes (require user to be logged in)
router.post('/', isAuth, reviewController.createReview);
router.get('/user/:userId', isAuth, reviewController.getReviewsByUserId);
router.put('/:id', isAuth, reviewController.updateReview);
router.delete('/:id', isAuth, reviewController.deleteReview);

module.exports = router;