import { VertexAI } from '@google-cloud/vertexai';

const vertex = new VertexAI({
  project: 'news-triangulator',
  location: 'us-central1',
});
const model = vertex.getGenerativeModel({ model: 'gemini-2.5-flash' });

console.log('Testing Vertex Gemini...');
try {
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: 'Say hello in one short sentence.' }] }],
  });
  const text =
    result.response.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('') ?? '';
  console.log(text);
} catch (e) {
  console.error(e);
  console.error(e.cause);
}
