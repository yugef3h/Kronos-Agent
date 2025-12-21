/** 兼容旧 import 路径；新代码请使用细分模块。 */
export { chatModel } from './chat/chatModel.js';
export { buildUserHumanMessage } from './chat/buildUserHumanMessage.js';
export type { LangChainStreamEvent } from './chat/streamEventTypes.js';
export { playgroundToolRegistry as toolRegistry } from './tools/playgroundToolRegistry.js';
export { streamLinearChatReply as streamLangChainReply } from './linear/linearChatStream.js';
export { streamLangGraphChatReply as streamLangGraphReply } from './langgraph/langGraphChatStream.js';
