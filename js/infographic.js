function initInfographic(data) {
    const container = document.getElementById('infographic-container');
    if (!container) return;
    
    container.innerHTML = '';

    if (!data || !Array.isArray(data) || data.length === 0) {
        container.innerHTML = '<div class="empty-state-card"><h3>No infographic available</h3><p>Click "Regenerate Tab" to generate an infographic.</p></div>';
        return;
    }
    
    data.forEach((section, index) => {
        const card = document.createElement('div');
        card.className = `paper-card ${index % 2 === 0 ? 'rot-left' : 'rot-right'}`;
        card.style.animationDelay = `${index * 0.1}s`;
        card.style.animation = `fadeSlideUp 0.5s ease ${index * 0.1}s both`;
        card.innerHTML = `
            <div class="tape"></div>
            <h2 class="section-title">
                <span style="font-size: 1.5rem; margin-right: 10px;">${section.icon || '📌'}</span>
                ${section.title || 'Section'}
            </h2>
            <div class="infographic-content">
                ${section.content || ''}
            </div>
        `;
        container.appendChild(card);
    });
}
