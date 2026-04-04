require('dotenv').config();
const { generateNotebook, generateMindmap, generateFlashcards, generateSlides, generateInfographic } = require('./utils/ai');

async function testParallelAI() {
    console.log("Testing Parallel AI Generation...");
    const content = "The solar system consists of the Sun and eight planets. Mars is known as the red planet.";
    
    try {
        console.log("Launching requests in parallel...");
        const results = await Promise.all([
            generateNotebook(content),
            generateMindmap(content),
            generateFlashcards(content),
            generateSlides(content),
            generateInfographic(content)
        ]);
        
        const labels = ['Notebook', 'Mindmap', 'Flashcards', 'Slides', 'Infographic'];
        let successCount = 0;
        
        results.forEach((res, i) => {
            if (res) {
                console.log(`✅ ${labels[i]} generated! Keys:`, Object.keys(res));
                successCount++;
            } else {
                console.error(`❌ ${labels[i]} failed to parse.`);
            }
        });
        
        if (successCount === 5) {
            console.log("\nFULL SUCCESS: All 5 components generated independently!");
        } else {
            console.error(`\nPARTIAL SUCCESS: Only ${successCount}/5 generated.`);
        }
        process.exit(0);
    } catch (err) {
        console.error("Test execution failed:", err);
        process.exit(1);
    }
}

testParallelAI();
