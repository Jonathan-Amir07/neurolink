function initInfographic(data) {
    const container = document.getElementById('infographic-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    data.forEach((section, index) => {
        const card = document.createElement('div');
        card.className = `paper-card ${index % 2 === 0 ? 'rot-left' : 'rot-right'}`;
        card.innerHTML = `
            <div class="tape"></div>
            <h2 class="section-title">
                <span style="font-size: 1.5rem; margin-right: 10px;">${section.icon || '📌'}</span>
                ${section.title}
            </h2>
            <div class="infographic-content">
                ${section.content}
            </div>
        `;
        container.appendChild(card);
    });
}
