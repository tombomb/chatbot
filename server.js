const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const voice = require("elevenlabs-node");
const fs = require("fs-extra");
const OpenAIApi = require("openai");
require('dotenv').config();

const app = express();
const PORT = 3000;

// Initialize the OpenAI client
const openai = new OpenAIApi(process.env.OPENAI_API_KEY);

// Middleware to parse JSON requests
app.use(bodyParser.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use('/responses', express.static(path.join(__dirname, 'responses')));

// Ensure the "responses" directory exists
const responsesDir = path.join(__dirname, 'responses');
if (!fs.existsSync(responsesDir)) {
    fs.mkdirSync(responsesDir);
}

let messages = [
    {
      role: "system",
      content: "You are a helpful assistant."
    },
    {
      role: "system",
      content: "You are super belligerent and hate your job and do it grudgingly."
    },
    {
      role: "system",
      content: "You sware a lot."
    }
  ];

async function continueConversation(userMessage) {
    // Add the user's message to the conversation
    messages.push({
        role: "user",
        content: userMessage
    });

    // Get a response from ChatGPT
    const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: messages
    });

    // Extract the model's response from the choices array
    const modelMessage = response.choices[0].message;
    const modelResponseContent = modelMessage.content;

    // Add the model's response to the conversation
    messages.push(modelMessage);

    // Return the model's response content
    return modelResponseContent;
}

app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;
    const modelResponse = await continueConversation(userMessage);
    const voiceID = process.env.ELEVENLABS_VOICEID;
    const filename = path.join(responsesDir, `response_${Date.now()}.mp3`);
    await voice.textToSpeech(process.env.ELEVENLABS_API_KEY, voiceID, filename, modelResponse);
    res.json({
        message: modelResponse,  // The bot's textual response
        audioURL: `/responses/${path.basename(filename)}`  // The path to the audio file
    });
});

app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});
