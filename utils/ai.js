const { GoogleGenerativeAI } = require("@google/generative-ai");

// Use models confirmed available from your API key
const MODEL_VARIANTS = [
    "gemini-1.5-flash",
    "gemini-1.5-pro"
];

async function callAI(prompt, retries = 1) {
    if (!process.env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY === 'your_gemini_api_key') {
        console.error('[AI] No valid GOOGLE_API_KEY configured');
        return null;
    }
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

    for (let i = 0; i <= retries; i++) {
        const currentModel = MODEL_VARIANTS[i % MODEL_VARIANTS.length];
        try {
            console.log(`[AI] Attempting call with model: ${currentModel}`);
            const model = genAI.getGenerativeModel({ 
                model: currentModel,
                generationConfig: { maxOutputTokens: 2048, temperature: 0.7 } 
            });

            // Add an internal timeout to the fetch call if possible, 
            // but for now, we rely on the parallel structure in index.js
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const cleanedJson = (jsonMatch[1] || jsonMatch[0]).trim();
                return JSON.parse(cleanedJson);
            }
            throw new Error("No JSON found in AI response text.");
        } catch (error) {
            console.error(`[AI] Attempt ${i + 1} failed for ${currentModel}:`, error.message);
            if (i === retries) return null;
            await new Promise(r => setTimeout(r, 500));
        }
    }
}

async function generateNotebook(text) {
    const prompt = `You are an AI Study Architect. Transform the content into a structured study notebook.
CONTENT REQUIREMENTS:
- Create 3-5 comprehensive chapters.
- Each chapter must have exactly 5 sections: 1. Overview, 2. Deep Dive, 3. Step-by-Step, 4. Key Takeaways, 5. Quick Quiz.
OUTPUT FORMAT:
Return ONLY a valid JSON object: {"notebook": "html_content"}.
Use this HTML structure for every chapter:
<section class="notebook-page ruled">
    <h2>Chapter Number. Chapter Title</h2>
    <div class="notebook-section"><h3>1. Overview</h3><p>...</p></div>
    <div class="notebook-section"><h3>2. Deep Dive</h3><p>...</p></div>
    <div class="notebook-section"><h3>3. Step-by-Step</h3><p>...</p></div>
    <div class="notebook-section"><h3>4. Key Takeaways</h3><p>...</p></div>
    <div class="notebook-section"><h3>5. Quick Quiz</h3><p>...</p></div>
</section>

Content: ${text.substring(0, 4000)}`;
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
