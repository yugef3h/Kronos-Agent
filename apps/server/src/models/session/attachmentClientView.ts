import type { AttachmentMeta, Message } from './types.js';
import { buildSignedAttachmentPath } from '../../services/attachment/attachmentSignedUrl.js';

export type ClientAttachmentMeta = AttachmentMeta & {
  accessUrl: string;
};

export const augmentAttachmentForClient = (attachment: AttachmentMeta): ClientAttachmentMeta => ({
  ...attachment,
  accessUrl: buildSignedAttachmentPath(attachment.id),
});

export const augmentMessageAttachmentsForClient = (message: Message): Message => {
  if (!message.attachments?.length) {
    return message;
  }

  return {
    ...message,
    attachments: message.attachments.map(augmentAttachmentForClient),
  };
};

export const augmentSessionMessagesForClient = (messages: Message[]): Message[] =>
  messages.map(augmentMessageAttachmentsForClient);
