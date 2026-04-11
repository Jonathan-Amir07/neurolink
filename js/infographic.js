function initInfographic(data) {
    const container = document.getElementById('infographic-container');
    if (!container) return;
    
    container.innerHTML = '';

    if (!data || !data.title) {
        container.innerHTML = '<div class="empty-state-card"><h3>No infographic available</h3><p>Click "Regenerate Tab" to generate an infographic.</p></div>';
        return;
    }

    // 1. Title Section
    const titleSection = document.createElement('div');
    titleSection.className = 'infographic-header paper-card rot-left';
    titleSection.innerHTML = `
        <div class="tape"></div>
        <h1 class="infographic-main-title">${data.title.main || 'Project Infographic'}</h1>
        <p class="infographic-tagline">${data.title.tagline || ''}</p>
    `;
    container.appendChild(titleSection);

    // 2. Core Concepts Overview
    if (data.core_concepts && data.core_concepts.length > 0) {
        const overviewSection = document.createElement('div');
        overviewSection.className = 'infographic-overview-grid';
        data.core_concepts.forEach(concept => {
            const item = document.createElement('div');
            item.className = 'concept-pill';
            item.innerHTML = `<span>${concept.icon}</span> <strong>${concept.title}:</strong> ${concept.summary}`;
            overviewSection.appendChild(item);
        });
        container.appendChild(overviewSection);
    }

    // 3. Section Blocks (Detailed Content)
    if (data.detailed_blocks) {
        data.detailed_blocks.forEach((block, index) => {
            const card = document.createElement('div');
            card.className = `paper-card ${index % 2 === 0 ? 'rot-right' : 'rot-left'}`;
            card.style.animation = `fadeSlideUp 0.5s ease ${index * 0.1}s both`;
            card.innerHTML = `
                <div class="tape"></div>
                <h2 class="section-title">
                    <span style="font-size: 1.5rem; margin-right: 10px;">${block.icon || '📌'}</span>
                    ${block.title}
                </h2>
                <ul class="infographic-list">
                    ${block.points.map(p => `<li>${p}</li>`).join('')}
                </ul>
            `;
            container.appendChild(card);
        });
    }

    // 4. Relationships / Flow Section
    if (data.relationships && data.relationships.summary) {
        const relCard = document.createElement('div');
        relCard.className = 'paper-card relation-card';
        relCard.innerHTML = `
            <div class="tape" style="background: rgba(var(--accent-color-rgb), 0.2);"></div>
            <h2 class="section-title">🔄 Concept Flow & Relationships</h2>
            <p style="margin-bottom: 1rem; font-style: italic; opacity: 0.8;">${data.relationships.summary}</p>
            <div class="relation-grid">
                ${data.relationships.connections.map(conn => `
                    <div class="relation-item">${conn}</div>
                `).join('')}
            </div>
        `;
        container.appendChild(relCard);
    }

    // 5. Key Takeaways Section
    if (data.takeaways) {
        const takeawayCard = document.createElement('div');
        takeawayCard.className = 'paper-card takeaway-card rot-right';
        takeawayCard.innerHTML = `
            <div class="tape" style="width: 150px; background: rgba(255, 235, 59, 0.4);"></div>
            <h2 class="section-title">💡 Key Takeaways</h2>
            <div class="takeaway-grid">
                ${data.takeaways.map(t => `<div class="takeaway-item">✨ ${t}</div>`).join('')}
            </div>
        `;
        container.appendChild(takeawayCard);
    }
}
