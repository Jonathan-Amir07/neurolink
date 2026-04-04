let flashcards = [];
let currentIndex = 0;
let isFlipped = false;

function initFlashcards(cardsData) {
    flashcards = cardsData;
    currentIndex = 0;
    renderFlashcard();
}

function renderFlashcard() {
    const container = document.getElementById('flashcard-container');
    if (!flashcards[currentIndex]) return;
    
    const card = flashcards[currentIndex];
    container.innerHTML = `
        <div class="card-perspective" onclick="flipCard()">
             <div id="card-inner" class="card-inner ${isFlipped ? 'flipped' : ''}">
                <div class="card-face card-front">
                    <div style="font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--accent-color); font-family: 'Permanent Marker';">${card.title}</div>
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
    isFlipped = !isFlipped;
    inner.classList.toggle('flipped');
}

function nextCard() {
    if (currentIndex < flashcards.length - 1) {
        currentIndex++;
        isFlipped = false;
        renderFlashcard();
    }
}

function prevCard() {
    if (currentIndex > 0) {
        currentIndex--;
        isFlipped = false;
        renderFlashcard();
    }
}

// Global Hotkeys
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        flipCard();
    } else if (e.code === 'ArrowRight') {
        nextCard();
    } else if (e.code === 'ArrowLeft') {
        prevCard();
    }
});
