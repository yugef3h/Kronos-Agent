import { apiUrl } from '../../../lib/api';
import type { AttachmentMeta, ChatMessage } from '../../../types/chat';
import type { LocalChatMessage, TokenizerModule } from '../types';

export const createClientMessageId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const withClientMessageId = (
  message: Omit<LocalChatMessage, 'clientMessageId'> & { clientMessageId?: string },
): LocalChatMessage => ({
  ...message,
  clientMessageId: message.clientMessageId ?? createClientMessageId(),
});

export const createOptimisticAssistantPlaceholder = (): LocalChatMessage => withClientMessageId({
  role: 'assistant',
  content: '',
  isIncomplete: false,
  isStreamingText: true,
  isOptimistic: true,
});

export const markLastUserMessageStatus = (
  messages: LocalChatMessage[],
  status: NonNullable<LocalChatMessage['sendStatus']>,
): LocalChatMessage[] => {
  const lastUserIndex = messages.findLastIndex((message) => message.role === 'user');
  if (lastUserIndex < 0) {
    return messages;
  }

  return messages.map((message, index) => (
    index === lastUserIndex ? { ...message, sendStatus: status } : message
  ));
};

export const removeOptimisticAssistantMessages = (messages: LocalChatMessage[]): LocalChatMessage[] => (
  messages.filter((message) => !message.isOptimistic)
);

export const getMessageListKey = (message: LocalChatMessage, index: number): string => {
  if (message.clientMessageId) {
    return message.clientMessageId;
  }

  return [
    message.role,
    index,
    message.content,
    message.imagePreviewUrl ?? '',
    message.fileName ?? '',
    message.flowType ?? '',
    message.takeoutMessageType ?? '',
  ].join('|');
};

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

const parseLegacyFileAnalyzeMessage = (rawContent: string): {
  fileName: string;
  fileExtension: string;
  prompt: string;
} | null => {
  const content = rawContent.trim();
  const match = /^\[文件\]\s*(.+?)(?:\n需求：([\s\S]*))?$/.exec(content);

  if (!match) {
    return null;
  }

  const fileName = match[1]?.trim() || '';
  if (!fileName) {
    return null;
  }

  const prompt = match[2]?.trim() || '';
  const dotIndex = fileName.lastIndexOf('.');
  const fileExtension = dotIndex > -1 ? fileName.slice(dotIndex + 1).toLowerCase() : '';

  return {
    fileName,
    fileExtension,
    prompt,
  };
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
  if (!imageAttachment) {
    return undefined;
  }

  const accessUrl = imageAttachment.accessUrl?.trim();
  if (accessUrl) {
    return apiUrl(accessUrl.startsWith('/') ? accessUrl : `/${accessUrl}`);
  }

  return undefined;
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

    if (imageSource && content) {
      // 兼容旧历史快照：服务端曾把“图片 + 文字提示”落成同一条消息。
      return [
        withClientMessageId({
          ...message,
          content: '',
          isIncomplete: false,
          imagePreviewUrl: imageSource,
          imageName,
        }),
        withClientMessageId({
          ...message,
          attachments: undefined,
          isIncomplete: false,
          imagePreviewUrl: undefined,
          imageName: undefined,
        }),
      ];
    }

    const legacyFileMessage = message.role === 'user' ? parseLegacyFileAnalyzeMessage(content) : null;

    if (legacyFileMessage) {
      const fileCardMessage = withClientMessageId({
        ...message,
        content: '',
        isIncomplete: false,
        fileName: legacyFileMessage.fileName,
        fileExtension: legacyFileMessage.fileExtension || undefined,
      });

      if (!legacyFileMessage.prompt) {
        return [fileCardMessage];
      }

      return [
        fileCardMessage,
        withClientMessageId({
          ...message,
          content: legacyFileMessage.prompt,
          isIncomplete: false,
          attachments: undefined,
          imagePreviewUrl: undefined,
          imageName: undefined,
          fileName: undefined,
          fileExtension: undefined,
          fileSize: undefined,
        }),
      ];
    }

    return [withClientMessageId({
      ...message,
      isIncomplete: false,
      imagePreviewUrl: imageSource,
      imageName,
    })];
  });
};

export const buildConversationText = (chatMessages: ChatMessage[]): string => {
  return chatMessages
    .map((message) => `${message.role}: ${message.content}`)
    .join('\n');
};