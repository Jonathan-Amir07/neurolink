require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
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

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, '../public')));

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

app.get('/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect('/');
    });
});

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
        const hasKey = process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY !== 'your_gemini_api_key';

        if (hasKey) {
            console.log(`[AI] Generating: ${selectedTypes.join(', ')}`);
            const generators = {
                notebook:    generateNotebook,
                mindmap:     generateMindmap,
                flashcards:  generateFlashcards,
                slides:      generateSlides,
                infographic: generateInfographic
            };

            const results = [];
            for (const type of selectedTypes) {
                if (!generators[type]) continue;
                console.log(`[AI] → ${type}…`);
                const t0 = Date.now();
                try {
                    const data = await generators[type](content);
                    if (data && data[type]) {
                        results.push({ type, content: data[type] });
                        console.log(`[AI] ✓ ${type} in ${Date.now() - t0}ms`);
                    } else {
                        console.warn(`[AI] ✗ ${type} returned null`);
                    }
                } catch (aiErr) {
                    console.error(`[AI] ✗ ${type} threw:`, aiErr.message);
                }
            }

            project.outputs = results;
            console.log(`[AI] Done — ${results.length}/${selectedTypes.length} materials saved`);
        } else {
            console.warn('[AI] SKIPPED: No valid GOOGLE_API_KEY');
        }

        await project.save();
        res.json(project);

    } catch (err) {
        console.error('[POST /api/projects]', err);
        res.status(500).json({ error: err.message });
    }
});

// Server listener (skip on Vercel)
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
