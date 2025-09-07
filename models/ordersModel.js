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
            size: {  // Added: Important for shoes
                type: String,
                required: true
            },
            price: {  // Added: Price at time of purchase
                type: Number,
                required: true,
                min: 0
            }
        },
    ],
    total_amount: { type: Number, required: true },
    order_date: { type: Date, default: Date.now },
    order_status: { type: String, default: "Pending" },
}, { timestamps: true });

OrderSchema.index({ user_id: 1, createdAt: -1 });

const Order = mongoose.model("Order", OrderSchema);

module.exports = { Order };
