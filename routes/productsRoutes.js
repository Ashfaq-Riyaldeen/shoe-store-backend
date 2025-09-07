const express = require('express');
const router = express.Router();
const productController = require('../controllers/productsController');
const { isAuth, requireAdmin } = require('../middleware/isAuth');

// Public Routes (no authentication required)
router.get('/', productController.getAllProducts);
router.get('/sizes', productController.getAvailableSizes);
router.get('/colors', productController.getAvailableColors);
router.get('/category/:category', productController.getProductsByCategory);
router.get('/:id', productController.getProductById);

// Admin-only routes (require authentication + admin role)
router.post('/', requireAdmin, productController.createProduct);
router.put('/:id', requireAdmin, productController.updateProduct);
router.put('/:id/quantity', requireAdmin, productController.updateProductQuantity);
router.delete('/:id', requireAdmin, productController.deleteProduct);

module.exports = router;