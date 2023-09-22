const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const voice = require("elevenlabs-node");
const fs = require("fs-extra");
const OpenAIApi = require("openai");
require('dotenv').config();

const app = express();
const PORT = 3000;

let currentConversationFile = null;
let conversationCounter = 0;

let currentChat = {
  name: "",
  messages: []
};


function generateFilename() {
  const numberPart = String(conversationCounter).padStart(8, '0');
  const timestamp = Date.now();
  return `${numberPart}-${timestamp}.json`;
}

function saveConversation(messages) {
  if (!currentConversationFile) {
      currentConversationFile = path.join('conversations', generateFilename());
  }
  const data = {
      userId: "", // Placeholder for future user management
      name: "", // User defined name for the conversation
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      messages: messages
  };
  fs.writeFileSync(currentConversationFile, JSON.stringify(data, null, 2));

  // Return the filename or full path for further use
  return currentConversationFile;
}

function loadLatestConversation() {
  const files = fs.readdirSync('conversations').filter(file => file.endsWith('.json'));
  if (files.length === 0) return null;
  const latestFile = files.sort()[files.length - 1];
  currentConversationFile = path.join('conversations', latestFile);
  return JSON.parse(fs.readFileSync(currentConversationFile, 'utf-8')).messages;
}

// On server startup, load the latest conversation or use default messages
let messages = loadLatestConversation() || [
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

// Initialize the OpenAI client
const openai = new OpenAIApi(process.env.OPENAI_API_KEY);

// Middleware to parse JSON requests
app.use(bodyParser.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/responses', express.static(path.join(__dirname, 'responses')));

const responsesDir = path.join(__dirname, 'responses');
const conversationsDir = path.join(__dirname, 'conversations');

// Ensure directories exist
if (!fs.existsSync(responsesDir)) {
    fs.mkdirSync(responsesDir);
}
if (!fs.existsSync(conversationsDir)) {
    fs.mkdirSync(conversationsDir);
}

async function continueConversation(userMessage) {
    // Add the user's message to the conversation
    messages.push({
        role: "user",
        content: userMessage
    });

    const filteredMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Get a response from ChatGPT
    const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: filteredMessages
    });

    // Extract the model's response from the choices array
    const modelMessage = response.choices[0].message;
    const modelResponseContent = modelMessage.content;

    const filename = path.join(responsesDir, `response_${Date.now()}.mp3`);
    await voice.textToSpeech(process.env.ELEVENLABS_API_KEY, process.env.ELEVENLABS_VOICEID, filename, modelResponseContent);

    return {
        modelResponse: modelResponseContent,
        filename: filename
    };
}

app.post('/chat', async (req, res) => {
  try {
    const userMessage = req.body.message;
    const response = await continueConversation(userMessage);

    // Add the user's message to the currentChat object
    currentChat.messages.push({
        role: "user",
        content: userMessage
    });

    // Add the model's response and audio path to the currentChat object
    currentChat.messages.push({
        role: "assistant",
        content: response.modelResponse,
        audioPath: `/responses/${path.basename(response.filename)}`
    });

    // Save the currentChat object
    await saveConversation(currentChat.messages);

    res.json({
        message: response.modelResponse,  // The bot's textual response
        audioURL: `/responses/${path.basename(response.filename)}`  // The path to the audio file
    });
  } catch (error) {
    console.error('Error in /chat endpoint:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/getHistory/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = `./conversations/${filename}`;
  if (fs.existsSync(filePath)) {
      const conversation = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      res.json(conversation.messages);
  } else {
      res.status(404).send('Conversation not found');
  }
});

app.get('/getConversations', async (req, res) => {
  try {
      const files = await fs.promises.readdir('./conversations');
      const conversations = await Promise.all(files.filter(file => file.endsWith('.json')).map(async file => {
          const content = await fs.promises.readFile(`./conversations/${file}`, 'utf-8');
          const json = JSON.parse(content);
          return {
              filename: file,
              name: json.name || file // Use filename if name is empty
          };
      }));
      res.json(conversations);
  } catch (error) {
      console.error('Error in /getConversations endpoint:', error);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/updateConversationName', async (req, res) => {
  const { filename, newName } = req.body;

  if (!filename || !newName) {
      return res.status(400).json({ error: 'Filename and new name are required.' });
  }

  try {
      const filePath = `./conversations/${filename}`;
      const conversation = JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
      conversation.name = newName;
      await fs.promises.writeFile(filePath, JSON.stringify(conversation, null, 2));
      res.json({ message: 'Name updated successfully.' });
  } catch (error) {
      if (error.code === 'ENOENT') {
          res.status(404).json({ error: 'File not found.' });
      } else {
          console.error('Error in /updateConversationName endpoint:', error);
          res.status(500).json({ error: 'Internal Server Error' });
      }
  }
});

app.post('/createNewChat', async (req, res) => {
  try {
      if (currentConversationFile) {
          await saveConversation(currentChat.messages);
          currentConversationFile = null; // Reset the current file
      }

      const newChatFilename = generateFilename();

      currentChat = {
          name: newChatFilename,
          messages: []
      };

      const newChat = {
          name: newChatFilename, // Use the filename as the default name
          messages: []
      };

      // Save the new chat using the existing function
      await saveConversation(newChat.messages);

      // Update the conversationCounter for the next chat
      conversationCounter++;

      res.json(newChat);
  } catch (error) {
      console.error('Error in /createNewChat endpoint:', error);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/getConversationHistory', (req, res) => {
  const filename = req.query.filename;
  if (!filename) {
      return res.status(400).send('Filename is required.');
  }

  const filePath = path.join('conversations', filename);
  if (fs.existsSync(filePath)) {
      const conversation = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      res.json(conversation.messages);
  } else {
      res.status(404).send('File not found.');
  }
});

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});