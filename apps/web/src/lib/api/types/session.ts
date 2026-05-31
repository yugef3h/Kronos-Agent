export type DevTokenResponse = {
	token: string;
	tokenType: 'Bearer';
	expiresIn: string;
};

export type SessionSnapshotResponse = {
	messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: number; attachments?: { id: string; type: 'image'; fileName: string; mimeType: string; size: number; createdAt: number }[] }>;
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

export type PlaygroundHistorySurface = 'default' | 'published';

export type RecentDialogueItem = {
	id: string;
	sessionId: string;
	updatedAt: number;
	userContent: string;
	playgroundSurface: PlaygroundHistorySurface;
	basePlaygroundSessionId: string;
	publishedChatbotWorkflowAppId: string | null;
};

export type RecentDialogueItemDto = {
	id: string;
	sessionId: string;
	updatedAt: number;
	userContent: string;
	playgroundSurface?: PlaygroundHistorySurface;
	basePlaygroundSessionId?: string;
	publishedChatbotWorkflowAppId?: string | null;
};

export type RecentSessionResponse = {
	items: RecentDialogueItem[];
};

export type HotTopicsResponse = {
	topics: string[];
	source: 'model' | 'fallback';
};

export type SessionAppendMessage = {
	role: 'user' | 'assistant';
	content: string;
};

const PUBLISHED_PLAYGROUND_STREAM_MARKER = '-chatbot-';

export const tryParsePublishedPlaygroundStreamSessionId = (
	streamSessionId: string,
): { baseSessionId: string; workflowAppId: string } | null => {
	if (!streamSessionId.startsWith('playground-')) {
		return null;
	}
	const markerIndex = streamSessionId.indexOf(PUBLISHED_PLAYGROUND_STREAM_MARKER);
	if (markerIndex < 0) {
		return null;
	}
	const baseSessionId = streamSessionId.slice('playground-'.length, markerIndex);
	const workflowAppId = streamSessionId.slice(markerIndex + PUBLISHED_PLAYGROUND_STREAM_MARKER.length);
	if (!baseSessionId || !workflowAppId) {
		return null;
	}
	return { baseSessionId, workflowAppId };
};

export const normalizeRecentDialogueItemDto = (row: RecentDialogueItemDto): RecentDialogueItem => {
	const parsed = tryParsePublishedPlaygroundStreamSessionId(row.sessionId);
	if (parsed) {
		return {
			id: row.id,
			sessionId: row.sessionId,
			updatedAt: row.updatedAt,
			userContent: row.userContent,
			playgroundSurface: 'published',
			basePlaygroundSessionId: row.basePlaygroundSessionId ?? parsed.baseSessionId,
			publishedChatbotWorkflowAppId: row.publishedChatbotWorkflowAppId ?? parsed.workflowAppId,
		};
	}
	return {
		id: row.id,
		sessionId: row.sessionId,
		updatedAt: row.updatedAt,
		userContent: row.userContent,
		playgroundSurface: 'default',
		basePlaygroundSessionId: row.sessionId,
		publishedChatbotWorkflowAppId: null,
	};
};
