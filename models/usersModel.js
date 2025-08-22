const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: false, },
    email: { type: String, required: true, unique: true, },
    password: { type: String, required: true, },
    phone_number: { type: String,required: true, },
    address: {
        street: {type: String, required: true,},
        city: {type: String, required: true,},
        state: {type: String, required: true,},
        postal_code: {type: String, required: true,},
        country: {type: String, required: true,},
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user',
        required: true
    },
    order_history: [{
            order_id: {
                type: mongoose.Schema.Types.ObjectId, ref: 'Order',
            },},],
} , {
    timestamps: true
});
    

const Users = mongoose.model('User', UserSchema);
module.exports = { Users };