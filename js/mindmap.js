let mindmapData = null;
let nodeMeta = new Map(); // Stores {x, y, collapsed}

const NODE_WIDTH = 250;
const NODE_HEIGHT = 100;
const LEVEL_GAP = 350;
const SIBLING_GAP = 140;

function initMindMap(data) {
    const container = document.getElementById('tree-root');
    if (!container) return;
    container.innerHTML = '<svg class="mindmap-svg-layer" id="mindmap-svg"></svg>';
    
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
    
    // 1. Calculate Positions (Hierarchical Layout)
    calculatePositions(mindmapData, 100, 500); // Start root at x=100, y=500
    
    // 2. Clear current nodes (except SVG)
    Array.from(container.children).forEach(child => {
        if (child.id !== 'mindmap-svg') child.remove();
    });
    
    // 3. Render Nodes
    renderNodes(mindmapData, container);
    
    // 4. Render Links
    svg.innerHTML = '';
    renderLinks(mindmapData, svg);
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
        const x1 = meta.x + NODE_WIDTH;
        const y1 = meta.y + NODE_HEIGHT / 2;
        const x2 = childMeta.x;
        const y2 = childMeta.y + NODE_HEIGHT / 2;
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        // Simple cubic bezier for hand-drawn feel
        const cx = x1 + (x2 - x1) / 2;
        const d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
        
        path.setAttribute('d', d);
        path.setAttribute('class', 'mindmap-connection');
        svg.appendChild(path);
        
        renderLinks(child, svg);
    });
}
