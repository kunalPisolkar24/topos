import { getDefaultOptions, createClient, checkResponse, TEST_TITLE, TEST_BODY } from './shared.js';

const vus = parseInt(__ENV.VUS) || 5;
const duration = __ENV.DURATION || '30s';
const rps = parseInt(__ENV.RPS) || 10;

export const options = getDefaultOptions(vus, duration, rps);

const client = createClient();

export default function () {
  const response = client.invoke('ai.AIService/GenerateTags', {
    title: TEST_TITLE,
    body: TEST_BODY,
  });
  checkResponse(response, 'GenerateTags');
}
