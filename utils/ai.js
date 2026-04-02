const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

async function generateStudyMaterials(content) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    You are an academic expert. Based on the following study notes, generate exactly 3 structured outputs in JSON format.
    
    1. A Mind Map: root title, icon, and children (title, icon, desc, and nested children).
    2. Flashcards: a list of objects with title, question, and answer.
    3. A Study Notebook: 1-2 pages of rich HTML content with headers, bullet points, and clear formatting.

    Study Notes:
    ${content}

    Format the response as a single JSON object with keys: "mindmap", "flashcards", "notebook".
    The mindmap should be recursive. Use high-quality emojis for icons.
  `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // Robustly extract JSON from between ```json and ``` or just find the first { and last }
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No valid JSON found in AI response");
    
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("AI Generation failed:", err);
    throw err;
  }
}

module.exports = { generateStudyMaterials };
