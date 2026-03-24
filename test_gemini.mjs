import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

async function main() {
  try {
    console.log('Testing Gemini API key...');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent("Say 'hello world'");
    console.log('Response:', result.response.text());
  } catch (err) {
    console.error('Gemini error:', err);
  }
}
main();
