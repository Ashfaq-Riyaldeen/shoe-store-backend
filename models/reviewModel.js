// The review is for the website, not for the products

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    reviewHead: {
        type: String,
        required: true
    },
    reviewText: {
        type: String,
        required: true
    },
}, { timestamps: true });

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;