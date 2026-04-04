require('dotenv').config();
const { generateStudyMaterials } = require('./utils/ai');

async function test() {
    console.log("Testing AI generation with 5 components...");
    const content = "The solar system consists of the Sun and eight planets. Mercury is the smallest planet.";
    
    try {
        const materials = await generateStudyMaterials(content);
        const keys = Object.keys(materials);
        console.log("Keys found:", keys);
        
        const expected = ['notebook', 'mindmap', 'flashcards', 'slides', 'infographic'];
        const missing = expected.filter(k => !keys.includes(k));
        
        if (missing.length === 0) {
            console.log("SUCCESS: All 5 components generated!");
        } else {
            console.error("FAILURE: Missing components:", missing);
        }
        process.exit(0);
    } catch (err) {
        console.error("Test failed:", err);
        process.exit(1);
    }
}

test();
