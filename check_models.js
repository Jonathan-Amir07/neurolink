require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function check() {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro-vision", "gemini-pro"];
    
    for (const m of models) {
        try {
            const model = genAI.getGenerativeModel({ model: m });
            const result = await model.generateContent("Hi");
            console.log(`✅ ${m} works`);
            break;
        } catch (e) {
            console.log(`❌ ${m} fails: ${e.status} ${e.message}`);
        }
    }
}
check();
