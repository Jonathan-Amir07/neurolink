let slideIndex = 0;
let slideData = [];

function initSlides(data) {
    if (!data || !Array.isArray(data)) {
        document.getElementById('slides-container').innerHTML = `
            <div class="empty-state-card">
                <h3>Slides not ready</h3>
                <p>Click "Regenerate" to create a presentation for this topic.</p>
            </div>
        `;
        return;
    }
    slideData = data;
    slideIndex = 0;
    renderCurrentSlide();
}

function renderCurrentSlide() {
    const container = document.getElementById('slides-container');
    if (!container || !slideData[slideIndex]) return;
    
    container.innerHTML = '';
    const slide = slideData[slideIndex];

    const slideEl = document.createElement('div');
    slideEl.className = 'slide-card active paper-texture premium-shadow';
    slideEl.style.borderLeft = `10px solid var(--slides-accent)`;
    
    slideEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 2rem;">
            <h2 class="slide-title" style="color: var(--slides-accent); margin:0;">${slide.title || 'Untitled Slide'}</h2>
            <div style="font-size:0.8rem; font-weight:800; color:var(--slides-accent); opacity:0.6;">NEUROLINK PRESENTATION</div>
        </div>
        <ul class="slide-bullets">
            ${(slide.bullets || []).map((b, i) => `<li style="animation: fadeSlideUp 0.4s ease both ${i * 0.1 + 0.2}s">${b}</li>`).join('')}
        </ul>
        <div class="slide-counter">${slideIndex + 1} / ${slideData.length}</div>
        <div class="slide-progress-bar">
            <div class="slide-progress-fill" style="width: ${((slideIndex + 1) / slideData.length) * 100}%; background: var(--slides-accent);"></div>
        </div>
    `;
    container.appendChild(slideEl);
}

function toggleFullscreen() {
    const container = document.getElementById('slides-container');
    if (!container) return;
    
    if (!document.fullscreenElement) {
        container.requestFullscreen().catch(err => {
            alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
        container.classList.add('fullscreen-mode');
    } else {
        document.exitFullscreen();
        container.classList.remove('fullscreen-mode');
    }
}

document.addEventListener('fullscreenchange', () => {
    const container = document.getElementById('slides-container');
    if (!document.fullscreenElement) {
        container.classList.remove('fullscreen-mode');
    }
});

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
    
    if (e.code === 'ArrowRight' || e.code === 'ArrowDown' || e.code === 'Space') {
        nextSlide();
    } else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
        prevSlide();
    } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
    }
});
