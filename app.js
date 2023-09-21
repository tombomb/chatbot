const OpenAIApi = require("openai");
const readlineSync = require('readline-sync');
const path = require('path');
const voice = require("elevenlabs-node");
const fs = require("fs-extra");
const sound = require('sound-play');
require('dotenv').config();

const openai = new OpenAIApi(process.env.OPENAI_API_KEY);

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

// Check if the "responses" folder exists, if not, create it
const responsesDir = path.join(__dirname, 'responses');
if (!fs.existsSync(responsesDir)) {
  fs.mkdirSync(responsesDir);
}

// Function to play audio directly in the console
function playAudioInConsole(filename) {
  return sound.play(filename);
}

// Main loop for user interaction
async function main() {
  let counter = 1; // To give each audio file a unique name
  while (true) {
      const userMessage = readlineSync.question('You: ');

      // Check if the user wants to quit
      if (["quit", "stop", "exit"].includes(userMessage.toLowerCase())) {
          console.log("Exiting program. Goodbye!");
          break;
      }

      const modelResponse = await continueConversation(userMessage);
      console.log('ChatGPT:', modelResponse);

      // Use ElevenLabs to generate an audio file from the model's response
      const voiceID = process.env.ELEVENLABS_VOICEID; // Replace with the ID of the voice you want to use
      const filename = path.join(responsesDir, `response_${counter}.mp3`);
      await voice.textToSpeech(process.env.ELEVENLABS_API_KEY, voiceID, filename, modelResponse);

      // Play the audio response directly in the console and wait for it to finish
      await playAudioInConsole(filename);

      counter++;
  }
}

main();
