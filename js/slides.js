let slideIndex = 0;
let slideData = [];

function initSlides(data) {
    if (!data || !Array.isArray(data) || data.length === 0) {
        document.getElementById('slides-container').innerHTML = '<div class="empty-state-card"><h3>No slides available</h3><p>Click "Regenerate Tab" to generate slides for this project.</p></div>';
        return;
    }
    slideData = data;
    slideIndex = 0;
    renderCurrentSlide();
}

function renderCurrentSlide() {
    const container = document.getElementById('slides-container');
    if (!container) return;
    
    container.innerHTML = '';
    const slide = slideData[slideIndex];
    if (!slide) return;

    const slideEl = document.createElement('div');
    slideEl.className = 'slide-card active';
    slideEl.style.animation = 'slideIn 0.4s ease';
    slideEl.innerHTML = `
        <h2 class="slide-title">${slide.title}</h2>
        <ul class="slide-bullets">
            ${slide.bullets.map(b => `<li>${b}</li>`).join('')}
        </ul>
        <div class="slide-counter">${slideIndex + 1} / ${slideData.length}</div>
        <div class="slide-progress-bar"><div class="slide-progress-fill" style="width: ${((slideIndex + 1) / slideData.length) * 100}%"></div></div>
    `;
    container.appendChild(slideEl);
}

function nextSlide() {
    if (slideIndex < slideData.length - 1) {
        slideIndex++;
        renderCurrentSlide();
    }
}

function prevSlide() {
    if (slideIndex > 0) {
        slideIndex--;
        renderCurrentSlide();
    }
}

// Keyboard navigation for slides
document.addEventListener('keydown', (e) => {
    // Only handle if slides tab is active
    const slidesView = document.getElementById('slides-view');
    if (!slidesView || slidesView.classList.contains('hidden')) return;
    
    if (e.code === 'ArrowRight' || e.code === 'ArrowDown') {
        nextSlide();
    } else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
        prevSlide();
    }
});
