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
    limits: { 
        fileSize: 20 * 1024 * 1024,
        fieldSize: 20 * 1024 * 1024 // Allow up to 20MB for pasted text and other fields
    }
});

// Load Passport Configuration
require('../utils/passport');

// ── DATABASE CONNECTION RESILIENCE ── 
mongoose.set('bufferCommands', false); // Keep buffering OFF to prevent Vercel 10s hangs

let isConnecting = false;
async function connectDB() {
    if (mongoose.connection.readyState === 1) return;
    if (isConnecting) return;

    isConnecting = true;
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            tlsAllowInvalidCertificates: true,
            serverSelectionTimeoutMS: 8000, 
            socketTimeoutMS: 45000,
            heartbeatFrequencyMS: 10000
        });
        console.log('✅ MongoDB Connected');
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err.message);
        throw err;
    } finally {
        isConnecting = false;
    }
}

// Initial connection attempt
connectDB();

// Middleware to ensure DB is connected before processing any request
const ensureDB = async (req, res, next) => {
    try {
        if (mongoose.connection.readyState === 1) return next();
        
        // If connecting (readyState 2), wait for it
        if (mongoose.connection.readyState === 2) {
            console.log('⏳ Database connecting... waiting...');
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Database connection timed out')), 10000);
                mongoose.connection.once('open', () => { clearTimeout(timeout); resolve(); });
                mongoose.connection.once('error', (err) => { clearTimeout(timeout); reject(err); });
            });
            return next();
        }

        // If disconnected (readyState 0), reconnect
        console.log('🔄 Database disconnected. Reconnecting for request:', req.path);
        await connectDB();
        next();
    } catch (err) {
        next(err); // Pass to global error handler
    }
};

app.use(ensureDB);

// Middleware - shifted static below auth for safety
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: false, limit: '20mb' }));

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
    upload.array('files', 10)(req, res, (err) => {
        // Always guarantee req.body and req.files are initialized
        req.body = req.body || {};
        req.files = req.files || [];
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
const { generateNotebook, generateMindmap, generateFlashcards, generateSlides, generateInfographic, generateQuiz, chatWithAI } = require('../utils/ai');

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

app.patch('/api/projects/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
        const { title, tags } = req.body;
        const project = await Project.findOne({ _id: req.params.id, user: req.user.id });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        if (title) project.title = title.trim();
        if (tags !== undefined) {
            project.tags = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
        }

        await project.save();
        res.json(project);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/chat/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
        const { message } = req.body;
        const project = await Project.findOne({ _id: req.params.id, user: req.user.id });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const reply = await chatWithAI(project.raw_input, message);
        
        // Save chat history
        project.chat_history.push({ role: 'user', message });
        project.chat_history.push({ role: 'ai', message: reply });
        await project.save();

        res.json(reply);
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
        const validTypes = ['notebook', 'mindmap', 'flashcards', 'slides', 'infographic', 'quiz'];
        if (!validTypes.includes(type)) return res.status(400).json({ error: 'Invalid type' });

        const generators = {
            notebook:    generateNotebook,
            mindmap:     generateMindmap,
            flashcards:  generateFlashcards,
            slides:      generateSlides,
            infographic: generateInfographic,
            quiz:        generateQuiz
        };

        if (!generators[type]) return res.status(400).json({ error: 'Generator not found' });
        
        const inputContent = (
            project.raw_input || 
            project.topic || 
            project.content || 
            project.text || 
            project.summary || 
            ''
        ).trim();
        console.log(`[AI] Regenerating ${type} for project ${project._id}. Content length: ${inputContent.length} chars.`);
        
        if (!inputContent) {
            console.warn(`[AI] ⚠️ Cannot regenerate ${type}: No source text found in any legacy or modern fields.`);
            return res.status(400).json({ error: 'No content in project to regenerate from. Please try updating the project source text.' });
        }

        const data = await generators[type](inputContent);
        
        if (data && data[type]) {
            const existingIndex = project.outputs.findIndex(o => o.type === type);
            if (existingIndex !== -1) {
                project.outputs[existingIndex].content = data[type];
            } else {
                project.outputs.push({ type, content: data[type] });
            }
            await project.save();
            return res.json({ success: true, project });
        } else {
            return res.status(500).json({ 
                error: `AI could not generate the ${type}. This is usually caused by API rate limits or complex content. Please wait a moment and try again.` 
            });
        }
    } catch (err) {
        console.error(`[AI] Regeneration error:`, err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/projects/:id/share', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
        const { is_public } = req.body;
        const project = await Project.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { is_public: !!is_public },
            { new: true }
        );
        if (!project) return res.status(404).send();
        res.json({ success: true, is_public: project.is_public });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Public Project route
app.get('/api/public/projects/:id', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project || !project.is_public) return res.status(404).json({ error: 'Project not found or private' });
        // Return only what's needed for the viewer
        res.json({
            title: project.title,
            outputs: project.outputs,
            is_public: project.is_public
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/projects — accepts multipart/form-data (text field or file)
app.post('/api/projects', parseUpload, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();

    try {
        const title = (req.body.title || '').trim();

        let tagsArray = [];
        if (req.body.tags) {
            tagsArray = req.body.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
        }

        // selectedTypes arrives as a JSON string from FormData
        let selectedTypes;
        try {
            selectedTypes = JSON.parse(req.body.selectedTypes || '["notebook","mindmap","flashcards","slides","infographic","quiz"]');
        } catch {
            selectedTypes = ['notebook', 'mindmap', 'flashcards', 'slides', 'infographic', 'quiz'];
        }

        if (!title) return res.status(400).json({ error: 'Title is required' });

        // ── Extract content from multiple files or text area ───────────────
        let contentChunks = [];
        
        // Add manual text if provided
        const textContent = (req.body.content || '').trim();
        if (textContent) contentChunks.push(textContent);

        // Process all uploaded files
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const isPdf = (file.mimetype === 'application/pdf') ||
                              file.originalname.toLowerCase().endsWith('.pdf');
                if (isPdf) {
                    try {
                        const pdfData = await pdfParse(file.buffer);
                        const text = pdfData.text.trim();
                        if (text) contentChunks.push(`[File: ${file.originalname}]\n${text}`);
                        console.log(`[Upload] PDF parsed: ${file.originalname} — ${text.length} chars`);
                    } catch (pdfErr) {
                        console.error(`[Upload] Failed to parse PDF ${file.originalname}:`, pdfErr.message);
                    }
                } else {
                    const text = file.buffer.toString('utf-8').trim();
                    if (text) contentChunks.push(`[File: ${file.originalname}]\n${text}`);
                    console.log(`[Upload] Text file read: ${file.originalname} — ${text.length} chars`);
                }
            }
        }

        const content = contentChunks.join('\n\n---\n\n');

        if (!content) {
            return res.status(400).json({ error: 'No content provided. Paste text or upload files.' });
        }

        // ── Create project record ──────────────────────────────────────────
        const project = new Project({
            user: req.user.id,
            title,
            tags: tagsArray,
            raw_input: content.substring(0, 500000) // Support up to 500k chars (~125k tokens)
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
            infographic: generateInfographic,
            quiz:        generateQuiz
        };

        try {
            console.log(`[AI] Dispatching sequential requests for: ${selectedTypes.join(', ')}`);
            const tStart = Date.now();
            const results = [];

            for (let i = 0; i < selectedTypes.length; i++) {
                const type = selectedTypes[i];
                if (!generators[type]) continue;
                
                try {
                    const cStart = Date.now();
                    const data = await generators[type](content);
                    if (data && data[type]) {
                        results.push({ type, content: data[type] });
                        console.log(`[AI] ✅ ${type} generated in ${Date.now() - cStart}ms`);
                    } else {
                        console.warn(`[AI] ⚠️ ${type} failed: No data returned`);
                        results.push({ type, content: null });
                    }
                } catch (err) {
                    console.error(`[AI] ❌ Error in ${type}:`, err.message);
                    results.push({ type, content: null });
                }

                // Add delay to prevent Gemini free-tier rate limiting (15 RPM), except for the final item
                if (i < selectedTypes.length - 1) {
                    console.log(`[AI] Waiting 2 seconds before next generation to prevent rate limits...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
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
        console.error('[POST /api/projects] SERVER_ERROR:', err.message);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// Global Error Handler (must be registered before listen in Express 5)
app.use((err, req, res, next) => {
    // Log professional error on server
    console.error('--- PRODUCTION ERROR ---');
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    console.error('Message:', err.message);
    if (process.env.NODE_ENV !== 'production') console.error('Stack:', err.stack);
    console.error('-----------------------');

    const status = err.status || err.statusCode || 500;
    const isProd = process.env.NODE_ENV === 'production';
    
    res.status(status).json({ 
        error: status >= 500 ? 'Internal Server Error' : (err.name || 'Bad Request'), 
        message: err.message,
        stack: isProd ? null : err.stack,
        timestamp: new Date().toISOString()
    });
});

// Server listener (skip on Vercel)
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;
