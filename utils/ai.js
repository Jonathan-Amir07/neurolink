const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

async function generateStudyMaterials(content) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    You are an academic expert. Based on the following study notes, generate exactly 3 structured outputs in JSON format.
    
    1. A Mind Map: root node with 'title', 'icon', 'desc', and 'children' (recursive list of objects with the same keys).
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
    console.log("Raw AI Response Sample:", text.substring(0, 500), "...");
    
    // Robustly extract JSON from between ```json and ``` or just find the first { and last }
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No valid JSON found in AI response");
    
    const materials = JSON.parse(jsonMatch[0]);
    console.log("Materials parsed successfully. Keys found:", Object.keys(materials));
    
    // Check if mindmap is missing or empty
    if (!materials.mindmap || Object.keys(materials.mindmap).length === 0) {
        console.warn("⚠️  Mindmap is missing or empty in AI response!");
    }

    return materials;
  } catch (err) {
    console.error("AI Generation failed:", err);
    throw err;
  }
}

module.exports = { generateStudyMaterials };
