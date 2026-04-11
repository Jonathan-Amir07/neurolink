function toggleChat() {
    const window = document.getElementById('chat-window');
    window.classList.toggle('visible');
}

const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');

if (chatForm) {
    chatForm.onsubmit = async (e) => {
        e.preventDefault();
        const message = chatInput.value.trim();
        if (!message) return;

        // Add user message
        addMessage(message, 'user');
        chatInput.value = '';

        // Show AI typing
        const typingId = 'typing-' + Date.now();
        addMessage('...', 'ai', typingId);

        try {
            const params = new URLSearchParams(window.location.search);
            const projectId = params.get('id');

            const res = await fetch(`/api/chat/${projectId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });

            const typingEl = document.getElementById(typingId);
            if (typingEl) typingEl.remove();

            if (res.ok) {
                const data = await res.json();
                addMessage(data.reply, 'ai');
            } else {
                addMessage('Sorry, I encountered an error connecting to the AI.', 'ai');
            }
        } catch (err) {
            const typingEl = document.getElementById(typingId);
            if (typingEl) typingEl.remove();
            addMessage('Connection error. Is the server running?', 'ai');
        }
    };
}

function addMessage(text, sender, id = null) {
    const div = document.createElement('div');
    div.className = `message ${sender} paper-texture`; // Add texture for premium look
    if (id) div.id = id;
    
    // Support basic markdown-ish formatting for AI replies
    if (sender === 'ai') {
        div.style.whiteSpace = 'pre-wrap';
        div.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    } else {
        div.innerText = text;
    }
    
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function loadChatHistory(history) {
    if (!history || !Array.isArray(history)) return;
    chatMessages.innerHTML = '';
    history.forEach(msg => {
        addMessage(msg.message, msg.role === 'user' ? 'user' : 'ai');
    });
    if (history.length === 0) {
        addMessage("Hi! I'm your NeuroLink Study Mate. Ask me anything about this project! 📚", 'ai');
    }
}

function pinToChat(contextText) {
    const window = document.getElementById('chat-window');
    if (!window.classList.contains('visible')) toggleChat();
    
    chatInput.value = `Regarding this: "${contextText}"\n\nMy question is: `;
    chatInput.focus();
}
