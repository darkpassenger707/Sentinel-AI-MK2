const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const LoginAttempt = require('../models/LoginAttempt');
const checkBruteForce = require('../middlewares/bruteForceCheck');
const detectPayload = require('../middlewares/detectPayload');

router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ message: 'Username already exists.' });
        }

        const user = new User({ username, password });
        await user.save();

        return res.status(201).json({ message: 'User registered successfully.' });
    } catch (error) {
        console.error('Error during registration:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.post('/login', detectPayload, async (req, res) => {
    const { username, password } = req.body;

    try {
        console.log('Received login request:', { username });

        const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
        console.log(`Client IP: ${clientIp}`);

        const isBlocked = await checkBruteForce(clientIp);
        if (isBlocked) {
            console.warn(`Blocked login attempt from IP: ${clientIp}`);
            return res.status(403).json({ message: 'Too many failed attempts. You are temporarily blocked.' });
        }

        const user = await User.findOne({ username });
        if (!user) {
            console.log(`User not found: ${username}`);
            await LoginAttempt.create({
                ip: clientIp,
                username: username || 'Unknown',
                status: 'Failed',
                timestamp: new Date()
            });
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log(`Password mismatch for user: ${username}`);
            await LoginAttempt.create({
                ip: clientIp,
                username,
                status: 'Failed',
                timestamp: new Date()
            });
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        await LoginAttempt.deleteMany({ ip: clientIp, status: 'Failed' });

        await LoginAttempt.create({
            ip: clientIp,
            username,
            status: 'Success',
            timestamp: new Date()
        });

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        console.log(`Login successful for user: ${username}`);
        res.status(200).json({ token, message: 'Login successful' });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access Denied. No token provided.' });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next();
    } catch (error) {
        res.status(403).json({ message: 'Invalid or expired token' });
    }
};

router.get('/logs', verifyToken, async (req, res) => {
    try {
        const logs = await LoginAttempt.find().sort({ timestamp: -1 }).limit(10);
        res.status(200).json({
            message: 'System logs retrieved successfully',
            threatLogs: logs
        });
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ message: 'Server error while fetching logs' });
    }
});

module.exports = router;
