const jwt = require('jsonwebtoken');
const { User } = require('../models/usersModel');

// Basic authentication middleware
const isAuth = async (req, res, next) => {
    try {
        // Try to get token from cookie first, then from Authorization header
        let token = req.cookies.jwt;

        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7); // Remove 'Bearer ' prefix
            }
        }

        if (!token) {
            return res.status(401).json({
                message: 'Unauthorized - No token provided'
            });
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            console.error('JWT_SECRET environment variable is not set');
            return res.status(500).json({ 
                message: 'Internal server error' 
            });
        }

        const decoded = jwt.verify(token, jwtSecret);
        
        // Optional: Validate user exists (remove if you want better performance)
        const user = await User.findById(decoded.userId).select('-password');
        if (!user) {
            return res.status(401).json({ 
                message: 'Unauthorized - User no longer exists' 
            });
        }

        req.user = {
            id: decoded.userId,
            email: decoded.email,
            role: decoded.role,
            userDoc: user
        };

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                message: 'Unauthorized - Invalid token' 
            });
        } else if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                message: 'Unauthorized - Token expired' 
            });
        } else {
            return res.status(500).json({ 
                message: 'Internal server error' 
            });
        }
    }
};

// Admin-only middleware (use after isAuth)
const isAdmin = (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ 
                message: 'Unauthorized - Please authenticate first' 
            });
        }

        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                message: 'Forbidden - Admin access required' 
            });
        }

        next();
    } catch (error) {
        console.error('Admin middleware error:', error);
        res.status(500).json({ 
            message: 'Internal server error' 
        });
    }
};

// Combined middleware for admin routes
const requireAdmin = [isAuth, isAdmin];

module.exports = {
    isAuth,
    isAdmin,
    requireAdmin
};