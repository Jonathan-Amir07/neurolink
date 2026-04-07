require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo').default || require('connect-mongo').MongoStore || require('connect-mongo');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const path = require('path');

const app = express();

// Multer — memory storage, 20 MB limit
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }
});

// Load Passport Configuration
require('../utils/passport');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    tlsAllowInvalidCertificates: true
}).then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Initial Connection Error:', err));

mongoose.connection.on('error', err => console.error('MongoDB Runtime Error:', err));

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

// Middleware - shifted static below auth for safety
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Health Check (for debugging 404s)
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Sessions
app.use(session({
    secret: process.env.SESSION_SECRET || 'academic secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI })
}));

app.use(passport.initialize());
app.use(passport.session());

// ── Multer wrapper — fixes Express 5 compatibility (req.body always defined) ──
function parseUpload(req, res, next) {
    upload.single('file')(req, res, (err) => {
        // Always guarantee req.body is an object even if multer skips parsing
        req.body = req.body || {};
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: 'File upload error: ' + err.message });
        }
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
}

// ── Auth Routes ───────────────────────────────────────────────────────────────

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => res.redirect('/dashboard')
);

app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) return res.json(req.user);
    res.status(401).json({ error: 'Not authenticated' });
});

app.get('/auth/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect('/');
    });
});

// Static files — only serve safe frontend directories
app.use(express.static(path.join(__dirname, '..'), {
    index: 'index.html',
    dotfiles: 'deny',
    extensions: ['html', 'css', 'js', 'png', 'jpg', 'svg', 'ico', 'woff', 'woff2']
}));

// ── Project Routes ────────────────────────────────────────────────────────────

const Project = require('../models/Project');
const { generateNotebook, generateMindmap, generateFlashcards, generateSlides, generateInfographic } = require('../utils/ai');

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

app.delete('/api/projects/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
        const project = await Project.findOneAndDelete({ _id: req.params.id, user: req.user.id });
        if (!project) return res.status(404).send();
        res.json({ message: 'Project deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/projects/:id/regenerate', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
        const project = await Project.findOne({ _id: req.params.id, user: req.user.id });
        if (!project) return res.status(404).send();

        const { type } = req.body;
        const validTypes = ['notebook', 'mindmap', 'flashcards', 'slides', 'infographic'];
        if (!validTypes.includes(type)) return res.status(400).json({ error: 'Invalid type' });

        const generators = {
            notebook:    generateNotebook,
            mindmap:     generateMindmap,
            flashcards:  generateFlashcards,
            slides:      generateSlides,
            infographic: generateInfographic
        };

        if (!generators[type]) return res.status(400).json({ error: 'Generator not found' });
        
        const inputContent = (project.raw_input || '').trim();
        console.log(`[AI] Regenerating ${type} for project ${project._id}. Content length: ${inputContent.length} chars.`);
        
        if (!inputContent) {
            console.warn(`[AI] ⚠️ Cannot regenerate ${type}: project.raw_input is empty.`);
            return res.status(400).json({ error: 'No content in project to regenerate from.' });
        }

        const data = await generators[type](inputContent);
        
        if (data && data[type]) {
            const existingIndex = project.outputs.findIndex(o => o.type === type);
            if (existingIndex !== -1) {
                project.outputs[existingIndex].content = data[type]; // Overwrite existing
            } else {
                project.outputs.push({ type, content: data[type] }); // Append new
            }
            await project.save();
            return res.json({ success: true, project });
        } else {
            return res.status(500).json({ error: `Generation returned empty for ${type}.` });
        }
    } catch (err) {
        console.error(`[AI] Regeneration error:`, err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/projects — accepts multipart/form-data (text field or file)
app.post('/api/projects', parseUpload, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();

    try {
        const title = (req.body.title || '').trim();

        // selectedTypes arrives as a JSON string from FormData
        let selectedTypes;
        try {
            selectedTypes = JSON.parse(req.body.selectedTypes || '["notebook","mindmap","flashcards","slides","infographic"]');
        } catch {
            selectedTypes = ['notebook', 'mindmap', 'flashcards', 'slides', 'infographic'];
        }

        if (!title) return res.status(400).json({ error: 'Title is required' });

        // ── Extract content from text field or uploaded file ───────────────
        let content = (req.body.content || '').trim();

        if (req.file) {
            const isPdf = (req.file.mimetype === 'application/pdf') ||
                          req.file.originalname.toLowerCase().endsWith('.pdf');
            if (isPdf) {
                try {
                    const pdfData = await pdfParse(req.file.buffer);
                    content = pdfData.text.trim();
                    console.log(`[Upload] PDF parsed — ${content.length} chars`);
                } catch (pdfErr) {
                    return res.status(400).json({ error: 'Could not read PDF: ' + pdfErr.message });
                }
            } else {
                content = req.file.buffer.toString('utf-8').trim();
                console.log(`[Upload] Text file read — ${content.length} chars`);
            }
        }

        if (!content) {
            return res.status(400).json({ error: 'No content provided. Paste text or upload a file.' });
        }

        // ── Create project record ──────────────────────────────────────────
        const project = new Project({
            user: req.user.id,
            title,
            raw_input: content.substring(0, 5000)
        });

        // ── AI generation ──────────────────────────────────────────────────
        const apiKey = process.env.GOOGLE_API_KEY;
        const hasKey = apiKey && apiKey !== '' && apiKey !== 'your_gemini_api_key';

        if (!hasKey) {
            console.error('[AI] Generation failed: GOOGLE_API_KEY is missing or invalid');
            return res.status(400).json({ 
                error: 'Google API Key is missing. Please add GOOGLE_API_KEY to your Vercel Environment Variables.' 
            });
        }

        const generators = {
            notebook:    generateNotebook,
            mindmap:     generateMindmap,
            flashcards:  generateFlashcards,
            slides:      generateSlides,
            infographic: generateInfographic
        };

        try {
            console.log(`[AI] Dispatching sequential requests for: ${selectedTypes.join(', ')}`);
            const tStart = Date.now();
            const results = [];

            for (const type of selectedTypes) {
                if (!generators[type]) continue;
                
                try {
                    const cStart = Date.now();
                    const data = await generators[type](content);
                    if (data && data[type]) {
                        results.push({ type, content: data[type] });
                        console.log(`[AI] ✅ ${type} generated in ${Date.now() - cStart}ms`);
                    } else {
                        console.warn(`[AI] ⚠️ ${type} failed: No data returned`);
                    }
                } catch (err) {
                    console.error(`[AI] ❌ Error in ${type}:`, err.message);
                }
            }

            project.outputs = results;
            console.log(`[AI] TOTAL generation time: ${Date.now() - tStart}ms — ${results.length}/${selectedTypes.length} materials saved`);

            await project.save();
            res.json(project);

        } catch (err) {
            console.error('[AI Inner Catch]', err);
            res.status(500).json({ error: 'Failed to generate study materials: ' + err.message });
        }

    } catch (err) {
        console.error('[POST /api/projects Outer Catch]', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// Global Error Handler (must be registered before listen in Express 5)
app.use((err, req, res, next) => {
    console.error('SERVER ERROR:', err.stack);
    res.status(500).json({ 
        error: 'Internal Server Error', 
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack
    });
});

// Server listener (skip on Vercel)
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;
