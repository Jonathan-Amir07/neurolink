let slideIndex = 0;
let slideData = [];

function initSlides(data) {
    if (!data || !Array.isArray(data) || data.length === 0) {
        document.getElementById('slides-container').innerHTML = '<div class="error-msg">Nenhum slide disponível para este projeto.</div>';
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
    slideEl.innerHTML = `
        <h2 class="slide-title">${slide.title}</h2>
        <ul class="slide-bullets">
            ${slide.bullets.map(b => `<li>${b}</li>`).join('')}
        </ul>
        <div class="slide-counter">${slideIndex + 1} / ${slideData.length}</div>
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
