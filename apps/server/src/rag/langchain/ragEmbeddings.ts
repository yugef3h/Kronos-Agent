import { OpenAIEmbeddings } from '@langchain/openai';
import { env } from '../../config/env.js';

export function createRagEmbeddings(): OpenAIEmbeddings {
  const model = env.DOUBAO_EMBEDDING_MODEL?.trim() || env.DOUBAO_MODEL;
  return new OpenAIEmbeddings({
    model,
    apiKey: env.DOUBAO_API_KEY,
    configuration: {
      baseURL: env.DOUBAO_BASE_URL,
    },
  });
}
