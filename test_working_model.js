require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function test() {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const models = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-1.5-pro", "gemini-pro"];
    
    for (const m of models) {
        try {
            console.log(`Testing ${m}...`);
            const model = genAI.getGenerativeModel({ model: m });
            const result = await model.generateContent("Hi");
            console.log(`✅ ${m} works! Response: ${result.response.text()}`);
            process.exit(0);
        } catch (e) {
            console.log(`❌ ${m} failed: ${e.message}`);
        }
    }
    process.exit(1);
}
test();
