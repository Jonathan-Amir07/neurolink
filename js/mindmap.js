let zoomScale = 1;
let translateX = 0;
let translateY = 0;
let isDragging = false;
let startX, startY;

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
    layoutAndRender();
    resetView();
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
    if (node.children) {
        node.children.forEach(child => initNodeMeta(child, depth + 1));
    }
}

function getNodePath(node) {
    return node._path || node.title; // Simple path for demo, should be more robust in real recursion
}

function layoutAndRender() {
    const container = document.getElementById('tree-root');
    const svg = document.getElementById('mindmap-svg');
    
    if (!container || !svg) return;

    // 1. Calculate Positions (Hierarchical Layout)
    calculatePositions(mindmapData, 0, 0); 
    
    // 2. Clear current nodes (except SVG)
    container.innerHTML = '';
    
    // 3. Render Nodes
    renderNodes(mindmapData, container);
    
    // 4. Render Links
    svg.innerHTML = '';
    const bounds = calculateBounds(mindmapData);
    svg.setAttribute('width', bounds.width + 500);
    svg.setAttribute('height', bounds.height + 500);
    renderLinks(mindmapData, svg);
}

function calculateBounds(node) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodeMeta.forEach(m => {
        minX = Math.min(minX, m.x);
        maxX = Math.max(maxX, m.x + NODE_WIDTH);
        minY = Math.min(minY, m.y);
        maxY = Math.max(maxY, m.y + NODE_HEIGHT);
    });
    return { width: maxX - minX, height: maxY - minY };
}

// recursive position calculation
function calculatePositions(node, x, yStart) {
    const id = getNodePath(node);
    const meta = nodeMeta.get(id);
    meta.x = x;
    
    const visibleChildren = (!meta.collapsed && node.children) ? node.children : [];
    
    if (visibleChildren.length === 0) {
        meta.y = yStart;
        return NODE_HEIGHT + SIBLING_GAP;
    }

    let totalHeight = 0;
    let currentY = yStart;
    
    visibleChildren.forEach((child, index) => {
        // Tag children with unique paths to avoid collisions in the map
        child._path = id + '->' + (child.title || index);
        const childHeight = calculatePositions(child, x + LEVEL_GAP, currentY);
        totalHeight += childHeight;
        currentY += childHeight;
    });

    // Center parent relative to children
    meta.y = yStart + (totalHeight - SIBLING_GAP) / 2;
    return totalHeight;
}

function renderNodes(node, container) {
    const id = getNodePath(node);
    const meta = nodeMeta.get(id);
    
    const nodeEl = document.createElement('div');
    nodeEl.className = 'mindmap-node' + (meta.collapsed ? ' collapsed' : '');
    nodeEl.style.left = `${meta.x}px`;
    nodeEl.style.top = `${meta.y}px`;
    
    // Randomized rotation for notebook feel
    const rotation = (Math.random() * 4 - 2).toFixed(1);
    
    const card = document.createElement('div');
    card.className = 'mindmap-card' + (meta.depth === 0 ? ' root' : '');
    card.style.transform = `rotate(${rotation}deg)`;
    
    card.innerHTML = `
        <h4>${node.icon || '📌'} ${node.title}</h4>
        <p>${node.desc || ''}</p>
    `;
    
    if (node.children && node.children.length > 0) {
        const toggle = document.createElement('div');
        toggle.className = 'node-toggle';
        toggle.innerText = meta.collapsed ? '+' : '−';
        card.appendChild(toggle);
        
        card.onclick = (e) => {
            e.stopPropagation();
            meta.collapsed = !meta.collapsed;
            layoutAndRender();
        };
    }

    nodeEl.appendChild(card);
    container.appendChild(nodeEl);

    if (!meta.collapsed && node.children) {
        node.children.forEach(child => renderNodes(child, container));
    }
}

function renderLinks(node, svg) {
    const id = getNodePath(node);
    const meta = nodeMeta.get(id);
    
    const visibleChildren = (!meta.collapsed && node.children) ? node.children : [];
    
    visibleChildren.forEach(child => {
        const childMeta = nodeMeta.get(getNodePath(child));
        
        // Offset to center points
        const x1 = meta.x + NODE_WIDTH - 20;
        const y1 = meta.y + NODE_HEIGHT / 2;
        const x2 = childMeta.x + 10;
        const y2 = childMeta.y + NODE_HEIGHT / 2;
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        
        // Organic organic curve with a mid-point wobble
        const cp1x = x1 + (x2 - x1) * 0.4;
        const cp2x = x1 + (x2 - x1) * 0.6;
        const d = `M ${x1} ${y1} C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`;
        
        path.setAttribute('d', d);
        path.setAttribute('class', 'mindmap-connection');
        
        // Randomly add a slightly offset companion path for "ink" feel
        svg.appendChild(path);
        
        if (Math.random() > 0.5) {
            const secondPath = path.cloneNode();
            const d2 = `M ${x1} ${y1+1} C ${cp1x+2} ${y1+1}, ${cp2x-2} ${y2+1}, ${x2} ${y2+1}`;
            secondPath.setAttribute('d', d2);
            secondPath.style.opacity = '0.2';
            svg.appendChild(secondPath);
        }
        
        renderLinks(child, svg);
    });
}
