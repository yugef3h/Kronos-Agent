import { apiUrl, readApiErrorMessage } from './core';

/** 工作流草稿画布缩略图（磁盘缓存，避免 localStorage 配额） */
export async function putWorkflowDraftPreview(
  appId: string,
  dataUrl: string,
  authToken?: string,
): Promise<{
	ok: boolean;
	status: number;
	errorMessage?: string;
}> {
	try {
		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		const token = authToken?.trim();
		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}

		const response = await fetch(
			apiUrl(`/api/workflow/apps/${encodeURIComponent(appId)}/draft-preview`),
			{
				method: 'PUT',
				headers,
				body: JSON.stringify({ dataUrl }),
			},
		);
		if (response.ok) {
			return { ok: true, status: response.status };
		}

		const errorMessage = await readApiErrorMessage(response, 'Failed to save workflow draft preview');
		return { ok: false, status: response.status, errorMessage };
	} catch (error) {
		return {
			ok: false,
			status: 0,
			errorMessage: error instanceof Error ? error.message : 'Network request failed',
		};
	}
}
