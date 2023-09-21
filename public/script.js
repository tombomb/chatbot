const player = document.getElementById('audio-player');

async function sendMessage() {
    const userInput = document.getElementById('user-input');
    const message = userInput.value;
    if (!message.trim()) return;  // If the message is just whitespace, don't send it

    // Display the user's message on the chat
    displayMessage(message, 'user');

    // Send the message to the server
    const response = await fetch('/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: message })
    });

    const data = await response.json();

    // Display the bot's response on the chat
    if (data.message) {
        displayMessage(data.message, 'bot', data.audioURL);
    } else {
        console.error("No bot response received.");
    }

    // Play the audio response
    if (data.audioURL) {
        playAudio(data.audioURL);
    } else {
        console.error("No audio path received.");
    }

    // Clear the input field
    userInput.value = '';
}

function displayMessage(message, sender, audioURL) {
    const chatHistory = document.getElementById('chat-history');

    if (sender === 'bot' && audioURL) {
        const botContainer = document.createElement('div');
        botContainer.className = 'bot-container';

        const messageDiv = document.createElement('div');
        messageDiv.className = 'bot-message';
        messageDiv.textContent = message;
        botContainer.appendChild(messageDiv);

        const downloadButton = document.createElement('a');
        downloadButton.href = audioURL;
        downloadButton.download = audioURL.split('/').pop();
        downloadButton.textContent = 'Download';
        downloadButton.className = 'download-button';
        botContainer.appendChild(downloadButton);

        chatHistory.appendChild(botContainer);
    } else {
        const messageDiv = document.createElement('div');
        messageDiv.className = sender === 'user' ? 'user-message' : 'bot-message';
        messageDiv.textContent = message;
        chatHistory.appendChild(messageDiv);
    }

    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function playAudio(audioURL) {
    player.src = audioURL;
    player.play();
}
