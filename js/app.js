async function checkAuth() {
    try {
        const res = await fetch('/api/user');
        if (!res.ok) {
            if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
                window.location.href = '/';
            }
            return null;
        }
        const user = await res.json();
        if (document.getElementById('user-name')) {
            document.getElementById('user-name').innerText = `Hello, ${user.displayName}`;
        }
        return user;
    } catch (err) {
        console.warn('[Auth] Check failed:', err.message);
        return null;
    }
}

const TYPE_ICONS = {
    notebook: '📓',
    mindmap: '🗺️',
    flashcards: '🃏',
    slides: '📊',
    infographic: '🖼️'
};

async function loadProjects() {
    const list = document.getElementById('projects-list');
    if (!list) return;

    // Show skeleton loading
    list.innerHTML = `
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
    `;

    try {
        const res = await fetch('/api/projects');
        if (!res.ok) {
            list.innerHTML = '<div class="card">Failed to load projects. Please refresh.</div>';
            return;
        }

        const projects = await res.json();
        
        if (projects.length === 0) {
            list.innerHTML = `
                <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">📚</div>
                    <h3>No projects yet</h3>
                    <p style="color: #666; margin: 0.5rem 0 1.5rem;">Create your first project to generate AI study materials.</p>
                    <button class="new-project-btn" onclick="showModal()">+ Create First Project</button>
                </div>
            `;
            return;
        }

        list.innerHTML = '';
        projects.forEach((project, index) => {
            const card = document.createElement('div');
            card.className = 'card project-card';
            card.style.animation = `fadeSlideUp 0.4s ease ${index * 0.05}s both`;
            
            const rawPreview = (project.raw_input || '').substring(0, 80);
            const outputBadges = (project.outputs || []).map(o => 
                `<span class="badge">${TYPE_ICONS[o.type] || '📄'} ${o.type}</span>`
            ).join('');

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <h3 style="margin: 0; font-size: 1.1rem;">${project.title}</h3>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <span style="font-size: 0.8rem; color: #777;">${new Date(project.created_at).toLocaleDateString()}</span>
                        <button class="delete-btn" title="Delete Project" style="background: none; border: none; cursor: pointer; color: #ff5252; font-size: 1.1rem; padding: 0 0.5rem;">🗑️</button>
                    </div>
                </div>
                <p style="color: #666; font-size: 0.9rem; margin: 0.8rem 0;">${rawPreview}${rawPreview.length >= 80 ? '...' : ''}</p>
                <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                    ${outputBadges || '<span class="badge" style="opacity:0.5;">No outputs yet</span>'}
                </div>
            `;
            card.onclick = () => window.location.href = `/project.html?id=${project._id}`;
            
            const deleteBtn = card.querySelector('.delete-btn');
            deleteBtn.onclick = async (e) => {
                e.stopPropagation();
                if (!confirm('Are you sure you want to delete this project?')) return;
                
                const res = await fetch(`/api/projects/${project._id}`, { method: 'DELETE' });
                if (res.ok) {
                    card.style.animation = 'fadeOut 0.3s ease forwards';
                    setTimeout(() => loadProjects(), 300);
                } else {
                    alert('Delete failed.');
                }
            };

            list.appendChild(card);
        });
    } catch (err) {
        list.innerHTML = '<div class="card">Connection error. Is the server running?</div>';
    }
}

// Global initialization
document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    
    const path = window.location.pathname;
    
    // Redirect logged-in users from Landing Page to Dashboard
    if (user && (path === '/' || path === '/index.html' || path === '/index')) {
        window.location.href = '/dashboard';
        return;
    }

    // Load projects if on dashboard (handle clean URLs)
    if (path.includes('dashboard')) {
        loadProjects();
    }
});
