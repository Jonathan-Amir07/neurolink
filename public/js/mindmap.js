function initMindMap(data) {
    const root = document.getElementById('tree-root');
    root.innerHTML = '';
    root.appendChild(renderMindmapNode(data, true));
}

function renderMindmapNode(nodeData, isRoot = false) {
    const branch = document.createElement('div');
    branch.className = 'tree-branch';

    const nodeItem = document.createElement('div');
    nodeItem.className = 'node-item';

    if (!isRoot) {
        const childConn = document.createElement('div');
        childConn.className = 'child-connector';
        nodeItem.appendChild(childConn);
    }

    const card = document.createElement('div');
    card.className = `node-card ${isRoot ? 'root' : (nodeData.children ? 'category' : 'leaf')}`;
    card.innerHTML = `
        <div class="node-header">
            <span>${nodeData.icon || '🧠'}</span>
            <span>${nodeData.title || nodeData.name || nodeData.topic || nodeData.label || 'Node'}</span>
        </div>
        <div class="node-desc">${nodeData.desc || ''}</div>
    `;

    nodeItem.appendChild(card);

    if (nodeData.children && nodeData.children.length > 0) {
        const indicator = document.createElement('div');
        indicator.className = 'toggle-indicator';
        indicator.innerText = '+';
        card.appendChild(indicator);

        const parentConn = document.createElement('div');
        parentConn.className = 'parent-connector hidden';
        nodeItem.appendChild(parentConn);

        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'children-container hidden';

        nodeData.children.forEach(child => {
            childrenContainer.appendChild(renderMindmapNode(child));
        });

        branch.appendChild(nodeItem);
        branch.appendChild(childrenContainer);

        card.onclick = (e) => {
            e.stopPropagation();
            const isNowHidden = childrenContainer.classList.toggle('hidden');
            parentConn.classList.toggle('hidden');
            indicator.innerText = isNowHidden ? '+' : '−';
            updateBackbone(childrenContainer);
        };
    } else {
        branch.appendChild(nodeItem);
    }

    return branch;
}

function updateBackbone(container) {
    if (container.classList.contains('hidden')) return;
    const branches = Array.from(container.children).filter(c => c.classList.contains('tree-branch'));
    if (branches.length > 0) {
        const first = branches[0].querySelector('.node-item');
        const last = branches[branches.length - 1].querySelector('.node-item');
        if (first && last) {
            const top = first.offsetTop + (first.offsetHeight / 2);
            const bottom = container.offsetHeight - (last.offsetTop + (last.offsetHeight / 2));
            container.style.setProperty('--backbone-top', `${top}px`);
            container.style.setProperty('--backbone-bottom', `${bottom}px`);
        }
    }
}
