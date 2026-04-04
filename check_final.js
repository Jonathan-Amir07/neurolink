require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    try {
        const client = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        console.log("Testing call to gemini-1.5-flash...");
        const result = await client.generateContent("Hello?");
        console.log("✅ Success calling gemini-1.5-flash!");
        console.log(result.response.text());
        process.exit(0);
    } catch (error) {
        console.error("❌ Failed calling gemini-1.5-flash:", error.status, error.message);
        if (error.status === 404) {
            console.log("Trying gemini-pro instead...");
            try {
                const client = genAI.getGenerativeModel({ model: "gemini-pro" });
                const result = await client.generateContent("Hello?");
                console.log("✅ Success calling gemini-pro!");
                process.exit(0);
            } catch (err) {
                console.error("❌ Failed calling gemini-pro too:", err.status, err.message);
            }
        }
        process.exit(1);
    }
}

listModels();
