const { GoogleGenerativeAI } = require("@google/generative-ai");

// ── Model Configuration ───────────────────────────────────────────────────────
// Verified working as of April 2026.
// gemini-2.5-flash is the primary model — fast, reliable, and supports responseMimeType.
// gemini-2.0-flash and gemini-2.5-pro are kept as fallbacks but frequently hit
// free-tier daily quotas (429/limit:0), so we heavily prioritize gemini-2.5-flash.
const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODELS = ["gemini-flash-lite-latest", "gemini-2.0-flash-lite", "gemini-2.0-flash", "gemini-2.5-pro"];

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
 * Compresses an HTML notebook down to its structural hierarchy (Headings only).
 * This significantly reduces context token usage for the Mind Map generator.
 */
function getNotebookStructure(html) {
    if (!html) return '';
    // Extract H2 (Chapters), H3 (Sections), and strong/bold terms (sub-concepts)
    const matches = html.match(/<(h2|h3|strong|li)[^>]*>([\s\S]*?)<\/\1>/gi) || [];
    // Filter out very long strings to keep it structural
    return matches
        .map(m => m.replace(/<[^>]+>/g, '').trim())
        .filter(t => t.length > 2 && t.length < 100)
        .join('\n');
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
    
    // Clean control characters and unusual whitespace
    jsonStr = jsonStr.replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
    
    // Fix common AI JSON errors: trailing commas before closing braces
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
    
    // Fix unescaped newlines inside strings (critical for long notebook HTML)
    // We target newlines that are NOT followed by a "property": pattern
    // This is a bit risky but helped in previous runs
    // Actually, it's safer to just rely on the model for now if possible, 
    // but the repair logic below is a good fallback.

    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        console.warn('[AI] JSON Parse failed, attempting aggressive repair...');
        
        // Attempt 2: Remove actual newlines inside the JSON string (replace with \n)
        // Note: This is an aggressive repair for long HTML blocks
        try {
            const repairedWhitespace = jsonStr.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
            // This might break the actual structure if not careful, so we only do it if the first failed.
            // But wait, the common issue is unescaped newlines in JSON strings.
            // Let's try to just close the JSON if it's truncated.
            
            let repaired = jsonStr;
            const openBraces = (repaired.match(/{/g) || []).length;
            const closeBraces = (repaired.match(/}/g) || []).length;
            const openBrackets = (repaired.match(/\[/g) || []).length;
            const closeBrackets = (repaired.match(/\]/g) || []).length;
            
            if (openBraces > closeBraces || openBrackets > closeBrackets) {
                // Truncated JSON repair
                repaired = repaired.replace(/,\s*$/, '');
                repaired = repaired.replace(/:\s*"[^"]*$/, ': ""');
                for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
                for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
                return JSON.parse(repaired);
            }
        } catch (e2) {
            return null;
        }
        return null;
    }
}

/**
 * Core AI call function with multi-key rotation and smart retry logic.
 * 
 * Strategy:
 * 1. Collect all available API keys (GOOGLE_API_KEY, GOOGLE_API_KEY_2, GOOGLE_API_KEY_3)
 * 2. For each key: try PRIMARY_MODEL first, then fallbacks
 * 3. If ALL keys are quota-exhausted (429 on every attempt), fail fast with clear message
 * 4. Use responseMimeType: 'application/json' for clean output
 */
function getApiKeys() {
    const keys = [];
    const k1 = process.env.GOOGLE_API_KEY;
    const k2 = process.env.GOOGLE_API_KEY_2;
    const k3 = process.env.GOOGLE_API_KEY_3;
    if (k1 && k1 !== 'your_gemini_api_key') keys.push(k1);
    if (k2 && k2 !== 'your_gemini_api_key') keys.push(k2);
    if (k3 && k3 !== 'your_gemini_api_key') keys.push(k3);
    return keys;
}

async function callAI(prompt, maxRetries = 3, maxTokens = 2000, expectJson = true) {
    const apiKeys = getApiKeys();
    if (apiKeys.length === 0) {
        console.error('[AI] No valid GOOGLE_API_KEY configured');
        return null;
    }

    // Try each API key
    for (let keyIdx = 0; keyIdx < apiKeys.length; keyIdx++) {
        const genAI = new GoogleGenerativeAI(apiKeys[keyIdx]);
        const keyLabel = apiKeys.length > 1 ? ` [Key ${keyIdx + 1}/${apiKeys.length}]` : '';
        
        // For each key: try primary model, then fallbacks
        const models = [PRIMARY_MODEL, ...FALLBACK_MODELS];
        let allQuotaExhausted = true;

        for (let i = 0; i < models.length; i++) {
            const currentModel = models[i];
            try {
                console.log(`[AI]${keyLabel} Trying ${currentModel} (maxTokens: ${maxTokens})`);
                
                const genConfig = { 
                    maxOutputTokens: maxTokens, 
                    temperature: 0.7 
                };
                if (expectJson) genConfig.responseMimeType = "application/json";

                const model = genAI.getGenerativeModel({ 
                    model: currentModel,
                    generationConfig: genConfig
                });

                const result = await model.generateContent(prompt);
                const response = await result.response;
                let text = response.text().trim();

                if (!text || text.length < 5) {
                    throw new Error("Empty response from AI model.");
                }

                if (!expectJson) {
                    console.log(`[AI]${keyLabel} ✅ Success with ${currentModel} (Raw Text)`);
                    return text;
                }

                const parsed = extractJSON(text);
                if (parsed) {
                    console.log(`[AI]${keyLabel} ✅ Success with ${currentModel}`);
                    return parsed;
                }

                throw new Error(`Could not parse JSON from response (${text.length} chars)`);
            } catch (error) {
                const msg = error.message || '';
                const is429 = msg.includes('429') || msg.toLowerCase().includes('quota');
                
                console.error(`[AI]${keyLabel} ❌ ${currentModel} failed:`, msg.substring(0, 120));
                
                if (!is429) {
                    allQuotaExhausted = false;
                    // Non-quota error: wait briefly and try next model
                    if (i < models.length - 1) {
                        await new Promise(r => setTimeout(r, 1500));
                    }
                }
                // For 429: skip immediately to next model/key (no wait)
            }
        }
        
        if (allQuotaExhausted && keyIdx < apiKeys.length - 1) {
            console.log(`[AI] Key ${keyIdx + 1} quota exhausted, rotating to next key...`);
        }
    }
    
    console.error('[AI] All API keys and models exhausted. Returning null.');
    return null;
}

async function generateNotebook(text) {
    const prompt = `You are an AI Study Architect, Curriculum Engineer, and Technical Educator.

Your task is to transform the provided content into a deeply structured study notebook that explains the subject thoroughly and clearly, resembling a handwritten study notebook but containing detailed, textbook-quality explanations.

━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━
Return ONLY raw HTML. Do NOT wrap the output in JSON, markdown code blocks, or any other formatting.

━━━━━━━━━━━━━━━━━━━━━━━━
CONTENT REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━
Break the topic into sensible, logically flowing CHAPTERS based naturally on the provided source text.
Write at university-level depth. Do NOT produce short summaries.
If a concept introduces a complex subtopic, expand it naturally as a detailed <h3> subsection.
Do NOT force an artificial or repetitive structure. Let the content dictate the flow just like a real handwritten study notebook.

━━━━━━━━━━━━━━━━━━━━━━━━
HTML STRUCTURE STYLES (use single quotes only):
━━━━━━━━━━━━━━━━━━━━━━━━
Use these structures where appropriate to enhance readability:
1. Chapters: <section class='notebook-page ruled'><div class='tape-strip'></div><h2>...</h2>...content...</section>
2. Subtopics: <h3>...</h3>
3. Complexity/Feature lists (Left Border Highlight): <ul class='complexity-list'><li><strong>Keyword:</strong> description</li></ul>
4. Code Blocks (Chalkboard style): <div class='chalkboard'><pre><span class='comment'>// comment</span>
<span class='type'>type</span> <span class='keyword'>name</span>() { ... }</pre></div>
5. Tables: Use standard HTML tables with <th> headers for comparisons or tabular data.
6. End-of-Notebook Quizzes MUST strictly use this exact format:
   <div class='quiz-box'><h3>Questions:</h3><ol><li>Question?</li></ol></div>
   <div class='answer-box'><h3>Answers:</h3><ul><li><strong>A1:</strong> Answer.</li></ul></div>

━━━━━━━━━━━━━━━━━━━━━━━━
QUALITY RULES:
━━━━━━━━━━━━━━━━━━━━━━━━
- EVERY single section must contain deep technical or conceptual explanations. NO filler or one-liners.
- Do NOT use markdown. Use raw HTML tags with single quotes ONLY.
- End the final notebook page with a comprehensive Practice Quiz utilizing BOTH the quiz-box and answer-box divs.
- Output pure HTML directly without any surrounding backticks or JSON wrappers.

Content: ${prepareContext(text, INPUT_CHAR_LIMITS.notebook)}`;
    // Pass expectJson = false to receive the raw huge HTML string without escaping errors
    return await callAI(prompt, 4, 16000, false);
}

async function generateMindmap(text, notebookHtml = null) {
    const structure = notebookHtml ? getNotebookStructure(notebookHtml) : text;
    const prompt = `You are an AI Knowledge Mapper and Visual Architect.
Your task is to take the provided study structure and convert it into a detailed Mind Map JSON object.

━━━━━━━━━━━━━━━━━━
GOAL
━━━━━━━━━━━━━━━━━━
Map the concepts into a hierarchical JSON structure that our frontend will render as a premium handwritten notebook.
Each node represents a key concept from the study material.

━━━━━━━━━━━━━━━━━━
NODE REQUIREMENTS
━━━━━━━━━━━━━━━━━━
For EVERY node, provide:
- title: (Clear heading)
- desc: (ONE concise explanation sentence only)
- icon: (A symbolic emoji: 🧠, 📚, 🔑, ⚡, 🎯, 🧪, 🔬, 💡, 📐, 🔄)

━━━━━━━━━━━━━━━━━━
RESPONSE SCHEMA
━━━━━━━━━━━━━━━━━━
Return ONLY a valid JSON object with this exact shape:
{
  "mindmap": {
    "title": "Root Topic",
    "icon": "🧠",
    "desc": "One sentence overview",
    "children": [
      {
        "title": "Chapter Title",
        "icon": "📚",
        "desc": "Detailed summary",
        "children": [
          { 
            "title": "Section/Sub-point", 
            "icon": "🔑", 
            "desc": "Specific detail", 
            "children": [
               { "title": "Deep Insight", "icon": "💡", "desc": "Granular point", "children": [] }
            ] 
          }
        ]
      }
    ]
  }
}

Guidelines:
- Maintain the hierarchy from the provided structure.
- Try to extract DEEP sub-points (Level 3 or 4) where the content allows.
- Do NOT include long paragraphs—stay concise.
- Focus on technical and conceptual relationships.

Content Structure:
${prepareContext(structure, INPUT_CHAR_LIMITS.mindmap)}`;

    return await callAI(prompt, 4, 6000);
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

    // Prioritize notebook generation so it can serve as context for the mindmap
    if (selectedTypes.includes('notebook')) {
        console.log(`[AI] Generating notebook (Primary Context)...`);
        results.notebook = (await generateNotebook(text))?.notebook ?? null;
        if (selectedTypes.length > 1) await new Promise(r => setTimeout(r, 500));
    }

    for (const type of selectedTypes) {
        if (type === 'notebook') continue; // Already done
        if (generators[type]) {
            console.log(`[AI] Generating ${type}...`);
            try {
                // Pass notebook context to mindmap if it exists
                const data = (type === 'mindmap' && results.notebook) 
                    ? await generateMindmap(text, results.notebook)
                    : await generators[type](text);
                
                results[type] = data?.[type] ?? null;
            } catch (err) {
                console.error(`[AI] ❌ ${type} failed:`, err.message?.substring(0, 100));
                results[type] = null;
            }
            
            // Minimal delay — just enough to avoid burst limits (callAI handles backoff internally)
            if (selectedTypes.length > 1) {
                await new Promise(r => setTimeout(r, 500));
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
