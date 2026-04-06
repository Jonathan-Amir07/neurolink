const { GoogleGenerativeAI } = require("@google/generative-ai");

// Model priority: standard SDK names first (work across all environments),
// full-path names as fallback (confirmed working locally).
const MODEL_VARIANTS = [
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "models/gemini-2.5-flash",
    "models/gemini-2.0-flash"
];

async function callAI(prompt, retries = MODEL_VARIANTS.length - 1, maxTokens = 2000) {
    if (!process.env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY === 'your_gemini_api_key') {
        console.error('[AI] No valid GOOGLE_API_KEY configured');
        return null;
    }
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

    for (let i = 0; i <= retries; i++) {
        const currentModel = MODEL_VARIANTS[i % MODEL_VARIANTS.length];
        try {
            console.log(`[AI] Dispatching to: ${currentModel} (maxTokens: ${maxTokens})`);
            const model = genAI.getGenerativeModel({ 
                model: currentModel,
                generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 } 
            });

            const result = await model.generateContent(prompt);
            const response = await result.response;
            let text = response.text().trim();

            // Handle potential markdown block wrapper
            text = text.replace(/^```json/, '').replace(/```$/, '').trim();
            
            // Robust JSON extraction
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start !== -1 && end !== -1 && end > start) {
                const jsonStr = text.substring(start, end + 1);
                try {
                    return JSON.parse(jsonStr);
                } catch (parseErr) {
                    console.warn(`[AI] JSON parse attempt 1 failed: ${parseErr.message}. Attempting to clean string...`);
                    // Final fallback: try to strip any control characters or invalid whitespace
                    const cleaned = jsonStr.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
                    return JSON.parse(cleaned);
                }
            }
            throw new Error("No valid JSON object found in AI response.");
        } catch (error) {
            console.error(`[AI] Attempt ${i + 1} failed (${currentModel}):`, error.message);
            if (i === retries) return null;
            await new Promise(r => setTimeout(r, 1000)); // Increased wait between retries
        }
    }
}

async function generateNotebook(text) {
    const prompt = `You are an AI Study Architect. Transform the provided content into a structured study notebook.
CONTENT REQUIREMENTS:
- Create 1-2 highly detailed chapters.
- Each chapter MUST have exactly 4 sections: 1. Overview, 2. Core Explanation, 3. Key Concepts, 4. Summary & Quiz.
- Focus on conceptual clarity and pedagogical structure.
OUTPUT FORMAT:
Return ONLY a valid JSON object: {"notebook": "html_content"}.
Use this HTML structure for every chapter:
<section class="notebook-page ruled">
    <h2>Chapter Number. Chapter Title</h2>
    <div class="notebook-section"><h3>1. Overview</h3><p>...</p></div>
    <div class="notebook-section"><h3>2. Core Explanation</h3><p>...</p></div>
    <div class="notebook-section"><h3>3. Key Concepts</h3><p>...</p></div>
    <div class="notebook-section"><h3>4. Summary & Quiz</h3><p>...</p></div>
</section>

Content: ${text.substring(0, 3500)}`;
    return await callAI(prompt, 1, 4000); // Higher token limit for notebooks
}

async function generateMindmap(text) {
    const prompt = `Create a hierarchical mind map from the following academic content.
Return ONLY a valid JSON object with this exact shape:
{"mindmap": {"title": "Root Topic", "icon": "🧠", "desc": "Short description", "children": [{"title": "Branch", "icon": "📚", "desc": "Description", "children": []}]}}

Guidelines:
- Root node is the main topic
- 3-6 main branches covering core concepts
- Each branch can have 2-4 children
- Use relevant emojis for icons
- Keep desc fields concise (one sentence)

Content: ${text}`;
    return await callAI(prompt);
}

async function generateFlashcards(text) {
    const prompt = `Generate study flashcards from the following academic content.
Return ONLY a valid JSON object with this exact shape:
{"flashcards": [{"title": "Category or Chapter", "question": "Clear question text", "answer": "Concise answer text"}]}

Guidelines:
- Generate 10-15 flashcards
- Mix definition, concept, comparison, and application question types
- Keep answers concise (1-3 sentences)
- Cover the most important concepts

Content: ${text}`;
    return await callAI(prompt);
}

async function generateSlides(text) {
    const prompt = `Create presentation slide content from the following academic content.
Return ONLY a valid JSON object with this exact shape:
{"slides": [{"title": "Slide Title", "bullets": ["Point one", "Point two", "Point three"]}]}

Guidelines:
- Generate 8-12 slides
- First slide: title/overview
- Last slide: summary/key takeaways
- 3-5 bullet points per slide
- Keep bullets short and scannable

Content: ${text}`;
    return await callAI(prompt);
}

async function generateInfographic(text) {
    const prompt = `Create infographic sections from the following academic content.
Return ONLY a valid JSON object with this exact shape:
{"infographic": [{"icon": "📌", "title": "Section Title", "content": "2-3 sentence summary of this concept"}]}

Guidelines:
- Generate 5-7 sections
- Use relevant emojis for icons (📌📚🔑⚡🎯🧪🔬💡📐🔄)
- Each section covers one core concept
- Content should be scannable, not dense prose

Content: ${text}`;
    return await callAI(prompt);
}

async function generateStudyMaterials(text, selectedTypes = ['notebook', 'mindmap', 'flashcards', 'slides', 'infographic']) {
    const generators = { notebook: generateNotebook, mindmap: generateMindmap, flashcards: generateFlashcards, slides: generateSlides, infographic: generateInfographic };
    const results = {};

    for (const type of selectedTypes) {
        if (generators[type]) {
            const data = await generators[type](text);
            results[type] = data?.[type] ?? null;
        }
    }
    return results;
}

module.exports = {
    generateNotebook,
    generateMindmap,
    generateFlashcards,
    generateSlides,
    generateInfographic,
    generateStudyMaterials
};
