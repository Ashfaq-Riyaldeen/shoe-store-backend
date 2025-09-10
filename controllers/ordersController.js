const { Order } = require('../models/ordersModel');
const { Product } = require('../models/productsModel');
const { Cart } = require('../models/cartModel');
const mongoose = require('mongoose');

// Helper function to calculate order totals
const calculateOrderTotals = (subtotal) => {
    const shipping = subtotal > 100 ? 0 : 10; // Free shipping over $100
    const tax = subtotal * 0.08; // 8% tax
    const total = subtotal + shipping + tax;
    
    return {
        subtotal,
        shipping,
        tax,
        total
    };
};

const getAllOrders = async (req, res) => {
    try {
        // Add pagination for better performance
        const {
            page = 1,
            limit = 20,
            status,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const filter = {};
        if (status) {
            const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
            if (validStatuses.includes(status)) {
                filter.order_status = status;
            }
        }

        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const orders = await Order.find(filter)
            .populate('user_id', 'username email')
            .populate('products.product_id', 'name price productImg attributes')
            .sort(sort)
            .skip(skip)
            .limit(limitNum);

        const totalOrders = await Order.countDocuments(filter);

        res.status(200).json({
            orders,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(totalOrders / limitNum),
                totalOrders
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const getUserOrders = async (req, res) => {
    try {
        // Use authenticated user ID for security
        const userId = req.user.id;

        const userOrders = await Order.find({ user_id: userId })
            .populate('products.product_id', 'name price productImg attributes')
            .sort({ createdAt: -1 });
            
        res.json(userOrders);
    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// IMPROVED: Create order with proper total calculation
const createOrder = async (req, res) => {
    const { products, total_amount } = req.body;
    const userId = req.user.id; // Get from authenticated user

    // Start a MongoDB session for transaction
    const session = await mongoose.startSession();

    try {
        // Validate required fields
        if (!products || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ 
                message: 'Products array is required and cannot be empty' 
            });
        }

        // Start transaction
        await session.withTransaction(async () => {
            const orderProducts = [];
            let calculatedSubtotal = 0;

            // Process each product in the order
            for (const item of products) {
                // Validate required fields for each product
                if (!item.product_id || !item.quantity || !item.size) {
                    throw new Error('Each product must have product_id, quantity, and size');
                }

                // Validate product_id format
                if (!mongoose.Types.ObjectId.isValid(item.product_id)) {
                    throw new Error(`Invalid product ID format: ${item.product_id}`);
                }

                // Validate quantity
                const quantity = parseInt(item.quantity);
                if (quantity <= 0 || quantity > 10) {
                    throw new Error(`Invalid quantity: ${quantity}. Must be between 1 and 10`);
                }

                // Fetch product details with session for consistency
                const product = await Product.findById(item.product_id).session(session);
                if (!product) {
                    throw new Error(`Product with id ${item.product_id} not found`);
                }

                // Validate size availability
                if (!product.attributes.sizes.includes(item.size)) {
                    throw new Error(`Size ${item.size} is not available for product ${product.name}`);
                }

                // Check product quantity with atomic operation
                if (product.quantity < quantity) {
                    throw new Error(`Insufficient quantity for product ${product.name}. Available: ${product.quantity}, Requested: ${quantity}`);
                }

                // Use current product price to prevent manipulation
                const currentPrice = product.price;
                const itemTotal = currentPrice * quantity;
                calculatedSubtotal += itemTotal;

                // Update product quantity atomically
                const updateResult = await Product.updateOne(
                    { 
                        _id: item.product_id, 
                        quantity: { $gte: quantity } // Ensure quantity hasn't changed
                    },
                    { $inc: { quantity: -quantity } },
                    { session }
                );

                if (updateResult.modifiedCount === 0) {
                    throw new Error(`Failed to update inventory for product ${product.name}. Possibly sold out.`);
                }

                // Prepare order product object
                orderProducts.push({
                    product_id: item.product_id,
                    quantity: quantity,
                    size: item.size,
                    price: currentPrice
                });
            }

            // IMPROVED: Calculate all totals including shipping and tax
            const orderTotals = calculateOrderTotals(calculatedSubtotal);

            // Validate subtotal if provided (more flexible validation)
            if (total_amount && Math.abs(calculatedSubtotal - total_amount) > 0.01) {
                console.warn(`Subtotal mismatch. Calculated: ${calculatedSubtotal}, Provided: ${total_amount}. Using calculated value.`);
            }

            // Create and save the order with calculated totals
            const newOrder = new Order({
                user_id: userId,
                products: orderProducts,
                total_amount: orderTotals.total, // Use calculated total including shipping
                subtotal: orderTotals.subtotal,
                shipping: orderTotals.shipping
            });

            await newOrder.save({ session });

            // Clear user's cart after successful order
            await Cart.findOneAndUpdate(
                { user: userId },
                { items: [], total: 0 },
                { session }
            );

            // Store order reference for response
            res.locals.savedOrder = newOrder;
        });

        // Transaction completed successfully
        // Populate the saved order before returning
        const populatedOrder = await Order.findById(res.locals.savedOrder._id)
            .populate('user_id', 'username email')
            .populate('products.product_id', 'name price productImg attributes');

        res.status(201).json(populatedOrder);

    } catch (error) {
        console.error('Error creating order:', error);
        
        // Handle specific error types
        if (error.message.includes('Invalid') || error.message.includes('required')) {
            return res.status(400).json({ message: error.message });
        }
        
        if (error.message.includes('not found') || error.message.includes('not available')) {
            return res.status(404).json({ message: error.message });
        }
        
        if (error.message.includes('Insufficient') || error.message.includes('sold out')) {
            return res.status(409).json({ message: error.message });
        }
        
        res.status(500).json({ message: 'Internal Server Error' });
    } finally {
        await session.endSession();
    }
};

const getOrderById = async (req, res) => {
    const orderId = req.params.id;

    try {
        // Validate orderId format
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ message: 'Invalid order ID format' });
        }

        const order = await Order.findById(orderId)
            .populate('user_id', 'username email phone_number address')
            .populate('products.product_id', 'name price productImg attributes');
            
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Security: Non-admin users can only view their own orders
        if (req.user.role !== 'admin' && order.user_id._id.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        res.status(200).json(order);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// FIXED: Update order status with proper validation and inventory management
const updateOrderStatus = async (req, res) => {
    const orderId = req.params.id;
    const { status } = req.body;

    const session = await mongoose.startSession();

    try {
        // Validate orderId format
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ message: 'Invalid order ID format' });
        }

        // Validate status
        if (!status) {
            return res.status(400).json({ message: 'Status is required' });
        }

        // Define valid order statuses
        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                message: `Invalid status. Valid statuses are: ${validStatuses.join(', ')}` 
            });
        }

        await session.withTransaction(async () => {
            const order = await Order.findById(orderId)
                .populate('products.product_id')
                .session(session);

            if (!order) {
                throw new Error('Order not found');
            }

            const oldStatus = order.order_status;

            // If cancelling an order, restore product quantities
            if (status === 'Cancelled' && ['Pending', 'Processing'].includes(oldStatus)) {
                for (const item of order.products) {
                    if (item.product_id) {
                        await Product.updateOne(
                            { _id: item.product_id._id },
                            { $inc: { quantity: item.quantity } },
                            { session }
                        );
                    }
                }
            }

            // Update order status
            order.order_status = status;
            await order.save({ session });

            res.locals.updatedOrder = order;
        });

        // Populate and return updated order
        const populatedOrder = await Order.findById(orderId)
            .populate('user_id', 'username email')
            .populate('products.product_id', 'name price productImg');

        res.status(200).json(populatedOrder);

    } catch (error) {
        console.error(error);
        
        if (error.message === 'Order not found') {
            return res.status(404).json({ message: error.message });
        }
        
        res.status(500).json({ message: 'Internal Server Error' });
    } finally {
        await session.endSession();
    }
};

const deleteOrder = async (req, res) => {
    const orderId = req.params.id;

    const session = await mongoose.startSession();

    try {
        // Validate orderId format
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ message: 'Invalid order ID format' });
        }

        await session.withTransaction(async () => {
            // Find the order first
            const order = await Order.findById(orderId)
                .populate('products.product_id')
                .session(session);
                
            if (!order) {
                throw new Error('Order not found');
            }

            // Security: Non-admin users can only delete their own orders
            if (req.user.role !== 'admin' && order.user_id.toString() !== req.user.id) {
                throw new Error('Access denied');
            }

            // Restore product quantities if order is being cancelled
            if (['Pending', 'Processing'].includes(order.order_status)) {
                for (const item of order.products) {
                    if (item.product_id) {
                        await Product.updateOne(
                            { _id: item.product_id._id },
                            { $inc: { quantity: item.quantity } },
                            { session }
                        );
                    }
                }
            }

            // Delete the order
            await Order.deleteOne({ _id: orderId }, { session });
            res.locals.deletedOrder = order;
        });

        res.status(200).json({ 
            message: 'Order deleted successfully', 
            deletedOrder: res.locals.deletedOrder 
        });

    } catch (error) {
        console.error(error);
        
        if (error.message === 'Order not found') {
            return res.status(404).json({ message: error.message });
        }
        
        if (error.message === 'Access denied') {
            return res.status(403).json({ message: error.message });
        }
        
        res.status(500).json({ message: 'Internal Server Error' });
    } finally {
        await session.endSession();
    }
};

// Enhanced order statistics with date filtering
const getOrderStats = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        // Build date filter
        const dateFilter = {};
        if (startDate) {
            dateFilter.createdAt = { $gte: new Date(startDate) };
        }
        if (endDate) {
            dateFilter.createdAt = { ...dateFilter.createdAt, $lte: new Date(endDate) };
        }

        const stats = await Order.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: '$order_status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$total_amount' }
                }
            }
        ]);

        const totalOrders = await Order.countDocuments(dateFilter);
        const totalRevenue = await Order.aggregate([
            { 
                $match: { 
                    ...dateFilter,
                    order_status: { $ne: 'Cancelled' } 
                } 
            },
            { $group: { _id: null, total: { $sum: '$total_amount' } } }
        ]);

        res.status(200).json({
            statusBreakdown: stats,
            totalOrders,
            totalRevenue: totalRevenue[0]?.total || 0,
            dateRange: { startDate, endDate }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = {
    getAllOrders,
    getUserOrders,
    createOrder,
    getOrderById,
    updateOrderStatus,
    deleteOrder,
    getOrderStats,
};