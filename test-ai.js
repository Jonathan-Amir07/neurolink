require('dotenv').config();
const mongoose = require('mongoose');
const Project = require('./models/Project.js');
const { generateNotebook } = require('./utils/ai.js');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const project = await Project.findOne({ raw_input: { $exists: true, $ne: '' } }).sort({created_at: -1});
    if (!project) {
        console.log('No project found');
        process.exit(0);
    }
    console.log('Testing with content length:', project.raw_input.length);
    try {
        const res = await generateNotebook(project.raw_input);
        console.log(res ? 'SUCCESS' : 'FAILED - returned null');
        if (res) {
            console.log('Got notebook keys:', Object.keys(res));
            console.log('Sample content:', res.notebook.substring(0, 100));
        }
    } catch(e) {
        console.error('ERROR:', e.message);
    } finally {
        process.exit(0);
    }
}).catch(err => {
    console.error("DB conn err", err);
    process.exit(1);
});
