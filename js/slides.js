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
    slideEl.className = 'slide-card active paper-texture premium-shadow';
    slideEl.style.animation = 'slideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
    
    // Add "Chalkboard" style to code snippets if they exist in the title or bullets
    const isCode = slide.title.includes('<code>') || slide.bullets.some(b => b.includes('<code>'));
    if (isCode) slideEl.classList.add('chalkboard-theme');

    slideEl.innerHTML = `
        <div class="slide-indicator" style="position:absolute; top:20px; left:30px; font-size:0.75rem; color:var(--slides-accent); border:1px solid var(--slides-accent); padding:2px 8px; border-radius:4px; font-family:'Inter'; font-weight:700;">PRESENTATION</div>
        <h2 class="slide-title" style="color: var(--slides-accent);">${slide.title}</h2>
        <ul class="slide-bullets">
            ${slide.bullets.map((b, i) => `<li style="animation: slideIn 0.3s ease both ${i * 0.1 + 0.2}s">${b}</li>`).join('')}
        </ul>
        <button class="auth-btn" onclick="pinToChat('Slide: ${slide.title}. Content: ${slide.bullets.join(', ')}')" style="position:absolute; bottom:20px; left:30px; font-size: 0.7rem; padding: 2px 8px; background: none; border: 1px dashed var(--line-color); color: var(--ink-color);">📌 Ask AI about this slide</button>
        <div class="slide-counter">${slideIndex + 1} / ${slideData.length}</div>
        <div class="slide-progress-bar"><div class="slide-progress-fill" style="width: ${((slideIndex + 1) / slideData.length) * 100}%"></div></div>
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
