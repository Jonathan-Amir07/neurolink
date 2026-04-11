const mongoose = require('mongoose');

const OutputSchema = new mongoose.Schema({
    type: { type: String, enum: ['notebook', 'mindmap', 'infographic', 'slides', 'flashcards', 'quiz'] },
    content: mongoose.Schema.Types.Mixed, // Storing final HTML/JSON
    created_at: { type: Date, default: Date.now }
});

const ProjectSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    title: { type: String, required: true },
    tags: [{ type: String }],
    raw_input: String, // Original text or source
    outputs: [OutputSchema],
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Project', ProjectSchema);
