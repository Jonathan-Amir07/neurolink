async function checkAuth() {
    try {
        const res = await fetch('/api/user');
        if (!res.ok) {
            const path = window.location.pathname;
            const isPublicPage = path === '/' || path === '/index.html' || path === '/login';
            if (!isPublicPage) {
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
    infographic: '🖼️',
    quiz: '🎯'
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
        window.allProjects = projects;
        renderProjects(projects);
    } catch (err) {
        list.innerHTML = '<div class="card">Connection error. Is the server running?</div>';
    }
}

window.allProjects = [];

window.filterProjects = function() {
    const query = (document.getElementById('search-input')?.value || '').toLowerCase();
    if (!query) {
        renderProjects(window.allProjects);
        return;
    }
    const filtered = window.allProjects.filter(p => {
        const titleMatch = (p.title || '').toLowerCase().includes(query);
        const tagMatch = (p.tags || []).some(t => t.toLowerCase().includes(query));
        return titleMatch || tagMatch;
    });
    renderProjects(filtered);
};

function renderProjects(projects) {
    const list = document.getElementById('projects-list');
    if (!list) return;

    if (projects.length === 0 && window.allProjects.length === 0) {
        list.innerHTML = `
            <div class="empty-state-card" style="grid-column: 1 / -1; padding: 4rem 2rem;">
                <div style="font-size: 5rem; margin-bottom: 2rem; filter: drop-shadow(0 15px 25px rgba(160,82,45,0.2));">🏮</div>
                <h3 style="font-family: 'Permanent Marker', cursive; font-size: 2.5rem; margin-bottom: 1rem; color: var(--accent-color);">Your Academic Journey Starts Here</h3>
                <p style="color: #666; margin: 0 auto 3rem; max-width: 500px; font-size:1.1rem; line-height:1.6; opacity:0.8;">Welcome to NeuroLink. Let's transform your study experience in three simple steps:</p>
                
                <div class="onboarding-steps" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:2rem; margin-bottom: 3.5rem; width:100%; max-width:900px; margin-left:auto; margin-right:auto; text-align:left;">
                    <div style="background:var(--paper-bg); padding:1.5rem; border-radius:16px; border:1px solid var(--dot-color); box-shadow: 4px 4px 0 var(--dot-color);">
                        <div style="font-size:1.5rem; margin-bottom:0.5rem;">🏗️</div>
                        <h4 style="font-weight:800; margin-bottom:0.5rem;">1. Create</h4>
                        <p style="font-size:0.85rem; color:#666;">Click the plus button and give your unit a name and tags.</p>
                    </div>
                    <div style="background:var(--paper-bg); padding:1.5rem; border-radius:16px; border:1px solid var(--dot-color); box-shadow: 4px 4px 0 var(--dot-color);">
                        <div style="font-size:1.5rem; margin-bottom:0.5rem;">📎</div>
                        <h4 style="font-weight:800; margin-bottom:0.5rem;">2. Supply</h4>
                        <p style="font-size:0.85rem; color:#666;">Paste your notes or upload PDFs. The more detail, the better the AI outputs.</p>
                    </div>
                    <div style="background:var(--paper-bg); padding:1.5rem; border-radius:16px; border:1px solid var(--dot-color); box-shadow: 4px 4px 0 var(--dot-color);">
                        <div style="font-size:1.5rem; margin-bottom:0.5rem;">✨</div>
                        <h4 style="font-weight:800; margin-bottom:0.5rem;">3. Learn</h4>
                        <p style="font-size:0.85rem; color:#666;">Explore Mind Maps, Flashcards, and more. Use the AI Mate to quiz yourself.</p>
                    </div>
                </div>

                <div style="display:flex; justify-content:center; gap:1rem;">
                    <button class="new-project-btn" onclick="showModal()" style="padding: 1rem 3rem; font-size:1.1rem; box-shadow: 0 10px 25px rgba(var(--accent-color-rgb), 0.3);">🚀 Create First Project</button>
                </div>
            </div>
        `;
        return;
    }

    if (projects.length === 0) {
        list.innerHTML = `<div class="card" style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #777;">No matching projects found.</div>`;
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
        
        const tagBadges = (project.tags || []).map(t => 
            `<span class="badge" style="background: rgba(0,0,0,0.04); color: #555; border: 1px solid #ddd; font-weight: 600;">#${t}</span>`
        ).join('');

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <h3 style="margin: 0; font-size: 1.1rem;">${project.title}</h3>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <span style="font-size: 0.8rem; color: #777;">${new Date(project.created_at).toLocaleDateString()}</span>
                    <button class="edit-btn" title="Edit Metadata" style="background: none; border: none; cursor: pointer; color: var(--accent-color); font-size: 1.1rem; padding: 0 0.2rem;">✏️</button>
                    <button class="delete-btn" title="Delete Project" style="background: none; border: none; cursor: pointer; color: #ff5252; font-size: 1.1rem; padding: 0 0.5rem;">🗑️</button>
                </div>
            </div>
            <p style="color: #666; font-size: 0.9rem; margin: 0.8rem 0;">${rawPreview}${rawPreview.length >= 80 ? '...' : ''}</p>
            <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                ${tagBadges}
                ${outputBadges || (tagBadges ? '' : '<span class="badge" style="opacity:0.5;">No outputs yet</span>')}
            </div>
        `;
        card.onclick = () => {
            document.querySelectorAll('.project-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            setTimeout(() => {
                window.location.href = `/project.html?id=${project._id}`;
            }, 400);
        };
        
        const editBtn = card.querySelector('.edit-btn');
        editBtn.onclick = (e) => {
            e.stopPropagation();
            openEditModal(project._id);
        };
        
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
    
    initMicroAnimations();
}

function initMicroAnimations() {
    document.querySelectorAll('.project-card').forEach(card => {
        card.onmousemove = (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = (y - centerY) / 10;
            const rotateY = (centerX - x) / 10;
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-5px)`;
        };
        card.onmouseleave = () => {
            card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)`;
        };
    });
}

// ── THEME MANAGEMENT ───────────────────────────────────────────────────
const THEMES = {
    parchment: { name: 'Parchment', icon: '📜' },
    dark: { name: 'Dark Library', icon: '🌙' },
    modern: { name: 'Modern Lab', icon: '🧪' }
};

function initTheme() {
    try {
        const savedTheme = localStorage.getItem('neurolink-theme') || 'default';
        setTheme(savedTheme);
        renderThemeSwitcher();
    } catch (e) {
        console.error('Theme Init Failed:', e);
    }
}

function setTheme(theme) {
    if (theme === 'default') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', theme);
    }
    localStorage.setItem('neurolink-theme', theme);
    updateThemeSwitcherUI(theme);
}

function renderThemeSwitcher() {
    // Avoid double switchers if the luxury capsule is present
    if (document.querySelector('.theme-selector-pill')) return;

    const nav = document.getElementById('nav-links');
    if (!nav) return;
    if (document.getElementById('theme-switcher-row')) return;

    const row = document.createElement('div');
    row.id = 'theme-switcher-row';
    row.className = 'theme-switcher-row';
    // ... rest of logic

    Object.entries(THEMES).forEach(([id, info]) => {
        const btn = document.createElement('button');
        btn.className = 'theme-switcher-btn';
        btn.dataset.themeId = id;
        btn.innerHTML = `<span class="btn-icon">${info.icon}</span> ${info.name}`;
        
        btn.onclick = (e) => {
            e.stopPropagation();
            setTheme(id);
        };
        row.appendChild(btn);
    });

    nav.prepend(row);
    updateThemeSwitcherUI(localStorage.getItem('neurolink-theme') || 'parchment');
}

function updateThemeSwitcherUI(activeTheme) {
    // Standard switchers
    const btns = document.querySelectorAll('.theme-switcher-btn');
    btns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.themeId === activeTheme);
    });

    // Luxury Capsule switchers (Dashboard/Project Studio)
    document.querySelectorAll('.theme-pill-btn').forEach(btn => {
        btn.classList.remove('active-parchment', 'active-library', 'active-lab', 'active-default');
    });
    const themeMap = { 'parchment': 'parchment-btn', 'library': 'library-btn', 'lab': 'lab-btn', 'default': 'studio-btn' };
    const targetClass = themeMap[activeTheme] || 'studio-btn';
    const activeBtn = document.querySelector(`.${targetClass}`);
    if (activeBtn) activeBtn.classList.add(`active-${activeTheme}`);
}

// ── PROJECT EDITING ────────────────────────────────────────────────────
window.openEditModal = function(id) {
    const project = window.allProjects.find(p => p._id === id);
    if (!project) return;
    
    document.getElementById('edit-project-id').value = id;
    document.getElementById('edit-title').value = project.title;
    document.getElementById('edit-tags').value = (project.tags || []).join(', ');
    
    document.getElementById('edit-project-modal').style.display = 'flex';
};

window.hideEditModal = function() {
    document.getElementById('edit-project-modal').style.display = 'none';
};

document.addEventListener('DOMContentLoaded', () => {
    const editForm = document.getElementById('edit-project-form');
    if (editForm) {
        editForm.onsubmit = async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-project-id').value;
            const title = document.getElementById('edit-title').value;
            const tags = document.getElementById('edit-tags').value;
            const btn = document.getElementById('edit-submit-btn');
            
            const originalText = btn.innerText;
            btn.innerText = 'Saving...';
            btn.disabled = true;

            try {
                const res = await fetch(`/api/projects/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, tags })
                });

                if (res.ok) {
                    hideEditModal();
                    loadProjects(); // Refresh list
                } else {
                    alert('Failed to update project.');
                }
            } catch (err) {
                alert('Connection error.');
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        };
    }
});

// Global initialization
document.addEventListener('DOMContentLoaded', async () => {
    initTheme(); // Initialize theme ASAP
    
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
