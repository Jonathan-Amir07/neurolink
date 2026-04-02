require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const path = require('path');

const app = express();

// Load Passport Configuration
require('../utils/passport');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  tlsAllowInvalidCertificates: true
}).then(() => console.log('MongoDB Connected'))
  .catch(err => {
    console.error('MongoDB Initial Connection Error:', err);
  });

// Handle MongoDB disconnection/errors after initial connection
mongoose.connection.on('error', err => {
  console.error('MongoDB Runtime Error:', err);
});

// Prevention from crashing on unhandled errors
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, '../public')));

// Clean URLs for local testing
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../public/dashboard.html')));
app.get('/project', (req, res) => res.sendFile(path.join(__dirname, '../public/project.html')));

// Sessions
app.use(session({
    secret: process.env.SESSION_SECRET || 'academic secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI })
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Auth Routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        res.redirect('/dashboard');
    }
);

app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json(req.user);
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

app.get('/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect('/');
    });
});

// Project Routes
const Project = require('../models/Project');
const { generateStudyMaterials } = require('../utils/ai');

app.get('/api/projects', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
        const projects = await Project.find({ user: req.user.id }).sort({ created_at: -1 });
        res.json(projects);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/projects/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
        const project = await Project.findOne({ _id: req.params.id, user: req.user.id });
        if (!project) return res.status(404).send();
        res.json(project);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/projects', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
        const { title, content } = req.body;
        
        // 1. Create the project record
        const project = new Project({
            user: req.user.id,
            title,
            raw_input: content
        });

        // 2. Trigger AI Generation (if API key is present)
        if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY !== 'your_gemini_api_key') {
            const materials = await generateStudyMaterials(content);
            
            project.outputs = [
                { type: 'notebook', content: materials.notebook },
                { type: 'mindmap', content: materials.mindmap },
                { type: 'flashcards', content: materials.flashcards }
            ];
        } else {
            console.warn("AI Generation skipped: No valid API key.");
            // We can add dummy data for manual testing if needed
        }

        await project.save();
        res.json(project);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Server listener (only if not running on Vercel)
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
