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
    div.className = `message ${sender}`;
    if (id) div.id = id;
    div.innerText = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
