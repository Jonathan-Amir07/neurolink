require('dotenv').config();
const { 
    generateNotebook, 
    generateMindmap, 
    generateFlashcards, 
    generateSlides, 
    generateInfographic 
} = require('./utils/ai');

const dummyText = "A inteligência artificial é a capacidade de dispositivos eletrônicos de funcionarem de maneira semelhante ao pensamento humano.";

async function runTest() {
    console.log("Starting Sequential AI Verification Test...");
    
    try {
        console.log("\n1. Generating Notebook...");
        const n = await generateNotebook(dummyText);
        console.log("Result:", n ? "SUCCESS (Notebook key found)" : "FAILED");

        console.log("\n2. Generating Mindmap...");
        const m = await generateMindmap(dummyText);
        console.log("Result:", m ? "SUCCESS (Mindmap key found)" : "FAILED");

        console.log("\n3. Generating Flashcards...");
        const f = await generateFlashcards(dummyText);
        console.log("Result:", f ? "SUCCESS (Flashcards key found)" : "FAILED");

        console.log("\n4. Generating Slides...");
        const s = await generateSlides(dummyText);
        console.log("Result:", s && s.slides ? `SUCCESS (Found ${s.slides.length} slides)` : "FAILED");
        if (s && s.slides) console.log("Preview Sample:", s.slides[0]);

        console.log("\n5. Generating Infographic...");
        const i = await generateInfographic(dummyText);
        console.log("Result:", i && i.infographic ? `SUCCESS (Found ${i.infographic.length} sections)` : "FAILED");
        if (i && i.infographic) console.log("Preview Sample:", i.infographic[0]);

    } catch (e) {
        console.error("Test process crashed:", e);
    }
}

runTest();
