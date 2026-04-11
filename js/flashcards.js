let flashcards = [];
let currentIndex = 0;
let isFlipped = false;

function initFlashcards(cardsData) {
    if (!cardsData || !Array.isArray(cardsData) || cardsData.length === 0) {
        const container = document.getElementById('flashcard-container');
        if (container) container.innerHTML = '<div class="empty-state-card"><h3>No flashcards available</h3><p>Click "Regenerate Tab" to generate flashcards.</p></div>';
        return;
    }
    flashcards = cardsData;
    currentIndex = 0;
    isFlipped = false;
    renderFlashcard();
}

function renderFlashcard() {
    const container = document.getElementById('flashcard-container');
    if (!container || !flashcards[currentIndex]) return;
    
    const card = flashcards[currentIndex];
    isFlipped = false;
    
    container.innerHTML = `
        <div class="flashcard-counter">${currentIndex + 1} of ${flashcards.length}</div>
        <div class="flashcard-progress-bar"><div class="flashcard-progress-fill" style="width: ${((currentIndex + 1) / flashcards.length) * 100}%"></div></div>
        <div class="card-perspective" onclick="flipCard()">
             <div id="card-inner" class="card-inner paper-texture premium-shadow">
                <div class="card-face card-front hand-drawn-border">
                    <div class="card-card-indicator" style="position:absolute; top:15px; left:15px; font-size:0.8rem; opacity:0.6; font-family:'Inter'; text-transform:uppercase; letter-spacing:1px;">Question</div>
                    <div style="font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--flashcard-accent); font-family: 'Permanent Marker'; line-height:1.2;">${card.title || 'Concept'}</div>
                    <div style="font-size: 1.4rem; font-family: 'Patrick Hand'; text-align:center;">${card.question}</div>
                    <div style="position:absolute; bottom:20px; font-size:0.8rem; opacity:0.4;">Click or Space to Flip</div>
                </div>
                <div class="card-face card-back hand-drawn-border">
                    <div class="card-card-indicator" style="position:absolute; top:15px; left:15px; font-size:0.8rem; opacity:0.6; font-family:'Inter'; text-transform:uppercase; letter-spacing:1px;">Answer</div>
                    <div style="font-size: 1.3rem; margin-top: 1rem; font-family: 'Patrick Hand'; text-align:center; max-height: 180px; overflow-y: auto;">${card.answer}</div>
                    
                    <button class="auth-btn" onclick="event.stopPropagation(); pinToChat('Concept: ${card.title}. Question: ${card.question}. Answer: ${card.answer}')" style="margin-top: 10px; font-size: 0.7rem; padding: 2px 8px; background: none; border: 1px dashed var(--line-color); color: var(--ink-color);">📌 Ask AI about this</button>

                    <div class="confidence-container" onclick="event.stopPropagation()">
                        <button class="conf-btn conf-red" onclick="handleConfidence('again')">Again</button>
                        <button class="conf-btn conf-orange" onclick="handleConfidence('hard')">Hard</button>
                        <button class="conf-btn conf-green" onclick="handleConfidence('good')">Good</button>
                        <button class="conf-btn conf-blue" onclick="handleConfidence('easy')">Easy</button>
                    </div>
                </div>
             </div>
        </div>
    `;
}

function handleConfidence(level) {
    console.log(`Confidence level selected: ${level}`);
    nextCard();
}

function flipCard() {
    const inner = document.getElementById('card-inner');
    if (!inner) return;
    isFlipped = !isFlipped;
    inner.classList.toggle('flipped');
}

function nextCard() {
    if (currentIndex < flashcards.length - 1) {
        currentIndex++;
        renderFlashcard();
    }
}

function prevCard() {
    if (currentIndex > 0) {
        currentIndex--;
        renderFlashcard();
    }
}

// Global Hotkeys
document.addEventListener('keydown', (e) => {
    // Only handle if flashcards tab is active
    const fcView = document.getElementById('flashcards-view');
    if (!fcView || fcView.classList.contains('hidden')) return;

    if (e.code === 'Space') {
        e.preventDefault();
        flipCard();
    } else if (e.code === 'ArrowRight') {
        nextCard();
    } else if (e.code === 'ArrowLeft') {
        prevCard();
    }
});
