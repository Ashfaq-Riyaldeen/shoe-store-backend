const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',  // Fixed: was 'products'
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1
    },
    size: {  // Added: Important for shoes
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    }
}, { timestamps: true });

const CartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,  // Not String
        ref: 'User',
        required: true
    },
    items: [CartItemSchema],
    total: {
        type: Number,
        default: 0
    }
});

CartSchema.index({ user: 1 });
const Cart = mongoose.model('Cart', CartSchema);

module.exports = { Cart };