// server.js

const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(__dirname + '/public'));

// Routes
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/login.html');
});

app.get('/register', (req, res) => {
    res.sendFile(__dirname + '/views/register.ejs');
});

app.get('/dashboard', (req, res) => {
    res.sendFile(__dirname + '/views/dashboard.html');
});

const startServer = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');
    } catch (err) {
        console.warn('MongoDB connection failed. Continuing without database:', err.message);
    }

    const listenWithFallback = (port) => {
        const server = app.listen(port, () => console.log(`Server running on port ${port}`));

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                const fallbackPort = port + 1;
                console.warn(`Port ${port} is busy. Retrying on ${fallbackPort}.`);
                listenWithFallback(fallbackPort);
            } else {
                console.error(err);
            }
        });
    };

    listenWithFallback(PORT);
};

startServer();
