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
                <span style="font-size: 0.8rem; color: #777;">${new Date(project.created_at).toLocaleDateString()}</span>
            </div>
            <p style="color: #666; font-size: 0.9rem; margin: 1rem 0;">${project.raw_input.substring(0, 80)}...</p>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                ${project.outputs.map(o => `<span class="badge">${o.type}</span>`).join('')}
            </div>
        `;
        card.onclick = () => window.location.href = `/project.html?id=${project._id}`;
        list.appendChild(card);
    });
}

// Global initialization
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    if (window.location.pathname.includes('dashboard.html')) {
        loadProjects();
    }
});
