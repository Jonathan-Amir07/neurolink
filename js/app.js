async function checkAuth() {
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
}

async function loadProjects() {
    const list = document.getElementById('projects-list');
    if (!list) return;

    const res = await fetch('/api/projects');
    if (!res.ok) return;

    const projects = await res.json();
    list.innerHTML = projects.length === 0 ? '<div class="card">No projects yet. Create one!</div>' : '';

    projects.forEach(project => {
        const card = document.createElement('div');
        card.className = 'card project-card';
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <h3 style="margin: 0;">${project.title}</h3>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <span style="font-size: 0.8rem; color: #777;">${new Date(project.created_at).toLocaleDateString()}</span>
                    <button class="delete-btn" title="Delete Project" style="background: none; border: none; cursor: pointer; color: #ff5252; font-size: 1.1rem; padding: 0 0.5rem;">🗑️</button>
                </div>
            </div>
            <p style="color: #666; font-size: 0.9rem; margin: 1rem 0;">${project.raw_input.substring(0, 80)}...</p>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                ${project.outputs.map(o => `<span class="badge">${o.type}</span>`).join('')}
            </div>
        `;
        card.onclick = () => window.location.href = `/project.html?id=${project._id}`;
        
        // Handle delete separately
        const deleteBtn = card.querySelector('.delete-btn');
        deleteBtn.onclick = async (e) => {
            e.stopPropagation(); // Don't trigger card click
            if (!confirm('Are you sure you want to delete this project?')) return;
            
            const res = await fetch(`/api/projects/${project._id}`, { method: 'DELETE' });
            if (res.ok) {
                loadProjects();
            } else {
                alert('Delete failed.');
            }
        };

        list.appendChild(card);
    });
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
