export type WorkflowDraftStatusInput = {
  draftUpdatedAt: number | null;
  publishedAt: number | null;
  isSyncingWorkflowDraft: boolean;
};

export type WorkflowDraftStatusView = {
  primary: string;
  secondary?: string;
};

const formatTime = (value: number): string => {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(value);
};

export const getWorkflowDraftStatusView = ({
  draftUpdatedAt,
  publishedAt,
  isSyncingWorkflowDraft,
}: WorkflowDraftStatusInput): WorkflowDraftStatusView => {
  if (isSyncingWorkflowDraft) {
    return {
      primary: 'syncing data',
      secondary: publishedAt ? `已发布 ${formatTime(publishedAt)}` : undefined,
    };
  }

  if (!draftUpdatedAt) {
    return {
      primary: '尚未保存',
      secondary: publishedAt ? `已发布 ${formatTime(publishedAt)}` : undefined,
    };
  }

  return {
    primary: `自动保存于 ${formatTime(draftUpdatedAt)}`,
    secondary: publishedAt ? `已发布 ${formatTime(publishedAt)}` : undefined,
  };
};