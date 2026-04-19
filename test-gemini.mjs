import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  vertexai: true,
  project: 'news-triangulator',
  location: 'us-central1',
});

console.log('Testing Vertex Gemini via @google/genai...');
try {
  const result = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: 'Say hello in one short sentence.' }] }],
  });
  console.log(result.text ?? '');
} catch (e) {
  console.error(e);
  console.error(e.cause);
}
