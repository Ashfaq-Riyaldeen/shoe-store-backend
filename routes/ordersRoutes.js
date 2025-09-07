const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/ordersController');
const { isAuth, requireAdmin } = require('../middleware/isAuth');

// Apply authentication to all order routes
router.use(isAuth);

// Admin-only routes (must come before parameterized routes)
// Get all orders with filtering and pagination (admin only)
router.get('/admin/all', requireAdmin, ordersController.getAllOrders);

// Get order statistics (admin only)
router.get('/admin/stats', requireAdmin, ordersController.getOrderStats);

// Get current user's orders (authenticated users can only see their own orders)
router.get('/my-orders', ordersController.getUserOrders);

// Create a new order (authenticated users only)
router.post('/', ordersController.createOrder);

// Get specific order by ID (users can only view their own orders, admins can view any)
router.get('/:id', ordersController.getOrderById);

// Update order status (admin only)
router.put('/:id/status', requireAdmin, ordersController.updateOrderStatus);

// Delete order (admin only, or users can delete their own pending orders)
router.delete('/:id', ordersController.deleteOrder);

module.exports = router;