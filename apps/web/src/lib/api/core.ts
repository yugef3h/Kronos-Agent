import { isViteDev } from '../viteEnv';

const readViteApiBaseUrl = (): string | undefined => {
	try {
		const value = Function('return import.meta?.env?.VITE_API_BASE_URL')() as string | undefined;
		if (typeof value === 'string' && value.trim().length > 0) {
			return value.trim().replace(/\/$/, '');
		}
		return undefined;
	} catch {
		return undefined;
	}
};

const resolveApiBaseUrl = (): string => {
	const configured = readViteApiBaseUrl();
	if (configured) {
		return configured;
	}

	// dev：同源请求走 Vite proxy → 后端，避免硬编码 localhost:3001
	if (isViteDev()) {
		return '';
	}

	return 'http://localhost:3001';
};

const API_BASE_URL = resolveApiBaseUrl();

export const apiUrl = (path: string): string => {
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
};

export const knowledgeDatasetApiPath = (datasetId: string, suffix = '') =>
	`/api/workflow/knowledge-datasets/${encodeURIComponent(datasetId)}${suffix}`;

export type ApiErrorPayload = {
	error?:
		| string
		| {
			code?: unknown;
			message?: unknown;
			formErrors?: unknown;
			fieldErrors?: unknown;
		};
	/** 知识库导入 409 等接口在顶层返回人类可读文案 */
	message?: string;
};

export const extractStructuredApiErrorMessage = (payload: ApiErrorPayload) => {
	if (typeof payload.message === 'string' && payload.message.trim()) {
		return payload.message.trim();
	}

	if (typeof payload.error === 'string' && payload.error.trim()) {
		return payload.error.trim();
	}

	if (!payload.error || typeof payload.error !== 'object') {
		return '';
	}

	if (typeof payload.error.message === 'string' && payload.error.message.trim()) {
		return payload.error.message.trim();
	}

	if (Array.isArray(payload.error.formErrors)) {
		const formMessage = payload.error.formErrors.find(
			(item): item is string => typeof item === 'string' && Boolean(item.trim()),
		);
		if (formMessage) {
			return formMessage.trim();
		}
	}

	if (payload.error.fieldErrors && typeof payload.error.fieldErrors === 'object') {
		for (const value of Object.values(payload.error.fieldErrors)) {
			if (!Array.isArray(value)) {
				continue;
			}

			const fieldMessage = value.find(
				(item): item is string => typeof item === 'string' && Boolean(item.trim()),
			);
			if (fieldMessage) {
				return fieldMessage.trim();
			}
		}
	}

	return '';
};

export const readApiErrorMessage = async (response: Response, fallback: string) => {
	try {
		const contentType = response.headers.get('content-type') || '';
		if (contentType.includes('application/json')) {
			const payload = await response.json() as ApiErrorPayload;
			const message = extractStructuredApiErrorMessage(payload);
			if (message) {
				return message;
			}
		}

		const text = await response.text();
		if (text.trim()) {
			return text.trim();
		}
	} catch {
		// noop
	}

	return fallback;
};
