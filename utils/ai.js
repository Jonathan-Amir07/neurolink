const { GoogleGenerativeAI } = require("@google/generative-ai");

// Use models confirmed available from your API key
const MODEL_VARIANTS = [
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-1.5-flash-8b"
];

async function callAI(prompt, retries = 2) {
    if (!process.env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY === 'your_gemini_api_key') {
        console.error('[AI] No valid GOOGLE_API_KEY configured');
        return null;
    }
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

    for (let i = 0; i <= retries; i++) {
        const currentModel = MODEL_VARIANTS[i % MODEL_VARIANTS.length];
        try {
            console.log(`[AI] Attempting call with model: ${currentModel}`);
            const model = genAI.getGenerativeModel({ model: currentModel });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Robustly extract JSON — strip markdown fences
            const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const cleanedJson = (jsonMatch[1] || jsonMatch[0]).trim();
                return JSON.parse(cleanedJson);
            }
            throw new Error("No JSON found in AI response text.");
        } catch (error) {
            console.error(`[AI] Attempt ${i + 1} failed for ${currentModel}:`, error.message);
            if (i === retries) return null;
            // Wait briefly before retrying
            await new Promise(r => setTimeout(r, 500));
        }
    }
}

async function generateNotebook(text) {
    const prompt = `You are an AI Study Architect, Curriculum Engineer, and Technical Educator.
Your task is to transform any topic into a deeply structured study notebook that explains the subject thoroughly and clearly.

CONTENT GENERATION REQUIREMENTS:
- Explain the topic in depth. Do NOT produce short summaries.
- Create comprehensive explanations similar to a university-level textbook.
- Focus on: conceptual clarity, step-by-step explanations, detailed breakdowns, logical progression of ideas, and practical understanding.
- Break the topic into logical chapters. Each chapter must cover ONE core concept.

CHAPTER STRUCTURE REQUIREMENT:
Each chapter must contain these 10 specific sections:
1. Introduction, 2. Core Concept Explanation, 3. Technical Breakdown, 4. Step-by-Step Mechanism, 5. Diagrams/Visuals (Markdown Tables), 6. Code/Pseudocode, 7. Real-World Applications, 8. Common Mistakes, 9. Comparison, 10. Summary.

OUTPUT FORMAT:
Return ONLY a valid JSON object: {"notebook": "html_content"}.
The html_content must use the following EXACT structure for EVERY chapter:

<section class="notebook-page ruled">
    <div class="tape-strip"></div>
    <h2>Chapter Number. Chapter Title</h2>
    
    <!-- Each of the 10 sections should be a <div> with an <h3> -->
    <div class="notebook-section">
        <h3>1. Introduction</h3>
        <p>Content...</p>
    </div>
    
    <!-- Code blocks should use this structure -->
    <div class="chalkboard">
        <pre><code>...code...</code></pre>
    </div>
    
    <!-- Complexity or key-point lists should use this -->
    <ul class="complexity-list">
        <li><strong>Term:</strong> Description</li>
    </ul>
</section>

Content to transform: ${text}`;
    return await callAI(prompt);
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
