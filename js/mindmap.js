let zoomScale = 1;
let translateX = 0;
let translateY = 0;
let isDragging = false;
let startX, startY;
let mindmapData = null;
let nodeMeta = new Map(); // Stores {x, y, collapsed}

const NODE_WIDTH = 250;
const NODE_HEIGHT = 100;
const LEVEL_GAP = 350;
const SIBLING_GAP = 140;

function initMindMap(data) {
    const container = document.getElementById('mindmap-view');
    if (!container) return;
    
    // Create new structure for pan/zoom
    container.innerHTML = `
        <div id="mindmap-viewport" style="width: 100%; height: 100%; overflow: hidden; cursor: grab; position: relative;">
            <div id="mindmap-content" style="transform-origin: 0 0; transition: transform 0.1s ease-out;">
                <svg class="mindmap-svg-layer" id="mindmap-svg"></svg>
                <div id="tree-root" style="position: absolute; top: 0; left: 0;"></div>
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
    nodeMeta.clear();
    
    if (!data || !data.title) {
        container.innerHTML += '<div class="empty-state-card"><h3>No mind map available</h3><p>Click "Regenerate Tab" to generate a mind map.</p></div>';
        return;
    }

    // Initialize metadata
    initNodeMeta(mindmapData, 0);
    
    // Initial layout
    requestAnimationFrame(() => {
        layoutAndRender();
        resetView();
    });
}

function initPanZoom(viewport) {
    const content = document.getElementById('mindmap-content');
    
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
    zoomScale = 0.6; // Start slightly zoomed out
    translateX = 50;
    translateY = 150;
    updateTransform();
}

function updateTransform() {
    const content = document.getElementById('mindmap-content');
    if (content) {
        content.style.transform = `translate(${translateX}px, ${translateY}px) scale(${zoomScale})`;
    }
}

function initNodeMeta(node, depth) {
    const id = getNodePath(node);
    nodeMeta.set(id, {
        collapsed: depth >= 2, // Collapse deeper levels by default
        x: 0,
        y: 0,
        depth: depth
    });
    if (node && node.children && Array.isArray(node.children)) {
        node.children.forEach(child => initNodeMeta(child, depth + 1));
    }
}

function getNodePath(node) {
    return node._path || node.title; // Simple path for demo, should be more robust in real recursion
}

function layoutAndRender() {
    const container = document.getElementById('tree-root');
    const svg = document.getElementById('mindmap-svg');

    if (!container || !mindmapData || !mindmapData.title) return;
    
    // Clear old SVG lines because we no longer use them for this DOM-based structure
    if (svg) svg.innerHTML = '';
    
    // Render tree using the orthogonal recursive builder from example mindmap
    container.innerHTML = '';
    container.appendChild(renderNode(mindmapData, true));
}

/**
 * Recursively renders the tree structure.
 */
function renderNode(nodeData, isRoot = false) {
    const id = getNodePath(nodeData);
    const meta = nodeMeta.get(id);

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

    // Randomized rotation for notebook feel
    const rotation = (Math.random() * 2 - 1).toFixed(1);

    const card = document.createElement('div');
    card.className = `node-card ${isRoot ? 'root' : (nodeData.children ? 'category' : 'leaf')}`;
    card.style.transform = `rotate(${rotation}deg)`;
    
    // Ensure titles are formatted consistently whether using new or old payload shapes
    const displayTitle = nodeData.title || nodeData.text || 'Concept';
    const displayDesc = nodeData.desc || nodeData.description || '';
    const displayIcon = nodeData.icon || (isRoot ? '🧠' : '📍');

    card.innerHTML = `
        <div class="node-header">
            <span>${displayIcon}</span>
            <span>${displayTitle}</span>
        </div>
        ${displayDesc ? `<div class="node-desc">${displayDesc}</div>` : ''}
    `;

    nodeItem.appendChild(card);

    if (nodeData.children && nodeData.children.length > 0) {
        // Add expand indicator
        const indicator = document.createElement('div');
        indicator.className = 'toggle-indicator';
        indicator.innerText = meta.collapsed ? '+' : '−';
        
        card.appendChild(indicator);

        // Add outgoing parent connector (hidden until expanded)
        const parentConn = document.createElement('div');
        parentConn.className = 'parent-connector' + (meta.collapsed ? ' hidden' : '');
        nodeItem.appendChild(parentConn);

        // Add container for children (hidden until expanded)
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'children-container' + (meta.collapsed ? ' hidden' : '');
        
        nodeData.children.forEach((child, idx) => {
            if (!child) return;
            // Provide a temporary path so child can be uniquely identified
            child._path = id + '->' + (child.title || idx);
            // Ensure meta exists
            if (!nodeMeta.has(child._path)) {
                nodeMeta.set(child._path, { collapsed: false, id: child._path });
            }
            childrenContainer.appendChild(renderNode(child));
        });

        branch.appendChild(nodeItem);
        branch.appendChild(childrenContainer);

        // Interaction Logic
        card.onclick = (e) => {
            e.stopPropagation();
            meta.collapsed = !meta.collapsed;
            
            const isNowHidden = childrenContainer.classList.toggle('hidden');
            parentConn.classList.toggle('hidden');
            indicator.innerText = isNowHidden ? '+' : '−';
            
            // Recalculate backbone when toggling
            requestAnimationFrame(() => updateBackbone(childrenContainer));
        };
        // Initialize backbone layout on first frame if not hidden
        if (!meta.collapsed) {
            requestAnimationFrame(() => updateBackbone(childrenContainer));
        }
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
            
            // Use a dynamic style property to set the backbone span
            container.style.setProperty('--backbone-top', `${topOffset}px`);
            container.style.setProperty('--backbone-bottom', `${bottomOffset}px`);
        }
    }
}
