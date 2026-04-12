const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function listModels() {
    if (!process.env.GOOGLE_API_KEY) {
        console.error("GOOGLE_API_KEY not found in .env");
        return;
    }
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    try {
        // The SDK doesn't have a direct 'listModels' in the same way the REST API does,
        // but we can try common names.
        const models = [
            "gemini-1.5-flash",
            "gemini-1.5-flash-latest",
            "gemini-1.5-flash-8b",
            "gemini-1.5-pro",
            "gemini-2.0-flash",
            "gemini-2.0-pro-exp-02-05", // Example of latest exp
            "gemini-2.0-flash-lite-preview-02-05"
        ];
        
        for (const m of models) {
            try {
                const model = genAI.getGenerativeModel({ model: m });
                const result = await model.generateContent("test");
                console.log(`✅ ${m} is working`);
            } catch (e) {
                console.log(`❌ ${m} failed: ${e.message}`);
                if (e.response) {
                    console.log(`   Detailed Response: ${JSON.stringify(e.response, null, 2)}`);
                }
            }
        }
    } catch (err) {
        console.error("Error listing models:", err);
    }
}

listModels();
