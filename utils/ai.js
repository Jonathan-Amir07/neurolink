const { GoogleGenerativeAI } = require("@google/generative-ai");

// ── Model Configuration ───────────────────────────────────────────────────────
// Verified working as of April 2026.
// gemini-2.5-flash is the primary model — fast, reliable, and supports responseMimeType.
// gemini-2.0-flash and gemini-2.5-pro are kept as fallbacks but frequently hit
// free-tier daily quotas (429/limit:0), so we heavily prioritize gemini-2.5-flash.
const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODELS = ["gemini-2.0-flash", "gemini-2.5-pro"];

// ── Smart Context Preparation ─────────────────────────────────────────────────
const INPUT_CHAR_LIMITS = {
    notebook:    70000,
    mindmap:     40000,
    flashcards:  40000,
    slides:      40000,
    infographic: 30000,
    quiz:        50000
};

/**
 * Extracts up to `maxChars` characters from the text.
 * If the text has [File: ...] markers (from multi-file uploads),
 * it proportionally samples from each section so every file is represented.
 */
function prepareContext(text, maxChars) {
    if (!text) return '';
    if (text.length <= maxChars) return text;

    const fileSections = text.split(/\n\n---\n\n/);
    if (fileSections.length <= 1) {
        const truncated = text.substring(0, maxChars);
        const lastPeriod = truncated.lastIndexOf('.');
        return lastPeriod > maxChars * 0.9 ? truncated.substring(0, lastPeriod + 1) : truncated;
    }

    const perFileLimit = Math.floor(maxChars / fileSections.length);
    return fileSections
        .map(section => section.substring(0, perFileLimit))
        .join('\n\n---\n\n');
}

/**
 * Parse a JSON object from AI text output. Handles markdown fences,
 * control characters, trailing commas, and other common AI quirks.
 */
function extractJSON(text) {
    // Strip markdown code fences
    let cleaned = text.trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/, '')
        .trim();

    // Find outermost { }
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
        return null;
    }

    let jsonStr = cleaned.substring(start, end + 1);
    // Clean control characters
    jsonStr = jsonStr.replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
    // Fix trailing commas
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');

    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        // Aggressive cleaning attempt
        const ultraCleaned = jsonStr
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
            .replace(/\n/g, " ")
            .replace(/\r/g, " ")
            .replace(/\t/g, " ");
        try {
            return JSON.parse(ultraCleaned);
        } catch (e2) {
            // Last resort: try to repair truncated JSON by closing open brackets
            try {
                let repaired = ultraCleaned;
                // Count open/close braces and brackets
                const openBraces = (repaired.match(/{/g) || []).length;
                const closeBraces = (repaired.match(/}/g) || []).length;
                const openBrackets = (repaired.match(/\[/g) || []).length;
                const closeBrackets = (repaired.match(/\]/g) || []).length;
                
                // Remove any trailing comma or incomplete value
                repaired = repaired.replace(/,\s*$/, '');
                repaired = repaired.replace(/:\s*"[^"]*$/, ': ""');
                repaired = repaired.replace(/,\s*"[^"]*$/, '');
                
                // Close missing brackets/braces
                for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
                for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
                
                return JSON.parse(repaired);
            } catch (e3) {
                return null;
            }
        }
    }
}

/**
 * Core AI call function with smart retry logic.
 * 
 * Strategy:
 * 1. Try PRIMARY_MODEL up to 3 times (with delays for rate limits)
 * 2. Only fall back to FALLBACK_MODELS if the primary is truly down
 * 3. Use responseMimeType: 'application/json' for clean output
 */
async function callAI(prompt, maxRetries = 4, maxTokens = 2000) {
    if (!process.env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY === 'your_gemini_api_key') {
        console.error('[AI] No valid GOOGLE_API_KEY configured');
        return null;
    }
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

    // Build the ordered list of attempts:
    // Primary model gets 3 tries, then each fallback gets 1 try
    const attempts = [
        PRIMARY_MODEL,
        PRIMARY_MODEL,
        PRIMARY_MODEL,
        ...FALLBACK_MODELS
    ].slice(0, maxRetries + 1);

    for (let i = 0; i < attempts.length; i++) {
        const currentModel = attempts[i];
        try {
            console.log(`[AI] Attempt ${i + 1}/${attempts.length}: ${currentModel} (maxTokens: ${maxTokens})`);
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

            if (!text || text.length < 5) {
                throw new Error("Empty response from AI model.");
            }

            const parsed = extractJSON(text);
            if (parsed) {
                console.log(`[AI] ✅ Success with ${currentModel} on attempt ${i + 1}`);
                return parsed;
            }

            throw new Error(`Could not parse JSON from response (${text.length} chars). Preview: ${text.substring(0, 100)}`);
        } catch (error) {
            const msg = error.message || '';
            console.error(`[AI] ❌ ${currentModel} attempt ${i + 1} failed:`, msg.substring(0, 150));
            
            if (i >= attempts.length - 1) {
                console.error('[AI] All attempts exhausted. Returning null.');
                return null;
            }
            
            // Calculate delay based on error type
            const is429 = msg.includes('429') || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('quota');
            const is503 = msg.includes('503') || msg.toLowerCase().includes('overloaded') || msg.toLowerCase().includes('high demand');
            
            let delay;
            if (is429) {
                // Extract retry delay from error if available
                const retryMatch = msg.match(/retry in (\d+)/i);
                delay = retryMatch ? (parseInt(retryMatch[1]) + 2) * 1000 : 10000 + Math.random() * 5000;
            } else if (is503) {
                delay = 5000 + Math.random() * 3000;
            } else {
                delay = 2000 * Math.pow(1.5, i);
            }
            
            console.log(`[AI] Waiting ${Math.round(delay / 1000)}s before retry...`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    return null;
}

async function generateNotebook(text) {
    const prompt = `You are a Master Academic Study Architect. Transform the provided content into a highly detailed, professional study notebook.
CONTENT REQUIREMENTS:
- Create 1-2 CHAPTERS of dense, structured study material.
- Each chapter MUST have exactly 4 sections: 1. Overview, 2. Core Explanation, 3. Key Concepts, 4. Summary & Quiz.
- Use RICH HTML elements: <ul>, <ol>, <table> (for comparisons), and <strong> for Emphasis.
- Focus strictly on conceptual clarity and pedagogical depth.
- Do NOT use markdown in the HTML content—use pure HTML tags.

OUTPUT FORMAT:
Return ONLY a valid JSON object: {"notebook": "html_content"}.
HTML STRUCTURE (Use single quotes ' for all CSS classes):
<section class='notebook-page ruled'>
    <div class='tape-strip'></div>
    <h2>Chapter Number. Chapter Title</h2>
    <div class='notebook-section'><h3>1. Overview</h3><p>Detailed overview...</p></div>
    <div class='notebook-section'><h3>2. Core Explanation</h3><p>Deep dive into mechanics with <ul><li>key point</li></ul>...</p></div>
    <div class='notebook-section'><h3>3. Key Concepts</h3><div class='complexity-list'><strong>Concept</strong>: Definition...</div></div>
    <div class='notebook-section'><h3>4. Summary & Quiz</h3><p>Recap...</p><div class='quiz-box'>Review Question?</div></div>
</section>

Content: ${prepareContext(text, INPUT_CHAR_LIMITS.notebook)}`;
    return await callAI(prompt, 4, 8000);
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
    return await callAI(prompt, 4, 4000);
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
    return await callAI(prompt, 4, 4000);
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

Content: ${prepareContext(text, INPUT_CHAR_LIMITS.slides)}`;
    return await callAI(prompt, 4, 4000);
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

Content: ${prepareContext(text, INPUT_CHAR_LIMITS.infographic)}`;
    return await callAI(prompt, 4, 3000);
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
    return await callAI(prompt, 4, 4000);
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

    try {
        const model = genAI.getGenerativeModel({ model: PRIMARY_MODEL });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return { reply: response.text().trim() };
    } catch (err) {
        console.error('[AI Chat] Failed:', err.message);
        // Try fallback
        for (const fallback of FALLBACK_MODELS) {
            try {
                const model = genAI.getGenerativeModel({ model: fallback });
                const result = await model.generateContent(prompt);
                return { reply: result.response.text().trim() };
            } catch (e) {
                continue;
            }
        }
        return { reply: "I'm having trouble thinking right now. Please try again later." };
    }
}


async function generateStudyMaterials(text, selectedTypes = ['notebook', 'mindmap', 'flashcards', 'slides', 'infographic', 'quiz']) {
    const generators = { notebook: generateNotebook, mindmap: generateMindmap, flashcards: generateFlashcards, slides: generateSlides, infographic: generateInfographic, quiz: generateQuiz };
    const results = {};

    for (const type of selectedTypes) {
        if (generators[type]) {
            console.log(`[AI] Generating ${type}...`);
            const data = await generators[type](text);
            results[type] = data?.[type] ?? null;
            
            // Sequential delay to prevent concurrent rate limiting on free tier
            if (selectedTypes.length > 1) {
                await new Promise(r => setTimeout(r, 1500));
            }
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
