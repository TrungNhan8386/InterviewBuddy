import { HEALTH_PROMPT_CONFIG, promptText } from './prompt-config.mjs';

export function buildHealthRequest() {
  return {
    contents: [{ parts: [{ text: promptText(HEALTH_PROMPT_CONFIG) }] }],
    generationConfig: { maxOutputTokens: 50 },
  };
}
