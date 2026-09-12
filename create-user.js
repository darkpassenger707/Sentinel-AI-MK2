const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const User = require('./models/User');

async function resetUser() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const hashedPassword = await bcrypt.hash('password123', 10);
        
        await User.findOneAndUpdate(
            { username: 'admin' },
            { password: hashedPassword },
            { upsert: true, new: true }
        );
        
        console.log('User password reset successfully: admin / password123');
        mongoose.disconnect();
    } catch (err) {
        console.error('Error resetting user:', err);
    }
}
resetUser();