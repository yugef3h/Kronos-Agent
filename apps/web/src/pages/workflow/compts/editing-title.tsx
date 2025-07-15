import { useWorkflowDraftStore } from '../../../store/workflowDraftStore';
import { useShallow } from 'zustand/react/shallow';
import { getWorkflowDraftStatusView } from '../utils/workflow-draft-status';

export const EditingTitle = () => {
  const { draftUpdatedAt, publishedAt, isSyncingWorkflowDraft } = useWorkflowDraftStore(
    useShallow((state) => ({
      draftUpdatedAt: state.draftUpdatedAt,
      publishedAt: state.publishedAt,
      isSyncingWorkflowDraft: state.isSyncingWorkflowDraft,
    })),
  );

  const status = getWorkflowDraftStatusView({
    draftUpdatedAt,
    publishedAt,
    isSyncingWorkflowDraft,
  });

  return (
    <div className="mt-1 flex items-center gap-2 text-[11px] leading-4">
      <span className={isSyncingWorkflowDraft ? 'font-medium text-amber-700' : 'text-slate-500'}>
        {status.primary}
      </span>
      {status.secondary ? <span className="text-slate-400">{status.secondary}</span> : null}
    </div>
  );
};