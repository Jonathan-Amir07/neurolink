require('dotenv').config();

async function listModels() {
    const key = process.env.GOOGLE_API_KEY;
    if (!key) {
        console.error("No API key found in .env");
        return;
    }
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await response.json();
        
        if (data.models) {
            console.log("Available Gemini Models:");
            data.models.forEach(m => {
                console.log(`- ${m.name}`);
            });
        } else {
            console.log("No models returned. API Response:", data);
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

listModels();
