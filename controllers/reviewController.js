const Review = require('../models/reviewModel');
const { User } = require('../models/usersModel');
const mongoose = require('mongoose');

// Controller method to create a new review
const createReview = async (req, res) => {
    try {
        const { userId, rating, reviewHead, reviewText } = req.body;

        // Validate required fields
        if (!userId || !rating || !reviewHead || !reviewText) {
            return res.status(400).json({
                message: 'All fields are required: userId, rating, reviewHead, reviewText'
            });
        }

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid user ID format' });
        }

        // Validate rating range
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({
                message: 'Rating must be an integer between 1 and 5'
            });
        }

        // Validate string fields
        if (typeof reviewHead !== 'string' || reviewHead.trim().length === 0) {
            return res.status(400).json({
                message: 'Review head must be a non-empty string'
            });
        }

        if (typeof reviewText !== 'string' || reviewText.trim().length === 0) {
            return res.status(400).json({
                message: 'Review text must be a non-empty string'
            });
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if user already has a review (optional - you might want to allow multiple reviews)
        const existingReview = await Review.findOne({ userId });
        if (existingReview) {
            return res.status(409).json({
                message: 'User has already submitted a review. Use update instead.'
            });
        }

        // Validate review length (reasonable limits)
        if (reviewHead.trim().length > 200) {
            return res.status(400).json({
                message: 'Review head must be 200 characters or less'
            });
        }

        if (reviewText.trim().length > 2000) {
            return res.status(400).json({
                message: 'Review text must be 2000 characters or less'
            });
        }

        // Create review with trimmed text
        const reviewData = {
            userId,
            rating,
            reviewHead: reviewHead.trim(),
            reviewText: reviewText.trim()
        };

        const review = new Review(reviewData);
        await review.save();

        // Populate user data before returning
        const populatedReview = await Review.findById(review._id)
            .populate('userId', 'username email');

        res.status(201).json(populatedReview);
    } catch (error) {
        console.error('Error creating review:', error);
        
        // Handle mongoose validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: 'Validation Error',
                errors
            });
        }
        
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Controller method to get all reviews with filtering and pagination
const getAllReviews = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            rating,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build filter object
        const filter = {};
        
        // Filter by rating if provided
        if (rating) {
            const ratingNum = parseInt(rating);
            if (ratingNum >= 1 && ratingNum <= 5) {
                filter.rating = ratingNum;
            } else {
                return res.status(400).json({
                    message: 'Rating filter must be between 1 and 5'
                });
            }
        }

        // Build sort object
        const sort = {};
        const validSortFields = ['rating', 'createdAt', 'updatedAt'];
        if (validSortFields.includes(sortBy)) {
            sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
        } else {
            sort.createdAt = -1; // Default sort
        }

        // Calculate pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Get reviews with pagination and population
        const reviews = await Review.find(filter)
            .populate('userId', 'username email')
            .sort(sort)
            .skip(skip)
            .limit(limitNum);

        // Get total count for pagination
        const totalReviews = await Review.countDocuments(filter);
        const totalPages = Math.ceil(totalReviews / limitNum);

        // Calculate average rating
        const ratingStats = await Review.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    averageRating: { $avg: '$rating' },
                    totalReviews: { $sum: 1 },
                    ratingDistribution: {
                        $push: '$rating'
                    }
                }
            }
        ]);

        // Count reviews by rating
        const ratingCounts = await Review.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: '$rating',
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const response = {
            reviews,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalReviews,
                hasNextPage: pageNum < totalPages,
                hasPrevPage: pageNum > 1
            },
            statistics: {
                averageRating: ratingStats[0]?.averageRating || 0,
                totalReviews: ratingStats[0]?.totalReviews || 0,
                ratingBreakdown: ratingCounts
            }
        };

        res.json(response);
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Controller method to get a single review by ID
const getReviewById = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid review ID format' });
        }

        const review = await Review.findById(id)
            .populate('userId', 'username email');
            
        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }
        
        res.json(review);
    } catch (error) {
        console.error('Error fetching review:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Controller method to get reviews by user ID
const getReviewsByUserId = async (req, res) => {
    try {
        const { userId } = req.params;

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid user ID format' });
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const reviews = await Review.find({ userId })
            .populate('userId', 'username email')
            .sort({ createdAt: -1 });

        res.json({
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            },
            reviews
        });
    } catch (error) {
        console.error('Error fetching user reviews:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Controller method to update a review
const updateReview = async (req, res) => {
    try {
        const { id } = req.params;
        const { rating, reviewHead, reviewText } = req.body;

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid review ID format' });
        }

        // Find existing review
        const existingReview = await Review.findById(id);
        if (!existingReview) {
            return res.status(404).json({ message: 'Review not found' });
        }

        // Build update object with validation
        const updateData = {};

        if (rating !== undefined) {
            if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
                return res.status(400).json({
                    message: 'Rating must be an integer between 1 and 5'
                });
            }
            updateData.rating = rating;
        }

        if (reviewHead !== undefined) {
            if (typeof reviewHead !== 'string' || reviewHead.trim().length === 0) {
                return res.status(400).json({
                    message: 'Review head must be a non-empty string'
                });
            }
            if (reviewHead.trim().length > 200) {
                return res.status(400).json({
                    message: 'Review head must be 200 characters or less'
                });
            }
            updateData.reviewHead = reviewHead.trim();
        }

        if (reviewText !== undefined) {
            if (typeof reviewText !== 'string' || reviewText.trim().length === 0) {
                return res.status(400).json({
                    message: 'Review text must be a non-empty string'
                });
            }
            if (reviewText.trim().length > 2000) {
                return res.status(400).json({
                    message: 'Review text must be 2000 characters or less'
                });
            }
            updateData.reviewText = reviewText.trim();
        }

        // Update review
        const updatedReview = await Review.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate('userId', 'username email');

        res.json(updatedReview);
    } catch (error) {
        console.error('Error updating review:', error);
        
        // Handle mongoose validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: 'Validation Error',
                errors
            });
        }
        
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Controller method to delete a review by ID
const deleteReview = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid review ID format' });
        }

        const review = await Review.findByIdAndDelete(id);
        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }
        
        res.json({ 
            message: 'Review deleted successfully',
            deletedReview: review
        });
    } catch (error) {
        console.error('Error deleting review:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Get review statistics
const getReviewStats = async (req, res) => {
    try {
        const stats = await Review.aggregate([
            {
                $group: {
                    _id: null,
                    totalReviews: { $sum: 1 },
                    averageRating: { $avg: '$rating' },
                    maxRating: { $max: '$rating' },
                    minRating: { $min: '$rating' }
                }
            }
        ]);

        const ratingDistribution = await Review.aggregate([
            {
                $group: {
                    _id: '$rating',
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const recentReviews = await Review.find()
            .populate('userId', 'username')
            .sort({ createdAt: -1 })
            .limit(5);

        res.json({
            overview: stats[0] || {
                totalReviews: 0,
                averageRating: 0,
                maxRating: 0,
                minRating: 0
            },
            ratingDistribution,
            recentReviews
        });
    } catch (error) {
        console.error('Error fetching review stats:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = {
    createReview,
    getAllReviews,
    getReviewById,
    getReviewsByUserId,
    updateReview,
    deleteReview,
    getReviewStats
};