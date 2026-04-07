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
             <div id="card-inner" class="card-inner">
                <div class="card-face card-front">
                    <div style="font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--accent-color); font-family: 'Permanent Marker';">${card.title || 'Question'}</div>
                    <div style="font-size: 1.2rem; font-family: 'Patrick Hand';">${card.question}</div>
                </div>
                <div class="card-face card-back">
                    <div style="font-weight: 800; border-bottom: 2px solid var(--accent-color);">Answer</div>
                    <div style="font-size: 1.2rem; margin-top: 1rem; font-family: 'Patrick Hand';">${card.answer}</div>
                </div>
             </div>
        </div>
    `;
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
