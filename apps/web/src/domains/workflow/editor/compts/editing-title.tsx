import { useWorkflowDraftStore } from '../../../../store/workflowDraftStore';
import { useShallow } from 'zustand/react/shallow';
import { WORKFLOW_READONLY_EXAMPLE_LABEL, useWorkflowReadOnly } from '../context/workflow-read-only-context';
import { getWorkflowDraftStatusView } from '../utils/workflow-draft-status';

export const EditingTitle = () => {
  const { isReadOnly } = useWorkflowReadOnly();
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

  if (isReadOnly) {
    return (
      <p className="mt-1 text-[11px] leading-4 text-slate-500">
        {WORKFLOW_READONLY_EXAMPLE_LABEL}：内容不可修改，可测试运行、单节点调试与查看上次运行。
      </p>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-2 text-[11px] leading-4">
      <span className={isSyncingWorkflowDraft ? 'font-medium text-amber-700' : 'text-slate-500'}>
        {status.primary}
      </span>
      {status.secondary ? <span className="text-slate-400">{status.secondary}</span> : null}
    </div>
  );
};
