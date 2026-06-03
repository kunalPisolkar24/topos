import { getDefaultOptions, createClient, checkResponse, TEST_HTML, TEST_TITLE, TEST_BODY, TEST_PROMPT } from './shared.js';

const vus = parseInt(__ENV.VUS) || 5;
const duration = __ENV.DURATION || '30s';
const rps = parseInt(__ENV.RPS) || 10;

export const options = getDefaultOptions(vus, duration, rps);

const client = createClient();

export default function () {
  const r = Math.random();

  if (r < 0.4) {
    const response = client.invoke('ai.AIService/GenerateSummary', {
      text: TEST_HTML,
    });
    checkResponse(response, 'GenerateSummary');
  } else if (r < 0.7) {
    const response = client.invoke('ai.AIService/GenerateTags', {
      title: TEST_TITLE,
      body: TEST_BODY,
    });
    checkResponse(response, 'GenerateTags');
  } else {
    const response = client.invoke('ai.AIService/GeneratePost', {
      prompt: TEST_PROMPT,
    });
    checkResponse(response, 'GeneratePost');
  }
}
