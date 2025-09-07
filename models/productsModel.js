const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    quantity: { type: Number, required: true },
    productImg: { type: String },
    // productImgs: [{ type: String }],
    attributes: {
        color: { type: String },
        sizes: [{ type: String }], 
    },
    price: { type: Number, required: true },
    categories: [{ 
        type: String,
        enum: ['Men', 'Women']
    }],
});

ProductSchema.index({ name: 'text', description: 'text' });
ProductSchema.index({ categories: 1 });
ProductSchema.index({ price: 1 });

const Product = mongoose.model('Product', ProductSchema);

module.exports = { Product };