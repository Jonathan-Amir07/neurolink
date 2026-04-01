/* 
   Diagnostic Script: List available models for your API Key
   Run this with: node list_models.js
*/
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

if (!process.env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY === 'your_gemini_api_key') {
    console.error("❌ No API Key found in .env file.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

async function listModels() {
    console.log("🔍 Checking available models for your API key...");
    try {
        const genModel = genAI.getGenerativeModel({ model: "gemini-pro" }); 
        // We use a low-level fetch here since 'listModels' is not on the main genAI object in all SDK versions
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_API_KEY}`);
        const data = await response.json();
        
        if (data.models) {
            const names = data.models.map(m => m.name.split('/').pop());
            console.log("✅ Models found: " + names.join(", "));
        } else {
            console.error("❌ No models returned. Data:", data);
        }
    } catch (err) {
        console.error("❌ Error listing models:", err.message);
    }
}

listModels();
