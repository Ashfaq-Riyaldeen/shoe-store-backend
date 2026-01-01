const { Product } = require('../models/productsModel');
const mongoose = require('mongoose');

const getAllProducts = async (req, res) => {
    try {
        // Extract query parameters for filtering and pagination
        const {
            page = 1,
            limit = 20,
            category,
            minPrice,
            maxPrice,
            color,
            size,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build filter object
        const filter = {};

        // Category filter
        if (category) {
            if (!['Men', 'Women', 'men', 'women'].includes(category)) {
                return res.status(400).json({
                    message: 'Invalid category. Must be "Men" or "Women"'
                });
            }
            // Case-insensitive search for categories
            filter.categories = { $regex: new RegExp(`^${category}$`, 'i') };
        }

        // Price range filter
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) {
                const min = parseFloat(minPrice);
                if (isNaN(min) || min < 0) {
                    return res.status(400).json({ message: 'Invalid minPrice' });
                }
                filter.price.$gte = min;
            }
            if (maxPrice) {
                const max = parseFloat(maxPrice);
                if (isNaN(max) || max < 0) {
                    return res.status(400).json({ message: 'Invalid maxPrice' });
                }
                filter.price.$lte = max;
            }
        }

        // Color filter
        if (color) {
            filter['attributes.color'] = new RegExp(color, 'i');
        }

        // Size filter
        if (size) {
            filter['attributes.sizes'] = size;
        }

        // Search filter (name or description)
        if (search) {
            filter.$or = [
                { name: new RegExp(search, 'i') },
                { description: new RegExp(search, 'i') }
            ];
        }

        // Build sort object
        const sort = {};
        const validSortFields = ['name', 'price', 'createdAt', 'quantity'];
        if (validSortFields.includes(sortBy)) {
            sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
        } else {
            sort.createdAt = -1; // Default sort
        }

        // Calculate pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Execute query with pagination
        const products = await Product.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limitNum);

        // Get total count for pagination info
        const totalProducts = await Product.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limitNum);

        res.status(200).json({
            products,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalProducts,
                hasNextPage: pageNum < totalPages,
                hasPrevPage: pageNum > 1
            }
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const getProductsByCategory = async (req, res) => {
    const { category } = req.params;

    try {
        // Validate category
        if (!['Men', 'Women', 'men', 'women'].includes(category)) {
            return res.status(400).json({
                message: 'Invalid category. Must be "Men" or "Women"'
            });
        }

        // Case-insensitive search
        const products = await Product.find({
            categories: { $regex: new RegExp(`^${category}$`, 'i') }
        });
        res.json({
            category,
            count: products.length,
            products
        });
    } catch (error) {
        console.error('Error fetching products by category:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

const createProduct = async (req, res) => {
    try {
        const { name, description, quantity, price, categories, attributes, productImg } = req.body;

        // Validate required fields
        if (!name || !description || quantity === undefined || price === undefined) {
            return res.status(400).json({
                message: 'Name, description, quantity, and price are required'
            });
        }

        // Validate data types and values
        if (typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ message: 'Name must be a non-empty string' });
        }

        if (typeof description !== 'string' || description.trim().length === 0) {
            return res.status(400).json({ message: 'Description must be a non-empty string' });
        }

        if (!Number.isInteger(quantity) || quantity < 0) {
            return res.status(400).json({ message: 'Quantity must be a non-negative integer' });
        }

        if (typeof price !== 'number' || price <= 0) {
            return res.status(400).json({ message: 'Price must be a positive number' });
        }

        // Validate categories
        if (categories && categories.length > 0) {
            const validCategories = ['Men', 'Women'];
            const invalidCategories = categories.filter(cat => !validCategories.includes(cat));
            if (invalidCategories.length > 0) {
                return res.status(400).json({
                    message: `Invalid categories: ${invalidCategories.join(', ')}. Must be "Men" or "Women"`
                });
            }
        }

        // Validate attributes if provided
        if (attributes) {
            if (attributes.sizes && !Array.isArray(attributes.sizes)) {
                return res.status(400).json({ message: 'Sizes must be an array' });
            }
            
            if (attributes.color && typeof attributes.color !== 'string') {
                return res.status(400).json({ message: 'Color must be a string' });
            }
        }

        // Create product with validated data
        const productData = {
            name: name.trim(),
            description: description.trim(),
            quantity,
            price,
            categories: categories || [],
            attributes: {
                color: attributes?.color?.trim() || '',
                sizes: attributes?.sizes || []
            }
        };

        if (productImg) {
            productData.productImg = productImg;
        }

        const product = new Product(productData);
        const savedProduct = await product.save();
        
        res.status(201).json(savedProduct);
    } catch (error) {
        console.error('Error creating product:', error);
        
        // Handle mongoose validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: 'Validation Error',
                errors
            });
        }
        
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const getProductById = async (req, res) => {
    const productId = req.params.id;

    try {
        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Invalid product ID format' });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        
        res.status(200).json(product);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const updateProduct = async (req, res) => {
    const productId = req.params.id;

    try {
        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Invalid product ID format' });
        }

        const updateData = req.body;

        // Validate updated fields if provided
        if (updateData.name !== undefined) {
            if (typeof updateData.name !== 'string' || updateData.name.trim().length === 0) {
                return res.status(400).json({ message: 'Name must be a non-empty string' });
            }
            updateData.name = updateData.name.trim();
        }

        if (updateData.description !== undefined) {
            if (typeof updateData.description !== 'string' || updateData.description.trim().length === 0) {
                return res.status(400).json({ message: 'Description must be a non-empty string' });
            }
            updateData.description = updateData.description.trim();
        }

        if (updateData.quantity !== undefined) {
            if (!Number.isInteger(updateData.quantity) || updateData.quantity < 0) {
                return res.status(400).json({ message: 'Quantity must be a non-negative integer' });
            }
        }

        if (updateData.price !== undefined) {
            if (typeof updateData.price !== 'number' || updateData.price <= 0) {
                return res.status(400).json({ message: 'Price must be a positive number' });
            }
        }

        if (updateData.categories !== undefined) {
            const validCategories = ['Men', 'Women'];
            const invalidCategories = updateData.categories.filter(cat => !validCategories.includes(cat));
            if (invalidCategories.length > 0) {
                return res.status(400).json({
                    message: `Invalid categories: ${invalidCategories.join(', ')}. Must be "Men" or "Women"`
                });
            }
        }

        if (updateData.attributes?.color !== undefined) {
            updateData.attributes.color = updateData.attributes.color.trim();
        }

        const product = await Product.findByIdAndUpdate(
            productId, 
            updateData, 
            { new: true, runValidators: true }
        );
        
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        
        res.status(200).json(product);
    } catch (error) {
        console.error('Error updating product:', error);
        
        // Handle mongoose validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: 'Validation Error',
                errors
            });
        }
        
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const deleteProduct = async (req, res) => {
    const productId = req.params.id;

    try {
        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Invalid product ID format' });
        }

        const product = await Product.findByIdAndDelete(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        
        res.status(200).json({ 
            message: 'Product deleted successfully',
            deletedProduct: product
        });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Additional utility functions for shoe store

const getAvailableSizes = async (req, res) => {
    try {
        const sizes = await Product.distinct('attributes.sizes');
        res.status(200).json({ availableSizes: sizes.sort() });
    } catch (error) {
        console.error('Error fetching available sizes:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const getAvailableColors = async (req, res) => {
    try {
        const colors = await Product.distinct('attributes.color');
        // Filter out empty strings
        const validColors = colors.filter(color => color && color.trim().length > 0);
        res.status(200).json({ availableColors: validColors.sort() });
    } catch (error) {
        console.error('Error fetching available colors:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const updateProductQuantity = async (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body;

    try {
        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Invalid product ID format' });
        }

        if (!Number.isInteger(quantity) || quantity < 0) {
            return res.status(400).json({ message: 'Quantity must be a non-negative integer' });
        }

        const product = await Product.findByIdAndUpdate(
            productId,
            { quantity },
            { new: true, runValidators: true }
        );

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.status(200).json(product);
    } catch (error) {
        console.error('Error updating product quantity:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = {
    getAllProducts,
    getProductsByCategory,
    createProduct,
    getProductById,
    updateProduct,
    deleteProduct,
    getAvailableSizes,
    getAvailableColors,
    updateProductQuantity
};