import { getWorkflowDraftStatusView } from './workflow-draft-status';

describe('workflow-draft-status', () => {
  it('prefers syncing text while a draft sync is in flight', () => {
    expect(getWorkflowDraftStatusView({
      draftUpdatedAt: 1710000000000,
      publishedAt: null,
      isSyncingWorkflowDraft: true,
    }).primary).toBe('syncing data');
  });

  it('shows the auto-saved time when a draft has been persisted', () => {
    const status = getWorkflowDraftStatusView({
      draftUpdatedAt: 1710000000000,
      publishedAt: null,
      isSyncingWorkflowDraft: false,
    });

    expect(status.primary.startsWith('自动保存于 ')).toBe(true);
  });

  it('includes publish information when publishedAt is available', () => {
    const status = getWorkflowDraftStatusView({
      draftUpdatedAt: 1710000000000,
      publishedAt: 1710003600000,
      isSyncingWorkflowDraft: false,
    });

    expect(status.secondary?.startsWith('已发布 ')).toBe(true);
  });
});