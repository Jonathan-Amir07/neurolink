const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function listAllModels() {
    if (!process.env.GOOGLE_API_KEY) return;
    try {
        // SDK 0.24.1 doesn't have a direct listModels, but we can use the REST API
        const fetch = require('node-fetch'); // Not in package.json, might fail
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (err) {
        // Fallback: try a tiny generation with the most likely successful name
        console.log("Fallback check...");
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        const testModels = ["gemini-pro", "gemini-1.5-flash"];
        for(const m of testModels) {
            try {
                const model = genAI.getGenerativeModel({ model: m });
                await model.generateContent("hi");
                console.log(`✅ ${m} works!`);
            } catch(e) {
                console.log(`❌ ${m} failed: ${e.message}`);
            }
        }
    }
}
listAllModels();
