const player = document.getElementById('audio-player');

async function sendMessage() {
    const userInput = document.getElementById('user-input');
    const submitButton = document.querySelector('button');
    const message = userInput.value.trim();

    if (!message) return;

    submitButton.disabled = true;
    userInput.value = '';

    displayMessage(message, 'user');

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });

        const data = await response.json();

        if (data.message) {
            displayMessage(data.message, 'assistant', data.audioURL);
            playAudio(data.audioURL);
        } else {
            console.error("No bot response received.");
        }
    } catch (error) {
        console.error("Error sending message:", error);
    } finally {
        submitButton.disabled = false;
    }
}

function displayMessage(message, sender, audioURL) {
    const chatHistory = document.getElementById('chat-history');
    const messageDiv = document.createElement('div');
    messageDiv.className = `${sender}-message`;
    messageDiv.textContent = message;

    if (sender === 'assistant' && audioURL) {
        messageDiv.onclick = () => playAudio(audioURL);
        const downloadButton = document.createElement('a');
        downloadButton.href = audioURL;
        downloadButton.download = audioURL.split('/').pop();
        downloadButton.className = 'btn btn-link download-button';
        downloadButton.innerHTML = '<i class="fas fa-download"></i>';

        const botContainer = document.createElement('div');
        botContainer.className = 'bot-container';
        botContainer.append(messageDiv, downloadButton);
        chatHistory.prepend(botContainer); // Change this line
    } else {
        chatHistory.prepend(messageDiv); // Change this line
    }

    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function displaySingleMessage(message) {
    const chatHistory = document.getElementById('chat-history');
    const messageDiv = document.createElement('div');
    messageDiv.className = `${message.role}-message`;
    messageDiv.textContent = message.content;

    if (message.role === 'assistant' && message.audioPath) {
        // Add an onclick event to the bot message div to play the associated audio
        messageDiv.onclick = function() {
            playAudio(message.audioPath);
        };

        const downloadButton = document.createElement('a');
        downloadButton.href = message.audioPath;
        downloadButton.download = message.audioPath.split('/').pop();
        downloadButton.className = 'btn btn-link download-button';
        downloadButton.innerHTML = '<i class="fas fa-download"></i>';

        const botContainer = document.createElement('div');
        botContainer.className = 'bot-container';
        botContainer.appendChild(messageDiv);
        botContainer.appendChild(downloadButton);
        chatHistory.prepend(botContainer); // Change this line
    } else {
        chatHistory.prepend(messageDiv); // Change this line
    }

    chatHistory.scrollTop = chatHistory.scrollHeight;
}

async function loadMessageHistory(filename) {
    if (!filename) {
        console.warn("No filename provided. Skipping loading message history.");
        return;
    }

    // Clear the chat history display in the DOM
    const chatHistory = document.getElementById('chat-history');
    chatHistory.innerHTML = '';

    try {
        const response = await fetch(`/getHistory/${filename}`);
        const history = await response.json();
        for (const message of history) {
            displaySingleMessage(message);
        }
    } catch (error) {
        console.error("Error loading message history:", error);
    }
}

async function loadConversations() {
    try {
        const response = await fetch('/getConversations');
        const conversations = await response.json();
        const chatList = document.getElementById('chat-list');
        chatList.innerHTML = ''; // Clear the list

        for (const conversation of conversations) {
            const listItem = document.createElement('li');
            listItem.dataset.filename = conversation.filename; // Store filename in dataset for later use

            const nameSpan = document.createElement('span');
            nameSpan.className = 'conversation-name';
            nameSpan.textContent = conversation.name || conversation.filename;
            listItem.appendChild(nameSpan);

            const editIcon = document.createElement('i');
            editIcon.className = "fas fa-pencil-alt edit-icon";
            listItem.appendChild(editIcon);

            // Attach click event to load the chat history
            listItem.onclick = function(event) {
                if (event.target !== editIcon) { // Ensure we're not clicking the edit icon
                    loadMessageHistory(listItem.dataset.filename);
                }
            };

            editIcon.onclick = function() {
                triggerEdit(listItem, conversation, editIcon);
            };

            chatList.appendChild(listItem);
        }
    } catch (error) {
        console.error("Error loading conversations:", error);
    }
}

async function saveChanges(input, listItem, conversation, editIcon) {
    const newName = input.value.trim();
    if (newName && newName !== conversation.name) {
        try {
            const response = await fetch('/updateConversationName', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: conversation.filename, newName })
            });

            if (response.ok) {
                // Create a new span with the class .conversation-name
                const nameSpan = document.createElement('span');
                nameSpan.className = 'conversation-name';
                nameSpan.textContent = newName;

                // Clear the listItem and append the new span and editIcon
                listItem.innerHTML = '';
                listItem.append(nameSpan, editIcon);

                conversation.name = newName;
                editIcon.className = "fas fa-pencil-alt edit-icon";
            } else {
                console.error('Failed to update the conversation name.');
            }
        } catch (error) {
            console.error("Error updating conversation name:", error);
        }
    } else {
        // Create a new span with the class .conversation-name
        const nameSpan = document.createElement('span');
        nameSpan.className = 'conversation-name';
        nameSpan.textContent = conversation.name || conversation.filename;

        // Clear the listItem and append the new span and editIcon
        listItem.innerHTML = '';
        listItem.append(nameSpan, editIcon);

        editIcon.className = "fas fa-pencil-alt edit-icon";
    }
    setTimeout(() => {
        // Reset the edit icon's click event to trigger the edit mode
        editIcon.onclick = function() {
            triggerEdit(listItem, conversation, editIcon);
        };
    }, 100); // 100ms delay
}

function triggerEdit(listItem, conversation, editIcon) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = conversation.name || conversation.filename;

    input.addEventListener('keypress', async function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            await saveChanges(input, listItem, conversation, editIcon);
        }
    });

    input.onblur = async function() {
        await saveChanges(input, listItem, conversation, editIcon);
    };

    editIcon.className = "fas fa-check edit-icon";
    editIcon.onclick = async function() {
        await saveChanges(input, listItem, conversation, editIcon);
    };

    listItem.innerHTML = '';
    listItem.append(input, editIcon);
    input.focus();
}

async function createNewChat() {
    try {
        const response = await fetch('/createNewChat', { method: 'POST' });
        const newChat = await response.json();
        loadConversations();
    } catch (error) {
        console.error("Error creating new chat:", error);
    }
}

document.getElementById('new-chat-button').addEventListener('click', createNewChat);
loadMessageHistory();
loadConversations();

function playAudio(audioURL) {
    player.src = audioURL;
    player.play();
}
