import { putWorkflowDraftPreview } from '../../lib/api';
import { isWorkflowExampleAppId, putWorkflowExamplePreview } from './workflowExampleClient';
import { markWorkflowDraftPreviewBackendSynced } from './workflowAppStore';

/** 缩略图同步到后端磁盘；成功后在应用元数据中打标，列表用 GET URL 展示 */
export async function syncWorkflowDraftPreviewToBackend(
  appId: string,
  dataUrl: string,
): Promise<void> {
  try {
    const result = isWorkflowExampleAppId(appId)
      ? await putWorkflowExamplePreview(appId, dataUrl)
      : await putWorkflowDraftPreview(appId, dataUrl);
    if (result.ok) {
      if (!isWorkflowExampleAppId(appId)) {
        markWorkflowDraftPreviewBackendSynced(appId, true);
      }
      return;
    }
    console.warn('[workflow:preview] 后端 PUT 未成功', {
      appId,
      status: result.status,
      reason: result.errorMessage,
    });
  } catch (err) {
    console.warn('[workflow:preview] 后端 PUT 异常', { appId, err });
  }
}
