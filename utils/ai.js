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
 * Compresses an HTML notebook down to its structural hierarchy (Headings only).
 * This significantly reduces context token usage for the Mind Map generator.
 */
function getNotebookStructure(html) {
    if (!html) return '';
    // Extract H2 (Chapters) and H3 (Sections)
    const matches = html.match(/<(h2|h3)[^>]*>([\s\S]*?)<\/\1>/gi) || [];
    return matches.map(m => m.replace(/<[^>]+>/g, '').trim()).join('\n');
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
    const prompt = `You are an AI Study Architect, Curriculum Engineer, and Technical Educator.

Your task is to transform the provided content into a deeply structured study notebook that explains the subject thoroughly and clearly, resembling a handwritten study notebook but containing detailed, textbook-quality explanations.

━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━
Return ONLY a valid JSON object: {"notebook": "html_content"}
Use SINGLE QUOTES for all HTML attribute values to avoid breaking JSON. Do NOT use markdown—use pure HTML tags only.

━━━━━━━━━━━━━━━━━━━━━━━━
CONTENT REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━
Break the topic into 2-3 RICH CHAPTERS. Each chapter MUST explore a single concept in massive depth.
Write at university-level depth. Do NOT produce short summaries.
If a concept introduces a complex subtopic, expand it immediately as a detailed subsection.
Explain every mechanism and theory thoroughly before moving to the next.
Avoid redundant filler; focus on technical and conceptual density.

━━━━━━━━━━━━━━━━━━━━━━━━
CHAPTER STRUCTURE — Each chapter MUST contain ALL 10 sections:
━━━━━━━━━━━━━━━━━━━━━━━━
1. Introduction — What is this concept and why does it matter?
2. Core Concept Explanation — Deep conceptual explanation with <p> and <ul>/<ol> tags.
3. Technical Breakdown — How does it work internally? Use <ul> with <strong> labels.
4. Step-by-Step Mechanism — Numbered <ol> steps with detailed explanation per step.
5. Diagrams or Visual Explanation — Use an HTML <table> or structured <ul class='complexity-list'> to visualize relationships.
6. Code or Pseudocode Example — Use a <div class='chalkboard'><pre>...</pre></div> block with <span class='keyword'>, <span class='type'>, <span class='comment'> spans for syntax highlighting.
7. Real-World Applications — Concrete use-cases using <ul> with <strong> headings.
8. Common Mistakes or Edge Cases — Use <ul> with <strong>Mistake:</strong> labels.
9. Comparison with Related Concepts — Use a <table> comparing this concept vs similar ones (columns: Concept, Key Difference, Use Case).
10. Summary & Key Takeaways — Use a <ul class='complexity-list'> for key bullet points, then a <div class='quiz-box'> with 2-3 review questions.

━━━━━━━━━━━━━━━━━━━━━━━━
HTML STRUCTURE TEMPLATE (use single quotes only):
━━━━━━━━━━━━━━━━━━━━━━━━
<section class='notebook-page ruled'>
  <div class='tape-strip'></div>
  <h2>1. Chapter Title Here</h2>

  <h3>1. Introduction</h3>
  <p>Thorough introduction paragraph...</p>

  <h3>2. Core Concept Explanation</h3>
  <p>Several sentences of deep conceptual explanation...</p>
  <ul><li><strong>Key idea:</strong> explanation</li></ul>

  <h3>3. Technical Breakdown</h3>
  <ul><li><strong>Component:</strong> what it does and how</li></ul>

  <h3>4. Step-by-Step Mechanism</h3>
  <ol><li><strong>Step 1:</strong> Detailed description of what happens...</li></ol>

  <h3>5. Visual Explanation</h3>
  <table><tr><th>Term</th><th>Meaning</th><th>Example</th></tr><tr><td>...</td><td>...</td><td>...</td></tr></table>

  <h3>6. Code Example</h3>
  <div class='chalkboard'><pre><span class='comment'>// Descriptive comment</span>
<span class='keyword'>function</span> <span class='type'>example</span>(param) {
  <span class='keyword'>return</span> param;
}</pre></div>

  <h3>7. Real-World Applications</h3>
  <ul><li><strong>Use Case:</strong> explanation of how this concept is applied</li></ul>

  <h3>8. Common Mistakes & Edge Cases</h3>
  <ul><li><strong>Mistake:</strong> description and how to avoid it</li></ul>

  <h3>9. Comparison with Related Concepts</h3>
  <table><tr><th>Concept</th><th>Key Difference</th><th>Best Used When</th></tr><tr><td>...</td><td>...</td><td>...</td></tr></table>

  <h3>10. Summary & Key Takeaways</h3>
  <ul class='complexity-list'><li><strong>Takeaway 1</strong>: recap sentence</li></ul>
  <div class='quiz-box'><p><strong>Review Questions:</strong></p><ol><li>Question one?</li><li>Question two?</li></ol></div>
</section>

━━━━━━━━━━━━━━━━━━━━━━━━
QUALITY RULES:
━━━━━━━━━━━━━━━━━━━━━━━━
- Every section must have substantial content — no one-liners.
- Code blocks MUST use the chalkboard div with syntax-colored spans.
- Tables MUST have <th> headers and at least 3 data rows.
- The complexity-list class is for key concept lists (no bullet markers, left-bordered style).
- The quiz-box class is for review questions (yellow-tinted box).
- Do NOT skip any of the 10 sections in any chapter.
- Use only single quotes in HTML attributes to keep JSON valid.

Content: ${prepareContext(text, INPUT_CHAR_LIMITS.notebook)}`;
    return await callAI(prompt, 4, 16000);
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
        "desc": "Summary",
        "children": [
          { "title": "Section Title", "icon": "🔑", "desc": "Key detail", "children": [] }
        ]
      }
    ]
  }
}

Guidelines:
- Maintain the hierarchy from the provided structure.
- Do NOT include long paragraphs.
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
        if (selectedTypes.length > 1) await new Promise(r => setTimeout(r, 1500));
    }

    for (const type of selectedTypes) {
        if (type === 'notebook') continue; // Already done
        if (generators[type]) {
            console.log(`[AI] Generating ${type}...`);
            // Pass notebook context to mindmap if it exists
            const data = (type === 'mindmap' && results.notebook) 
                ? await generateMindmap(text, results.notebook)
                : await generators[type](text);
            
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
