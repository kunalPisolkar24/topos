import { getDefaultOptions, getClient, checkResponse, TEST_HTML } from './shared.js';

const vus = parseInt(__ENV.VUS) || 5;
const duration = __ENV.DURATION || '30s';
const rps = parseInt(__ENV.RPS) || 10;

export const options = getDefaultOptions(vus, duration, rps);

export default function () {
  const client = getClient();
  const response = client.invoke('ai.AIService/GenerateSummary', {
    text: TEST_HTML,
  });
  checkResponse(response, 'GenerateSummary');
}
