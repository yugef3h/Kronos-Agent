import { ChatOpenAI } from '@langchain/openai';
import { env } from '../../config/env.js';

export const chatModel = new ChatOpenAI({
  model: env.DOUBAO_MODEL,
  apiKey: env.DOUBAO_API_KEY,
  configuration: {
    baseURL: env.DOUBAO_BASE_URL,
  },
  temperature: 0.5,
});
