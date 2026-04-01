const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    googleId: { type: String, required: true },
    displayName: { type: String, required: true },
    email: { type: String, required: true },
    image: String,
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
