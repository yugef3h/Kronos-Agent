import { getPlaygroundChatModel } from '../../ai/gateway/getPlaygroundChatModel.js';

/** G-11 / P2-G-01: 模块加载时默认模型（无请求上下文） */
export const chatModel = getPlaygroundChatModel({}, { temperature: 0.5 });
