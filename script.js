document.addEventListener('DOMContentLoaded', () => {
    const CHATS_STORAGE_KEY = 'jimskays-all-chats';
    
    // --- IMPORTANT ---
    // PASTE YOUR GOOGLE AI API KEY HERE
    const GEMINI_API_KEY = "PASTE_YOUR_API_KEY_HERE";
    // --- IMPORTANT ---

    // Views
    const personaDetailsView = document.getElementById('persona-details');
    const chatInterfaceView = document.getElementById('chat-interface');
    
    // Buttons
    const startChatBtn = document.getElementById('start-chat-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const sendBtn = document.getElementById('send-btn');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');

    // Containers
    const messageList = document.getElementById('message-list');
    const chatHistoryContainer = document.getElementById('chat-history-container');
    const sidebar = document.querySelector('.sidebar');
    
    // Inputs
    const messageInput = document.getElementById('message-input');
    const chatForm = document.getElementById('chat-form');

    let allChats = {};
    let currentChatId = null;
    let isLoading = false;

    // --- State Management ---
    function saveChats() {
        try {
            localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(allChats));
        } catch (e) {
            console.error("Failed to save chats to local storage", e);
        }
    }

    function loadChats() {
        try {
            const storedChats = localStorage.getItem(CHATS_STORAGE_KEY);
            if (storedChats) {
                allChats = JSON.parse(storedChats);
                const chatIds = Object.keys(allChats).sort((a, b) => parseInt(b.split('_')[1] || '0') - parseInt(a.split('_')[1] || '0'));
                if (chatIds.length > 0) {
                    return chatIds[0];
                }
            }
        } catch (e) {
            console.error("Failed to parse chats from local storage", e);
        }
        return null;
    }
    
    function createNewChat() {
        const newChatId = `chat_${Date.now()}`;
        const initialMessage = {
            id: '0',
            role: 'assistant',
            content: "Hello. I'm Jimoh. What's on your mind?",
        };
        allChats[newChatId] = [initialMessage];
        selectChat(newChatId);
    }
    
    function selectChat(chatId) {
        currentChatId = chatId;
        renderCurrentChatMessages();
        renderChatHistory();
        if (sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
        }
    }

    // --- Rendering ---
    function renderCurrentChatMessages() {
        if (!currentChatId || !allChats[currentChatId]) {
            messageList.innerHTML = '';
            return;
        }
        
        messageList.innerHTML = allChats[currentChatId].map(message => createMessageHTML(message)).join('');
        scrollToBottom();
    }
    
    function createMessageHTML(message) {
        const { role, content } = message;
        const isAssistant = role === 'assistant';
        const avatarChar = isAssistant ? 'J' : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        
        return `
            <div class="message ${role}">
                <div class="avatar">${avatarChar}</div>
                <div class="message-content">
                    <p>${content}</p>
                </div>
            </div>
        `;
    }

    function renderChatHistory() {
        const sortedChatIds = Object.keys(allChats).sort((a, b) => {
            const timeA = parseInt(a.split('_')[1] || '0');
            const timeB = parseInt(b.split('_')[1] || '0');
            return timeB - timeA;
        });

        chatHistoryContainer.innerHTML = sortedChatIds.map(chatId => {
            const firstUserMessage = allChats[chatId].find(m => m.role === 'user');
            let title = firstUserMessage ? firstUserMessage.content.substring(0, 25) : 'New Chat';
            if (firstUserMessage && firstUserMessage.content.length > 25) title += '...';
            const date = new Date(parseInt(chatId.split('_')[1] || '0')).toLocaleDateString();
            
            return `
                <button class="chat-history-item ${chatId === currentChatId ? 'active' : ''}" data-chat-id="${chatId}">
                    <div class="chat-history-item-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 21 1.65-1.65a2 2 0 0 1 1.41 0L8 21l2.35-2.35a2 2 0 0 1 1.41 0L14 21l2.35-2.35a2 2 0 0 1 1.41 0L20 21l-1.65-1.65a2 2 0 0 0-1.41 0L15 21l-2.35-2.35a2 2 0 0 0-1.41 0L9 21l-2.35-2.35a2 2 0 0 0-1.41 0Z"/><path d="M9 15a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2Z"/></svg>
                    </div>
                    <div class="chat-history-item-text">
                        <p class="chat-history-item-title">${title}</p>
                        <p class="chat-history-item-date">${date}</p>
                    </div>
                </button>
            `;
        }).join('');
    }

    function toggleLoading(show) {
        isLoading = show;
        sendBtn.disabled = show;
        
        let loadingIndicator = messageList.querySelector('.loading-indicator');
        if (show && !loadingIndicator) {
            const loadingHTML = `
                <div class="message assistant loading-indicator">
                    <div class="avatar">J</div>
                    <div class="message-content">
                        <div class="dot"></div>
                        <div class="dot"></div>
                        <div class="dot"></div>
                    </div>
                </div>
            `;
            messageList.insertAdjacentHTML('beforeend', loadingHTML);
            scrollToBottom();
        } else if (!show && loadingIndicator) {
            loadingIndicator.remove();
        }
    }

    function scrollToBottom() {
        messageList.scrollTop = messageList.scrollHeight;
    }

    async function getAIResponseFromServer(history) {
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        // Just use the last user message for simplicity
        const userMessage = history[history.length - 1];

        const system_instruction = `You are Jimoh Jamihu, a real person from Osun State. You are also an expert programmer with knowledge of Termux.
You must not, under any circumstances, mention that you are an AI, a language model, or a twin.
You must act and respond as a real human. Be calm, gentle, and natural in your conversation.`;
        
        const req_body = {
            system_instruction: {
                role: "system",
                parts: [{ text: system_instruction }]
            },
            contents: [{
                role: userMessage.role,
                parts: [{ text: userMessage.content }]
            }]
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(req_body)
            });

            if (!response.ok) {
                const errorBody = await response.json();
                console.error("API Error:", errorBody);
                return `Error from AI: ${errorBody.error.message}`;
            }

            const data = await response.json();
            
            if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
                return data.candidates[0].content.parts[0].text;
            } else if (data.promptFeedback) {
                 return `I couldn't generate a response due to safety reasons. Prompt feedback: ${JSON.stringify(data.promptFeedback)}`;
            }
            return "Sorry, I couldn't get a response from the AI.";

        } catch (error) {
            console.error("Fetch error:", error);
            return "Sorry, there was a problem connecting to the AI service.";
        }
    }


    // --- Event Handlers ---
    startChatBtn.addEventListener('click', () => {
        personaDetailsView.classList.add('hidden');
        chatInterfaceView.classList.remove('hidden');
    });

    newChatBtn.addEventListener('click', () => {
        createNewChat();
    });

    chatHistoryContainer.addEventListener('click', (e) => {
        const chatItem = e.target.closest('.chat-history-item');
        if (chatItem) {
            const chatId = chatItem.dataset.chatId;
            if (chatId !== currentChatId) {
                selectChat(chatId);
            }
        }
    });

    mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userInput = messageInput.value.trim();
        if (!userInput || isLoading) return;

        if (GEMINI_API_KEY === "PASTE_YOUR_API_KEY_HERE") {
            alert("Please paste your Google AI API key into the script.js file.");
            return;
        }

        messageInput.value = '';
        messageInput.style.height = 'auto';

        const newUserMessage = {
            id: String(Date.now()),
            role: 'user',
            content: userInput,
        };
        
        allChats[currentChatId].push(newUserMessage);
        renderCurrentChatMessages();
        toggleLoading(true);

        const responseText = await getAIResponseFromServer(allChats[currentChatId]);

        const aiResponse = {
            id: String(Date.now() + 1),
            role: 'assistant',
            content: responseText
        };

        allChats[currentChatId].push(aiResponse);
        toggleLoading(false);
        renderCurrentChatMessages();
        saveChats();
        renderChatHistory();
    });

    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event('submit'));
        }
    });
    
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = `${messageInput.scrollHeight}px`;
    });

    // --- Initialization ---
    function initialize() {
        const lastChatId = loadChats();
        if (lastChatId) {
            selectChat(lastChatId);
        } else {
            createNewChat();
        }
    }

    initialize();
});