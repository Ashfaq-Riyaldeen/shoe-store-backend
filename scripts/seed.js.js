// scripts/seed.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { User } = require('../models/usersModel');
const { Product } = require('../models/productsModel');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('âœ… MongoDB Connected for seeding');
    } catch (error) {
        console.error('âŒ Error connecting to MongoDB:', error);
        process.exit(1);
    }
};

const seedAdmin = async () => {
    try {
        const adminExists = await User.findOne({ email: process.env.ADMIN_EMAIL || 'admin@keyzone.com' });
        
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 12);
            
            const admin = new User({
                username: 'Admin',
                email: process.env.ADMIN_EMAIL || 'admin@demo.com',
                password: hashedPassword,
                phone_number: '+94771234567',
                address: {
                    street: '123 Admin Street',
                    city: 'Colombo',
                    state: 'Western Province',
                    postal_code: '00100',
                    country: 'Sri Lanka'
                },
                role: 'admin'
            });
            
            await admin.save();
            console.log('âœ… Admin user created');
            console.log('ðŸ“§ Email:', process.env.ADMIN_EMAIL || 'admin@keyzone.com');
            console.log('ðŸ”‘ Password:', process.env.ADMIN_PASSWORD || 'admin123');
        } else {
            console.log('â„¹ï¸  Admin user already exists');
        }
    } catch (error) {
        console.error('âŒ Error creating admin:', error);
    }
};


const createTestUser = async () => {
    try {
        const testUserExists = await User.findOne({ email: 'user@keyzone.com' });
        
        if (!testUserExists) {
            const hashedPassword = await bcrypt.hash('user123', 12);
            
            const testUser = new User({
                username: 'Test User',
                email: 'user@demo.com',
                password: hashedPassword,
                phone_number: '+94771234568',
                address: {
                    street: '456 Test Avenue',
                    city: 'Kandy',
                    state: 'Central Province',
                    postal_code: '20000',
                    country: 'Sri Lanka'
                },
                role: 'user'
            });
            
            await testUser.save();
            console.log('âœ… Test user created');
            console.log('ðŸ“§ Email: user@keyzone.com');
            console.log('ðŸ”‘ Password: user123');
        } else {
            console.log('â„¹ï¸  Test user already exists');
        }
    } catch (error) {
        console.error('âŒ Error creating test user:', error);
    }
};

const seedDatabase = async () => {
    console.log('ðŸŒ± Starting KeyZone database seeding...');
    console.log('==========================================');
    
    await connectDB();
    await seedAdmin();
    await createTestUser();
    
    console.log('==========================================');
    console.log('âœ… KeyZone database seeding completed successfully!');
    console.log('ðŸ‡±ðŸ‡° All prices are now in Sri Lankan Rupees (LKR)');
    console.log('ðŸš€ You can now start your application');
    console.log('==========================================');
    
    await mongoose.connection.close();
    process.exit(0);
};

// Run seeding if this file is executed directly
if (require.main === module) {
    seedDatabase().catch((error) => {
        console.error('âŒ Seeding failed:', error);
        process.exit(1);
    });
}

module.exports = { seedDatabase };