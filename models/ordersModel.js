const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    products: [
        {
            product_id: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Product",
                required: true,
            },
            quantity: { type: Number, required: true },
            size: {  // Important for shoes
                type: String,
                required: true
            },
            price: {  // Price at time of purchase
                type: Number,
                required: true,
                min: 0
            }
        },
    ],
    // UPDATED: Pricing breakdown without tax
    subtotal: { 
        type: Number, 
        required: true,
        min: 0 
    },
    shipping: { 
        type: Number, 
        required: true, 
        default: 0,
        min: 0 
    },
    total_amount: { 
        type: Number, 
        required: true,
        min: 0 
    },
    order_date: { type: Date, default: Date.now },
    order_status: { 
        type: String, 
        enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
        default: "Pending" 
    },
}, { timestamps: true });

// Indexes for better performance
OrderSchema.index({ user_id: 1, createdAt: -1 });
OrderSchema.index({ order_status: 1 });
OrderSchema.index({ createdAt: -1 });

// Virtual to calculate total if needed
OrderSchema.virtual('calculatedTotal').get(function() {
    return this.subtotal + this.shipping; // No tax
});

// Pre-save middleware to ensure total_amount matches calculated total
OrderSchema.pre('save', function(next) {
    const calculatedTotal = this.subtotal + this.shipping; // No tax
    if (Math.abs(this.total_amount - calculatedTotal) > 0.01) {
        this.total_amount = calculatedTotal;
    }
    next();
});

const Order = mongoose.model("Order", OrderSchema);

module.exports = { Order };
