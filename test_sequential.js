require('dotenv').config();
const { generateNotebook, generateMindmap, generateFlashcards, generateSlides, generateInfographic } = require('./utils/ai');

async function testSequentialAI() {
    console.log("Testing Sequential AI Generation...");
    const content = "The solar system consists of the Sun and eight planets. Mars is known as the red planet.";
    
    try {
        console.log("Launching requests one by one...");
        const notebook = await generateNotebook(content);
        console.log("✅ Notebook generated!");
        const mindmap = await generateMindmap(content);
        console.log("✅ Mindmap generated!");
        const flashcards = await generateFlashcards(content);
        console.log("✅ Flashcards generated!");
        const slides = await generateSlides(content);
        console.log("✅ Slides generated!");
        const infographic = await generateInfographic(content);
        console.log("✅ Infographic generated!");
        
        console.log("\nFULL SUCCESS: All 5 components generated sequentially!");
        process.exit(0);
    } catch (err) {
        console.error("Test execution failed:", err);
        process.exit(1);
    }
}

testSequentialAI();
