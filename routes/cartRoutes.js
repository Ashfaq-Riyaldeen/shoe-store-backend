const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { isAuth } = require('../middleware/isAuth');

// Apply authentication to all cart routes
router.use(isAuth);

// Get user's cart (no userId needed in params - uses authenticated user)
router.get('/', cartController.getCartByUserId);

// Add item to cart (no userId needed in params - uses authenticated user)
router.post('/add', cartController.addItemToCart);

// Remove specific item from cart by itemId
router.delete('/item/:itemId', cartController.removeItemFromCart);

// Update item quantity in cart
router.put('/update', cartController.updateItemInCart);

// Clear entire cart (no userId needed in params - uses authenticated user)
router.delete('/clear', cartController.clearCart);

module.exports = router;