const mongoose = require('mongoose');
const { Cart } = require('../models/cartModel');
const { Product } = require('../models/productsModel');

// Input sanitization helper
const sanitizeInput = (input) => {
    if (typeof input === 'string') {
        return input.trim().replace(/[<>]/g, ''); // Basic XSS prevention
    }
    return input;
};

const getCartByUserId = async (req, res) => {
    try {
        // Security: Use authenticated user ID instead of params
        const userId = req.user.id;
        
        const cart = await Cart.findOne({ user: userId });

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }        

        const populatedCart = await populateCartItems(cart);
        res.status(200).json(populatedCart);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Function to manually populate cart items with product details
const populateCartItems = async (cart) => {
    const populatedItems = await Promise.all(cart.items.map(async (item) => {
        const product = await Product.findById(item.product);
        if (!product) {
            return null;
        }
        return { 
            ...item.toObject(), 
            product: { 
                id: product._id, 
                img: product.productImg, 
                name: product.name, 
                price: product.price,
                availableSizes: product.attributes.sizes
            } 
        };
    }));

    const validItems = populatedItems.filter(item => item !== null);
    return { ...cart.toObject(), items: validItems };
};

// FIXED: Add item to cart with proper security
const addItemToCart = async (req, res) => {
    const { productId, quantity = 1, size } = req.body;
    const user = req.user.id; // Get from authenticated user
    
    try {
        // Validate and sanitize inputs
        if (!productId || !size) {
            return res.status(400).json({ 
                message: 'ProductId and size are required' 
            });
        }

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Invalid product ID format' });
        }

        const sanitizedSize = sanitizeInput(size);
        const parsedQuantity = parseInt(quantity);

        if (parsedQuantity <= 0 || parsedQuantity > 10) { // Add max quantity limit
            return res.status(400).json({ 
                message: 'Quantity must be between 1 and 10' 
            });
        }

        // Check if the product exists and get current price
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Check product availability
        if (product.quantity < parsedQuantity) {
            return res.status(400).json({ 
                message: `Only ${product.quantity} items available in stock` 
            });
        }

        // Check if the requested size is available
        if (!product.attributes.sizes.includes(sanitizedSize)) {
            return res.status(400).json({ 
                message: `Size ${sanitizedSize} is not available for this product` 
            });
        }

        // Use current product price (prevent price manipulation)
        const itemPrice = product.price;

        let cart = await Cart.findOne({ user });
        if (!cart) {
            cart = new Cart({ user, items: [], total: 0 });
        }

        // Check if the same product with same size already exists
        const existingItemIndex = cart.items.findIndex(item => 
            item.product.toString() === productId && item.size === sanitizedSize
        );
        
        if (existingItemIndex !== -1) {
            // Update quantity if item already exists
            const newQuantity = cart.items[existingItemIndex].quantity + parsedQuantity;
            
            // Check if new quantity exceeds stock
            if (newQuantity > product.quantity) {
                return res.status(400).json({ 
                    message: `Cannot add ${parsedQuantity} more. Only ${product.quantity - cart.items[existingItemIndex].quantity} more available.` 
                });
            }
            
            cart.items[existingItemIndex].quantity = newQuantity;
        } else {
            // Add new item to cart
            cart.items.push({ 
                product: productId, 
                quantity: parsedQuantity, 
                size: sanitizedSize, 
                price: itemPrice 
            });
        }
        
        // Recalculate total
        cart.total = cart.items.reduce((total, item) => 
            total + (item.quantity * item.price), 0
        );

        await cart.save();
        
        const populatedCart = await populateCartItems(cart);
        res.status(201).json(populatedCart);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// FIXED: Remove item from cart with proper user verification
const removeItemFromCart = async (req, res) => {
    try {
        const { itemId } = req.params;
        const userId = req.user.id; // Use authenticated user

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(itemId)) {
            return res.status(400).json({ message: 'Invalid item ID format' });
        }

        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        const itemIndex = cart.items.findIndex(item => 
            item._id.toString() === itemId
        );

        if (itemIndex === -1) {
            return res.status(404).json({ message: 'Item not found in cart' });
        }

        // Remove the item
        cart.items.splice(itemIndex, 1);
        
        // Recalculate total
        cart.total = cart.items.reduce((total, item) => 
            total + (item.quantity * item.price), 0
        );

        await cart.save();

        const populatedCart = await populateCartItems(cart);
        res.status(200).json(populatedCart);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// FIXED: Update item quantity with proper validation
const updateItemInCart = async (req, res) => {
    try {
        const { itemId, quantity } = req.body;
        const userId = req.user.id; // Use authenticated user

        if (!itemId || quantity === undefined) {
            return res.status(400).json({ 
                message: 'ItemId and quantity are required' 
            });
        }

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(itemId)) {
            return res.status(400).json({ message: 'Invalid item ID format' });
        }

        const parsedQuantity = parseInt(quantity);
        if (parsedQuantity < 0 || parsedQuantity > 10) {
            return res.status(400).json({ 
                message: 'Quantity must be between 0 and 10' 
            });
        }

        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        const itemIndex = cart.items.findIndex(cartItem => 
            cartItem._id.toString() === itemId
        );

        if (itemIndex === -1) {
            return res.status(404).json({ message: 'Item not found in cart' });
        }

        if (parsedQuantity === 0) {
            // Remove item if quantity is 0
            cart.items.splice(itemIndex, 1);
        } else {
            // Check product availability before updating
            const product = await Product.findById(cart.items[itemIndex].product);
            if (product && parsedQuantity > product.quantity) {
                return res.status(400).json({ 
                    message: `Only ${product.quantity} items available in stock` 
                });
            }
            
            cart.items[itemIndex].quantity = parsedQuantity;
        }

        // Recalculate total
        cart.total = cart.items.reduce((total, item) => 
            total + (item.quantity * item.price), 0
        );

        await cart.save();

        const populatedCart = await populateCartItems(cart);
        res.status(200).json(populatedCart);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// FIXED: Clear cart with proper user verification
const clearCart = async (req, res) => {
    try {
        const userId = req.user.id; // Use authenticated user
        
        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }
        
        cart.items = [];
        cart.total = 0;
        await cart.save();
        
        res.status(200).json(cart);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = {
    getCartByUserId,
    addItemToCart,
    removeItemFromCart,
    updateItemInCart,
    clearCart,
};