import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import type { Message } from '../domain/sessionStore.js';
import { env } from '../config/env.js';

const toLangChainMessage = (message: Message): HumanMessage | AIMessage => {
  if (message.role === 'user') {
    return new HumanMessage(message.content);
  }

  return new AIMessage(message.content);
};

const chatModel = new ChatOpenAI({
  model: env.DOUBAO_MODEL,
  apiKey: env.DOUBAO_API_KEY,
  configuration: {
    baseURL: env.DOUBAO_BASE_URL,
  },
  temperature: 0.5,
});

export async function* streamLangChainReply(params: {
  prompt: string;
  history: Message[];
}): AsyncGenerator<string> {
  const messages = [
    ...params.history.map(toLangChainMessage),
    new HumanMessage(params.prompt),
  ];

  const stream = await chatModel.stream(messages);

  for await (const chunk of stream) {
    const content = typeof chunk.content === 'string' ? chunk.content : '';
    if (content.length > 0) {
      yield content;
    }
  }
}
