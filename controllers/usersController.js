const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models/usersModel'); // Fixed: was { Users }
const mongoose = require('mongoose');

// Input validation helpers
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const validatePassword = (password) => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
};

const validatePhoneNumber = (phone) => {
    // Basic phone number validation (adjust regex as needed)
    const phoneRegex = /^[\+]?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
};

const registerUser = async (req, res) => {
    const {
        username,
        email,
        password,
        phone_number,
        street,
        city,
        state,
        postal_code,
        country,
        role = 'user' // Default to 'user' role
    } = req.body;

    try {
        // Validate required fields
        if (!username || !email || !password || !phone_number || !street || !city || !state || !postal_code || !country) {
            return res.status(400).json({
                message: 'All fields are required: username, email, password, phone_number, and complete address'
            });
        }

        // Validate input formats
        if (typeof username !== 'string' || username.trim().length < 2) {
            return res.status(400).json({
                message: 'Username must be at least 2 characters long'
            });
        }

        if (!validateEmail(email)) {
            return res.status(400).json({
                message: 'Please provide a valid email address'
            });
        }

        if (!validatePassword(password)) {
            return res.status(400).json({
                message: 'Password must be at least 8 characters long and contain at least 1 uppercase letter, 1 lowercase letter, and 1 number'
            });
        }

        if (!validatePhoneNumber(phone_number)) {
            return res.status(400).json({
                message: 'Please provide a valid phone number'
            });
        }

        // Validate role if provided
        if (role && !['user', 'admin'].includes(role)) {
            return res.status(400).json({
                message: 'Role must be either "user" or "admin"'
            });
        }

        // Check if the user already exists (email or username)
        const existingUser = await User.findOne({
            $or: [{ email: email.toLowerCase() }, { username: username.trim() }]
        });

        if (existingUser) {
            if (existingUser.email === email.toLowerCase()) {
                return res.status(409).json({ message: 'User with this email already exists' });
            } else {
                return res.status(409).json({ message: 'Username is already taken' });
            }
        }

        // Hash the password
        const saltRounds = 12; // Increased from 10 for better security
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create a new user with the hashed password and additional details
        const newUser = new User({
            username: username.trim(),
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            phone_number: phone_number.trim(),
            address: {
                street: street.trim(),
                city: city.trim(),
                state: state.trim(),
                postal_code: postal_code.trim(),
                country: country.trim(),
            },
            role,
            order_history: [] // Initialize empty order history
        });

        const savedUser = await newUser.save();

        // Generate a JWT token
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error('JWT_SECRET environment variable is required');
        }
        const token = jwt.sign(
            { 
                userId: savedUser._id,
                email: savedUser.email,
                role: savedUser.role
            }, 
            jwtSecret,
            { expiresIn: '24h' }
        );

        // Send the token as a secure cookie
        res.cookie('jwt', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Only secure in production
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for cross-origin in production
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        // Return user data without password
        const userResponse = {
            id: savedUser._id,
            username: savedUser.username,
            email: savedUser.email,
            phone_number: savedUser.phone_number,
            address: savedUser.address,
            role: savedUser.role,
            createdAt: savedUser.createdAt
        };

        res.status(201).json({
            message: 'User registered successfully',
            user: userResponse,
            token // Include token in response for client-side storage if needed
        });
    } catch (error) {
        console.error('Registration error:', error);
        
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

const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                message: 'Email and password are required'
            });
        }

        // Validate email format
        if (!validateEmail(email)) {
            return res.status(400).json({
                message: 'Please provide a valid email address'
            });
        }

        // Check if the user exists
        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Check if the password is correct
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Generate a JWT token
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error('JWT_SECRET environment variable is required');
        }
        const token = jwt.sign(
            { 
                userId: user._id,
                email: user.email,
                role: user.role
            }, 
            jwtSecret,
            { expiresIn: '24h' }
        );

        // Send the token as a secure cookie
        res.cookie('jwt', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for cross-origin in production
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        // Return user data without password
        const userResponse = {
            id: user._id,
            username: user.username,
            email: user.email,
            phone_number: user.phone_number,
            address: user.address,
            role: user.role
        };

        res.status(200).json({
            message: 'Login successful',
            user: userResponse,
            token // Include token in response for client-side storage if needed
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const logoutUser = async (req, res) => {
    try {
        // Clear the JWT cookie
        res.clearCookie('jwt', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
        });

        res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// FIXED: Get current user's details (security fix)
const getUserDetails = async (req, res) => {
    try {
        // Security fix: Use authenticated user's ID instead of query parameter
        const userId = req.user.id;

        // Fetch user details for the authenticated user
        const userDetails = await User.findById(userId)
            .populate('order_history')
            .select('-password'); // Exclude password from response

        if (!userDetails) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            id: userDetails._id,
            username: userDetails.username,
            email: userDetails.email,
            phone_number: userDetails.phone_number,
            address: userDetails.address,
            role: userDetails.role,
            order_history: userDetails.order_history,
            createdAt: userDetails.createdAt,
            updatedAt: userDetails.updatedAt
        });
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// SECURED: Admin-only function to get user details by ID
const getUserDetailsFromId = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID format' });
        }

        // Security check: Only admins can access this endpoint (handled by middleware)
        // Additional check: req.user.role === 'admin' should be verified by requireAdmin middleware

        const userDetails = await User.findById(userId)
            .populate('order_history')
            .select('-password'); // Exclude password from response

        if (!userDetails) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            id: userDetails._id,
            username: userDetails.username,
            email: userDetails.email,
            phone_number: userDetails.phone_number,
            address: userDetails.address,
            role: userDetails.role,
            order_history: userDetails.order_history,
            createdAt: userDetails.createdAt,
            updatedAt: userDetails.updatedAt
        });
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// FIXED: Update user with proper authorization
const updateUser = async (req, res) => {
    const { userId } = req.params;
    const { username, email, password, phone_number, address, role } = req.body;

    try {
        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid user ID format' });
        }

        // Security check: Users can only update their own profile unless they're admin
        if (req.user.role !== 'admin' && userId !== req.user.id) {
            return res.status(403).json({ 
                message: 'Access denied. You can only update your own profile.' 
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Build update object with validation
        const updateData = {};

        if (username !== undefined) {
            if (typeof username !== 'string' || username.trim().length < 2) {
                return res.status(400).json({
                    message: 'Username must be at least 2 characters long'
                });
            }
            
            // Check if username is already taken by another user
            const existingUser = await User.findOne({
                username: username.trim(),
                _id: { $ne: userId }
            });
            
            if (existingUser) {
                return res.status(409).json({ message: 'Username is already taken' });
            }
            
            updateData.username = username.trim();
        }

        if (email !== undefined) {
            if (!validateEmail(email)) {
                return res.status(400).json({
                    message: 'Please provide a valid email address'
                });
            }
            
            // Check if email is already taken by another user
            const existingUser = await User.findOne({
                email: email.toLowerCase().trim(),
                _id: { $ne: userId }
            });
            
            if (existingUser) {
                return res.status(409).json({ message: 'Email is already taken' });
            }
            
            updateData.email = email.toLowerCase().trim();
        }

        if (password !== undefined) {
            if (!validatePassword(password)) {
                return res.status(400).json({
                    message: 'Password must be at least 8 characters long and contain at least 1 uppercase letter, 1 lowercase letter, and 1 number'
                });
            }
            
            const hashedPassword = await bcrypt.hash(password, 12);
            updateData.password = hashedPassword;
        }

        if (phone_number !== undefined) {
            if (!validatePhoneNumber(phone_number)) {
                return res.status(400).json({
                    message: 'Please provide a valid phone number'
                });
            }
            updateData.phone_number = phone_number.trim();
        }

        if (address !== undefined) {
            updateData.address = {
                street: address.street?.trim() || user.address.street,
                city: address.city?.trim() || user.address.city,
                state: address.state?.trim() || user.address.state,
                postal_code: address.postal_code?.trim() || user.address.postal_code,
                country: address.country?.trim() || user.address.country,
            };
        }

        // Security: Only admins can change roles
        if (role !== undefined) {
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    message: 'Only administrators can change user roles'
                });
            }
            
            if (!['user', 'admin'].includes(role)) {
                return res.status(400).json({
                    message: 'Role must be either "user" or "admin"'
                });
            }
            updateData.role = role;
        }

        // Update user
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true }
        ).select('-password'); // Exclude password from response

        res.status(200).json({
            message: 'User updated successfully',
            user: updatedUser
        });
    } catch (error) {
        console.error('Update user error:', error);
        
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

const deleteUser = async (req, res) => {
    const { userId } = req.params;

    try {
        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid user ID format' });
        }

        // Security check: Only admins can delete users (handled by requireAdmin middleware)
        // Additional protection: Prevent deleting own admin account
        if (userId === req.user.id) {
            return res.status(400).json({ 
                message: 'You cannot delete your own account' 
            });
        }

        const deletedUser = await User.findByIdAndDelete(userId);
        if (!deletedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({
            message: 'User deleted successfully',
            deletedUser: {
                id: deletedUser._id,
                username: deletedUser.username,
                email: deletedUser.email
            }
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Admin function to get all users
const getAllUsers = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            role,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build filter object
        const filter = {};

        if (role && ['user', 'admin'].includes(role)) {
            filter.role = role;
        }

        if (search) {
            filter.$or = [
                { username: new RegExp(search, 'i') },
                { email: new RegExp(search, 'i') }
            ];
        }

        // Build sort object
        const sort = {};
        const validSortFields = ['username', 'email', 'createdAt', 'updatedAt'];
        if (validSortFields.includes(sortBy)) {
            sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
        } else {
            sort.createdAt = -1;
        }

        // Calculate pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Get users with pagination
        const users = await User.find(filter)
            .select('-password') // Exclude passwords
            .sort(sort)
            .skip(skip)
            .limit(limitNum);

        const totalUsers = await User.countDocuments(filter);
        const totalPages = Math.ceil(totalUsers / limitNum);

        res.status(200).json({
            users,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalUsers,
                hasNextPage: pageNum < totalPages,
                hasPrevPage: pageNum > 1
            }
        });
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// FIXED: Change password with proper authorization
const changePassword = async (req, res) => {
    const { userId } = req.params;
    const { currentPassword, newPassword } = req.body;

    try {
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                message: 'Current password and new password are required'
            });
        }

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid user ID format' });
        }

        // Security check: Users can only change their own password unless they're admin
        if (req.user.role !== 'admin' && userId !== req.user.id) {
            return res.status(403).json({ 
                message: 'Access denied. You can only change your own password.' 
            });
        }

        if (!validatePassword(newPassword)) {
            return res.status(400).json({
                message: 'New password must be at least 8 characters long and contain at least 1 uppercase letter, 1 lowercase letter, and 1 number'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // For admin changing other user's password, skip current password verification
        if (req.user.role === 'admin' && userId !== req.user.id) {
            // Admin changing another user's password - no current password needed
        } else {
            // User changing their own password - verify current password
            const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isCurrentPasswordValid) {
                return res.status(401).json({ message: 'Current password is incorrect' });
            }
        }

        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 12);
        user.password = hashedNewPassword;
        await user.save();

        res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = {
    registerUser,
    loginUser,
    logoutUser,
    getUserDetails,
    getUserDetailsFromId,
    updateUser,
    deleteUser,
    getAllUsers,
    changePassword
};