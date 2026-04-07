require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function debugModels() {
    const key = process.env.GOOGLE_API_KEY;
    const fetchResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const data = await fetchResponse.json();
    
    if (!data.models) {
        console.log("No models found.");
        return;
    }

    const genAI = new GoogleGenerativeAI(key);
    for (const m of data.models) {
        if (!m.supportedGenerationMethods.includes('generateContent')) continue;
        
        try {
            console.log(`Testing full name: ${m.name}...`);
            const model = genAI.getGenerativeModel({ model: m.name });
            const result = await model.generateContent("Hi");
            console.log(`✅ ${m.name} works!`);
            process.exit(0);
        } catch (e) {
            console.log(`❌ ${m.name} failed: ${e.message}`);
        }
    }
}
debugModels();
