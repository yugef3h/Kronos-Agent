import { apiUrl, readApiErrorMessage } from './core';
import type { DevTokenResponse, SessionSnapshotResponse, RecentDialogueItemDto, RecentSessionResponse, HotTopicsResponse, SessionAppendMessage } from './types/session';
import { normalizeRecentDialogueItemDto } from './types/session';

export const requestDevToken = async (): Promise<DevTokenResponse> => {
	const response = await fetch(apiUrl('/api/dev/token'));

	if (!response.ok) {
		throw new Error('Failed to request dev JWT token');
	}

	return (await response.json()) as DevTokenResponse;
};

export const requestSessionSnapshot = async (params: {
	sessionId: string;
	authToken: string;
}): Promise<SessionSnapshotResponse> => {
	const response = await fetch(apiUrl(`/api/session/${params.sessionId}`), {
		headers: {
			Authorization: `Bearer ${params.authToken}`,
		},
	});

	if (!response.ok) {
			throw new Error(await readApiErrorMessage(response, 'Failed to request session snapshot'));
	}

	return (await response.json()) as SessionSnapshotResponse;
};

export const requestRecentSessions = async (params: {
	authToken: string;
	limit?: number;
}): Promise<RecentSessionResponse> => {
	const limit = params.limit ?? 10;
	const response = await fetch(apiUrl(`/api/sessions/recent?limit=${limit}`), {
		headers: {
			Authorization: `Bearer ${params.authToken}`,
		},
	});

	if (!response.ok) {
			throw new Error(await readApiErrorMessage(response, 'Failed to request recent sessions'));
	}

	const payload = (await response.json()) as { items: RecentDialogueItemDto[] };
	return {
		items: payload.items.map(normalizeRecentDialogueItemDto),
	};
};

export const requestHotTopics = async (params: {
	authToken: string;
}): Promise<HotTopicsResponse> => {
	const response = await fetch(apiUrl('/api/hot-topics'), {
		headers: {
			Authorization: `Bearer ${params.authToken}`,
		},
	});

	if (!response.ok) {
		throw new Error('Failed to request hot topics');
	}

	return (await response.json()) as HotTopicsResponse;
};

export const requestAppendSessionMessages = async (params: {
	authToken: string;
	sessionId: string;
	messages: SessionAppendMessage[];
}): Promise<void> => {
	const response = await fetch(apiUrl('/api/session/append'), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${params.authToken}`,
		},
		body: JSON.stringify({
			sessionId: params.sessionId,
			messages: params.messages,
		}),
	});

	if (!response.ok) {
		throw new Error('Failed to append session messages');
	}
};
