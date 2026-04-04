require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testSingle() {
    const key = process.env.GOOGLE_API_KEY;
    const modelName = "models/gemini-1.5-flash-latest"; // Full name
    console.log(`Testing with ${modelName}...`);
    
    try {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Say hello world in JSON format like { \"msg\": \"...\" }");
        const response = await result.response;
        console.log("Success! Response:", response.text());
    } catch (e) {
        console.error("Failed:", e.message);
    }
}

testSingle();
