import { apiUrl } from '../../../lib/api';
import type { AttachmentMeta, ChatMessage } from '../../../types/chat';
import type { LocalChatMessage, TokenizerModule } from '../types';

type ImageRenderableMessage = Pick<ChatMessage, 'attachments'> & {
  imagePreviewUrl?: string;
  imageName?: string;
};

let tokenizerModulePromise: Promise<TokenizerModule> | null = null;

const getTokenizerModule = (): Promise<TokenizerModule> => {
  if (!tokenizerModulePromise) {
    tokenizerModulePromise = import('gpt-tokenizer').then((module) => ({
      encode: module.encode,
    }));
  }

  return tokenizerModulePromise;
};

export const countTextTokens = async (text: string): Promise<number> => {
  const content = text.trim();
  if (!content) {
    return 0;
  }

  const tokenizer = await getTokenizerModule();
  return Array.from(tokenizer.encode(content)).length;
};

export const formatUploadSize = (size: number): string => {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(size / 1024).toFixed(1)} KB`;
};

export const markLastAssistantMessageIncomplete = (
  chatMessages: LocalChatMessage[],
): LocalChatMessage[] => {
  const draft = [...chatMessages];
  const lastMessage = draft[draft.length - 1];

  if (!lastMessage || lastMessage.role !== 'assistant') {
    return draft;
  }

  draft[draft.length - 1] = {
    ...lastMessage,
    isIncomplete: true,
  };

  return draft;
};

export const getPrimaryImageAttachment = (
  message: Pick<ChatMessage, 'attachments'>,
): AttachmentMeta | undefined => {
  return message.attachments?.find((attachment) => attachment.type === 'image');
};

export const getRenderableImageSource = (message: ImageRenderableMessage): string | undefined => {
  if (message.imagePreviewUrl?.trim()) {
    return message.imagePreviewUrl;
  }

  const imageAttachment = getPrimaryImageAttachment(message);
  return imageAttachment ? apiUrl(`/api/attachments/${imageAttachment.id}`) : undefined;
};

export const getRenderableImageName = (message: ImageRenderableMessage): string | undefined => {
  if (message.imageName?.trim()) {
    return message.imageName;
  }

  return getPrimaryImageAttachment(message)?.fileName;
};

export const getLatestUserQuestion = (chatMessages: ChatMessage[]): string => {
  for (let index = chatMessages.length - 1; index >= 0; index -= 1) {
    const message = chatMessages[index];
    if (message.role === 'user' && message.content.trim()) {
      return message.content;
    }
  }

  return '';
};

export const hydrateRenderableMessages = (chatMessages: ChatMessage[]): LocalChatMessage[] => {
  return chatMessages.flatMap((message) => {
    const imageSource = getRenderableImageSource(message);
    const imageName = getRenderableImageName(message);
    const content = message.content.trim();

    if (!imageSource || !content) {
      return [{
        ...message,
        isIncomplete: false,
        imagePreviewUrl: imageSource,
        imageName,
      }];
    }

    // 兼容旧历史快照：服务端曾把“图片 + 文字提示”落成同一条消息。
    return [
      {
        ...message,
        content: '',
        isIncomplete: false,
        imagePreviewUrl: imageSource,
        imageName,
      },
      {
        ...message,
        attachments: undefined,
        isIncomplete: false,
        imagePreviewUrl: undefined,
        imageName: undefined,
      },
    ];
  });
};

export const buildConversationText = (chatMessages: ChatMessage[]): string => {
  return chatMessages
    .map((message) => `${message.role}: ${message.content}`)
    .join('\n');
};