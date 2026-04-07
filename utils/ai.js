const { GoogleGenerativeAI } = require("@google/generative-ai");

// Model priority: standard SDK names first (work across all environments),
// full-path names as fallback (confirmed working locally).
const MODEL_VARIANTS = [
    "models/gemini-2.5-flash",
    "models/gemini-flash-latest",
    "models/gemini-2.5-pro",
    "models/gemini-2.0-flash"
];

// Cache the index of the last known-working model to skip failed ones on subsequent calls
let workingModelIndex = 0;

async function callAI(prompt, retries = MODEL_VARIANTS.length - 1, maxTokens = 2000) {
    if (!process.env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY === 'your_gemini_api_key') {
        console.error('[AI] No valid GOOGLE_API_KEY configured');
        return null;
    }
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

    // Try starting from the last known-working model
    const startIndex = workingModelIndex;

    for (let i = 0; i <= retries; i++) {
        const modelIndex = (startIndex + i) % MODEL_VARIANTS.length;
        const currentModel = MODEL_VARIANTS[modelIndex];
        try {
            console.log(`[AI] Trying model: ${currentModel} (maxTokens: ${maxTokens})`);
            const model = genAI.getGenerativeModel({ 
                model: currentModel,
                generationConfig: { 
                    maxOutputTokens: maxTokens, 
                    temperature: 0.7,
                    responseMimeType: "application/json"
                } 
            });

            const result = await model.generateContent(prompt);
            const response = await result.response;
            let text = response.text().trim();

            // Strip markdown code fences
            text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

            // Robust JSON extraction — find outermost { }
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start !== -1 && end !== -1 && end > start) {
                let jsonStr = text.substring(start, end + 1);
                // Clean control characters that break JSON.parse
                jsonStr = jsonStr.replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
                // Fix common AI mistakes: trailing commas before } or ]
                jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
                try {
                    const parsed = JSON.parse(jsonStr);
                    workingModelIndex = modelIndex;
                    console.log(`[AI] ✅ Success with: ${currentModel}`);
                    return parsed;
                } catch (parseErr) {
                    console.warn(`[AI] JSON parse failed: ${parseErr.message}. Cleaning...`);
                    // Second attempt: aggressive cleaning
                    const cleaned = jsonStr
                        .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control chars
                        .replace(/\n/g, " ") // Flatten newlines
                        .replace(/\r/g, " ")
                        .replace(/\\"/g, '"') // In case AI double-escaped
                        .replace(/\\'/g, "'");
                    try {
                        const parsed = JSON.parse(cleaned);
                        workingModelIndex = modelIndex;
                        return parsed;
                    } catch (finalErr) {
                        console.error("[AI] Final JSON parse failed after cleaning.");
                        throw finalErr;
                    }
                }
            }
            throw new Error("No valid JSON object found in AI response.");
        } catch (error) {
            console.error(`[AI] ❌ ${currentModel} failed:`, error.message);
            if (i === retries) return null;
            // Exponential backoff: 300ms, 600ms, 1200ms...
            await new Promise(r => setTimeout(r, 300 * Math.pow(2, i)));
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
Use this HTML structure for every chapter (IMPORTANT: Use single quotes ' for attributes to prevent JSON errors):
<section class='notebook-page ruled'>
    <h2>Chapter Number. Chapter Title</h2>
    <div class='notebook-section'><h3>1. Overview</h3><p>...</p></div>
    <div class='notebook-section'><h3>2. Core Explanation</h3><p>...</p></div>
    <div class='notebook-section'><h3>3. Key Concepts</h3><p>...</p></div>
    <div class='notebook-section'><h3>4. Summary & Quiz</h3><p>...</p></div>
</section>

Ensure the HTML content is a valid string, escaping any internal double quotes if they occur within text (though single quotes are preferred).

Content: ${text}`;
    return await callAI(prompt, MODEL_VARIANTS.length - 1, 5000); // 5k tokens for notebook content
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
    return await callAI(prompt, MODEL_VARIANTS.length - 1, 2500);
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
    return await callAI(prompt, MODEL_VARIANTS.length - 1, 2500);
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
- Avoid double quotes " inside bullet points if possible—use single quotes '

Content: ${text}`;
    return await callAI(prompt, MODEL_VARIANTS.length - 1, 4000);
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
    return await callAI(prompt, MODEL_VARIANTS.length - 1, 2000);
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
