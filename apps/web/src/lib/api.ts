const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const apiUrl = (path: string): string => `${API_BASE_URL}${path}`;

export type DevTokenResponse = {
	token: string;
	tokenType: 'Bearer';
	expiresIn: string;
};

export type SessionSnapshotResponse = {
	messages: Array<{ role: 'user' | 'assistant'; content: string }>;
	memorySummary: string;
	memorySummaryUpdatedAt: number | null;
	lastId: number;
	memoryMetrics: {
		messageCount: number;
		conversationTokensEstimate: number;
		summaryTokensEstimate: number;
		budgetTokensEstimate: number;
		summaryTriggerMessageCount: number;
		isSummaryThresholdReached: boolean;
	};
};

export type RecentDialogueItem = {
	id: string;
	sessionId: string;
	updatedAt: number;
	userContent: string;
};

export type RecentSessionResponse = {
	items: RecentDialogueItem[];
};

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
		throw new Error('Failed to request session snapshot');
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
		throw new Error('Failed to request recent sessions');
	}

	return (await response.json()) as RecentSessionResponse;
};
