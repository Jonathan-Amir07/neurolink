require('dotenv').config();
const mongoose = require('mongoose');
const Project = require('./models/Project.js');
const { callAI, generateSlides } = require('./utils/ai.js');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const project = await Project.findOne().sort({created_at: 1}); // Get oldest project
    console.log('Testing slides with content length:', project.raw_input.length);
    try {
        const res = await generateSlides(project.raw_input);
        console.log("FINAL RES:");
        console.log(JSON.stringify(res, null, 2));
    } catch(e) {
        console.error('ERROR:', e.message);
    } finally {
        process.exit(0);
    }
});
