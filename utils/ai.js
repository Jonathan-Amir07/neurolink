const { GoogleGenerativeAI } = require("@google/generative-ai");

// Model priority: standard SDK names first (work across all environments),
// full-path names as fallback (confirmed working locally).
const MODEL_VARIANTS = [
    "gemini-1.5-flash", 
    "gemini-1.5-pro", 
    "gemini-2.0-flash"
];

// Cache the index of the last known-working model to skip failed ones on subsequent calls
let workingModelIndex = 0;

// ── Smart Context Preparation ─────────────────────────────────────────────────
// Gemini free-tier safe limit: ~100k characters (≈25k tokens)
// We proportionally sample from each file section to fit under this ceiling
const INPUT_CHAR_LIMITS = {
    notebook:    70000,   // Needs most detail
    mindmap:     40000,   // Structural overview
    flashcards:  40000,   // Q&A pairs
    slides:      40000,   // Key points
    infographic: 30000,   // Short summaries
    quiz:        50000    // Detailed testing
};

/**
 * Extracts up to `maxChars` characters from the text.
 * If the text has [File: ...] markers (from multi-file uploads),
 * it proportionally samples from each section so every file is represented.
 */
function prepareContext(text, maxChars) {
    if (!text) return '';
    if (text.length <= maxChars) return text;

    // Detect file sections created by backend aggregation
    const fileSections = text.split(/\n\n---\n\n/);
    if (fileSections.length <= 1) {
        // Single source — just truncate at a sentence boundary
        const truncated = text.substring(0, maxChars);
        const lastPeriod = truncated.lastIndexOf('.');
        return lastPeriod > maxChars * 0.9 ? truncated.substring(0, lastPeriod + 1) : truncated;
    }

    // Multiple files — give each file an equal share of the budget
    const perFileLimit = Math.floor(maxChars / fileSections.length);
    return fileSections
        .map(section => section.substring(0, perFileLimit))
        .join('\n\n---\n\n');
}

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
                // Fix case where AI used single quotes for keys
                jsonStr = jsonStr.replace(/'([^']+)':/g, '"$1":');
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
            
            const isRateLimit = error.message.includes('429') || error.message.toLowerCase().includes('rate limit') || error.message.toLowerCase().includes('quota');
            const delay = isRateLimit ? (4000 + (Math.random() * 2000)) : (1000 * Math.pow(2, i));
            console.log(`[AI] Delaying retries for ${Math.round(delay/1000)}s due to potential rate limits...`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
}

async function generateNotebook(text) {
    const prompt = `You are a Master Academic Study Architect. Transform the provided content into a highly detailed, professional study notebook.
CONTENT REQUIREMENTS:
- Create 1-2 CHAPTERS of dense, structured study material.
- Each chapter MUST have exactly 4 sections: 1. Overview, 2. Core Explanation, 3. Key Concepts, 4. Summary & Quiz.
- Focus strictly on conceptual clarity and pedagogical depth.
OUTPUT FORMAT:
Return ONLY a valid JSON object: {"notebook": "html_content"}.
HTML STRUCTURE (Use single quotes ' for all CSS classes):
<section class='notebook-page ruled'>
    <div class='tape-strip'></div>
    <h2>Chapter Number. Chapter Title</h2>
    <div class='notebook-section'><h3>1. Overview</h3><p>Detailed overview...</p></div>
    <div class='notebook-section'><h3>2. Core Explanation</h3><p>Deep dive into mechanics...</p></div>
    <div class='notebook-section'><h3>3. Key Concepts</h3><p>Definitions and relationships...</p></div>
    <div class='notebook-section'><h3>4. Summary & Quiz</h3><p>Recap and 3 review questions...</p></div>
</section>

Content: ${prepareContext(text, INPUT_CHAR_LIMITS.notebook)}`;
    return await callAI(prompt, MODEL_VARIANTS.length - 1, 5000);
}

async function generateMindmap(text) {
    const prompt = `You are an AI Knowledge Mapper, Visual Learning Architect, and UI Designer. 
Your task is to take a structured study notebook and convert it into a detailed, interactive mind map JSON that preserves the physical notebook aesthetic.

STRUCTURE RULES:
1. ROOT NODE: The notebook title becomes the central/root node.
2. CHAPTER NODES: Each chapter becomes a first-level node.
3. SECTION NODES: Each section becomes a child node.
4. NODE CONTENT: Each node MUST include:
   - title: (Clear heading)
   - desc: (ONE concise explanation sentence only)
   - icon: (A single symbolic emoji: 📌, 📚, 🔑, ⚡, 🎯, 🧪, 🔬, 💡, 📐, 🔄)

Return ONLY a valid JSON object with this exact shape:
{"mindmap": {"title": "Root Topic", "icon": "🧠", "desc": "One sentence overview", "children": [{"title": "Chapter", "icon": "📚", "desc": "Concise summary", "children": [...]}]}}

Guidelines:
- Do NOT include long paragraphs.
- Focus on clarity and hierarchical relationships.
- Use meaningful icons for every node.

Content: ${prepareContext(text, INPUT_CHAR_LIMITS.mindmap)}`;
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

Content: ${prepareContext(text, INPUT_CHAR_LIMITS.flashcards)}`;
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
- Ensure the output strictly follows the JSON structure.

Content: ${prepareContext(text, INPUT_CHAR_LIMITS.slides)}`;
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
- Ensure the output is high-fidelity and uses single quotes for nested HTML if any.

Content: ${prepareContext(text, INPUT_CHAR_LIMITS.infographic)}`;
    return await callAI(prompt, MODEL_VARIANTS.length - 1, 2000);
}

async function generateQuiz(text) {
    const prompt = `Generate a multiple-choice quiz from the following academic content to test comprehension.
Return ONLY a valid JSON object with this exact shape:
{"quiz": [{"question": "Clear question text", "options": ["Option 1", "Option 2", "Option 3", "Option 4"], "correctAnswerIndex": 0, "explanation": "Why this is correct"}]}

Guidelines:
- Generate 5-10 multiple-choice questions.
- Make exactly 4 options per question.
- 'correctAnswerIndex' must be an integer (0, 1, 2, or 3) indicating the index of the correct option in the options array.
- Provide a brief 1-2 sentence explanation for the correct answer.
- Test important concepts, definitions, and applications.
- Avoid tricky phrasing; focus on actual learning validation.

Content: ${prepareContext(text, INPUT_CHAR_LIMITS.quiz)}`;
    return await callAI(prompt, MODEL_VARIANTS.length - 1, 3000);
}


async function chatWithAI(context, userMessage) {
    const prompt = `You are the NeuroLink AI Study Mate, a friendly academic tutor. 
Your goal is to help the student understand the provided study content. 
Be concise, encouraging, and clear. If the answer isn't in the context, use your general knowledge but mention it's outside the current notes.

Context (Student's Study Material):
${prepareContext(context, 50000)}

Student: ${userMessage}
NeuroLink Study Mate:`;

    // chat doesn't need JSON enforcement
    if (!process.env.GOOGLE_API_KEY) return { reply: "API Key missing." };
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const currentModel = MODEL_VARIANTS[workingModelIndex];

    try {
        const model = genAI.getGenerativeModel({ model: currentModel });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return { reply: response.text().trim() };
    } catch (err) {
        console.error('[AI Chat] Failed:', err.message);
        return { reply: "I'm having trouble thinking right now. Please try again later." };
    }
}


async function generateStudyMaterials(text, selectedTypes = ['notebook', 'mindmap', 'flashcards', 'slides', 'infographic', 'quiz']) {
    const generators = { notebook: generateNotebook, mindmap: generateMindmap, flashcards: generateFlashcards, slides: generateSlides, infographic: generateInfographic, quiz: generateQuiz };
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
    generateQuiz,
    generateStudyMaterials,
    chatWithAI
};
