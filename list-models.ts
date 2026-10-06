import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function listModels() {
  try {
    const models = await ai.models.list();
    console.log("Available models:");
    for await (const model of models) {
      console.log(model.name);
    }
  } catch (e) {
    console.error("Failed to list models:", e);
  }
}

listModels();
