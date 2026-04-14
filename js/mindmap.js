let zoomScale = 1;
let translateX = 0;
let translateY = 0;
let isDragging = false;
let startX, startY;
let mindmapData = null;

function initMindMap(data) {
    const container = document.getElementById('mindmap-view');
    if (!container) return;
    
    // Create new structure for pan/zoom
    container.innerHTML = `
        <div id="mindmap-viewport" class="tree-viewport" style="width: 100%; height: 100%; overflow: hidden; cursor: grab; position: relative; padding: 0;">
            <div id="mindmap-content" style="transform-origin: 0 0; transition: transform 0.1s ease-out; position: absolute; left: 0; top: 0; padding: 80px;">
                <div id="tree-root" class="tree-container"></div>
            </div>
        </div>
        <div class="mindmap-controls" style="position: absolute; bottom: 20px; left: 20px; display: flex; gap: 10px; z-index: 1000;">
            <button class="auth-btn" onclick="adjustZoom(1.2)" style="padding: 5px 15px;">+</button>
            <button class="auth-btn" onclick="adjustZoom(0.8)" style="padding: 5px 15px;">-</button>
            <button class="auth-btn" onclick="resetView()" style="padding: 5px 15px;">Reset View</button>
        </div>
    `;
    
    initPanZoom(document.getElementById('mindmap-viewport'));
    mindmapData = data;
    
    if (!data || !data.title) {
        container.innerHTML += '<div class="empty-state-card"><h3>No mind map available</h3><p>Click "Regenerate Tab" to generate a mind map.</p></div>';
        return;
    }

    // Initial Layout via recursive DOM
    const treeRootContainer = document.getElementById('tree-root');
    treeRootContainer.appendChild(renderNode(mindmapData, true));

    requestAnimationFrame(() => {
        resetView();
    });
}

function initPanZoom(viewport) {
    viewport.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Left click only
        isDragging = true;
        viewport.style.cursor = 'grabbing';
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        updateTransform();
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        viewport.style.cursor = 'grab';
    });

    viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        adjustZoom(delta, e.clientX, e.clientY);
    }, { passive: false });
}

function adjustZoom(delta, centerX, centerY) {
    const viewport = document.getElementById('mindmap-viewport');
    if (!viewport) return;

    if (!centerX) {
        centerX = viewport.clientWidth / 2;
        centerY = viewport.clientHeight / 2;
    }

    const nextScale = Math.min(Math.max(zoomScale * delta, 0.1), 3);
    
    // Zoom relative to center point
    const rect = viewport.getBoundingClientRect();
    const cx = centerX - rect.left;
    const cy = centerY - rect.top;
    
    translateX = cx - (cx - translateX) * (nextScale / zoomScale);
    translateY = cy - (cy - translateY) * (nextScale / zoomScale);
    
    zoomScale = nextScale;
    updateTransform();
}

function resetView() {
    zoomScale = 0.8;
    translateX = 50;
    translateY = 50;
    updateTransform();
}

function updateTransform() {
    const content = document.getElementById('mindmap-content');
    if (content) {
        content.style.transform = `translate(${translateX}px, ${translateY}px) scale(${zoomScale})`;
    }
}

/**
 * Recursively renders the tree structure using pure DOM elements and CSS logic.
 */
function renderNode(nodeData, isRoot = false) {
    const branch = document.createElement('div');
    branch.className = 'tree-branch';

    const nodeItem = document.createElement('div');
    nodeItem.className = 'node-item';

    // Connection line into this node (from its parent's backbone)
    if (!isRoot) {
        const childConn = document.createElement('div');
        childConn.className = 'child-connector';
        nodeItem.appendChild(childConn);
    }

    const card = document.createElement('div');
    card.className = \`node-card \${isRoot ? 'root' : (nodeData.children ? 'category' : 'leaf')}\`;
    card.innerHTML = \`
        <div class="node-header">
            <span>\${nodeData.icon || '📌'}</span>
            <span>\${nodeData.title}</span>
        </div>
        <div class="node-desc">\${nodeData.desc || ''}</div>
    \`;

    nodeItem.appendChild(card);

    if (nodeData.children && Array.isArray(nodeData.children) && nodeData.children.length > 0) {
        // Add expand indicator
        const indicator = document.createElement('div');
        indicator.className = 'toggle-indicator';
        indicator.innerText = '+'; // Default collapsed representation? No wait, default to expanded!
        indicator.innerText = '−'; // Let's make level 1 expanded by default
        card.appendChild(indicator);

        // Add outgoing parent connector
        const parentConn = document.createElement('div');
        parentConn.className = 'parent-connector';
        nodeItem.appendChild(parentConn);

        // Add container for children
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'children-container'; // Remove hidden default
        
        nodeData.children.forEach(child => {
            childrenContainer.appendChild(renderNode(child));
        });

        // Initialize with children hidden if not root
        if (!isRoot) {
            childrenContainer.classList.add('hidden');
            parentConn.classList.add('hidden');
            indicator.innerText = '+';
        }

        branch.appendChild(nodeItem);
        branch.appendChild(childrenContainer);

        // Interaction Logic
        card.onclick = (e) => {
            e.stopPropagation();
            const isNowHidden = childrenContainer.classList.toggle('hidden');
            parentConn.classList.toggle('hidden');
            indicator.innerText = isNowHidden ? '+' : '−';
            
            // Allow DOM to flow then update backbone
            requestAnimationFrame(() => updateBackbone(childrenContainer));
        };

        // Initial backbone measurement
        requestAnimationFrame(() => updateBackbone(childrenContainer));
    } else {
        branch.appendChild(nodeItem);
    }

    return branch;
}

/**
 * Adjusts the vertical backbone height to perfectly connect first and last visible children.
 */
function updateBackbone(container) {
    if (container.classList.contains('hidden')) return;

    const children = Array.from(container.children).filter(c => c.classList.contains('tree-branch'));
    if (children.length > 0) {
        const firstChild = children[0];
        const lastChild = children[children.length - 1];
        
        // Calculate distance between the centers of first and last child node-items
        const firstNode = firstChild.querySelector('.node-item');
        const lastNode = lastChild.querySelector('.node-item');
        
        if (firstNode && lastNode) {
            const topOffset = firstNode.offsetTop + (firstNode.offsetHeight / 2);
            const bottomOffset = container.offsetHeight - (lastNode.offsetTop + (lastNode.offsetHeight / 2));
            
            // Use a dynamic style property to set the backbone span locally
            container.style.setProperty('--backbone-top', \`\${topOffset}px\`);
            container.style.setProperty('--backbone-bottom', \`\${bottomOffset}px\`);
        }
    }
}
