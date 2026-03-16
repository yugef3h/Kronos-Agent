const readViteApiBaseUrl = (): string | undefined => {
	try {
		return Function('return import.meta?.env?.VITE_API_BASE_URL')() as string | undefined;
	} catch {
		return undefined;
	}
};

const API_BASE_URL = readViteApiBaseUrl() || 'http://localhost:3001';

export const apiUrl = (path: string): string => `${API_BASE_URL}${path}`;

export type DevTokenResponse = {
	token: string;
	tokenType: 'Bearer';
	expiresIn: string;
};

export type SessionSnapshotResponse = {
	messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: number }>;
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

export type TakeoutInstruction = '识别外卖意图' | '协议同意回复' | '商品选择完成';

export type TakeoutSimulationPayload = {
	prompt?: string;
	address?: string;
	discount?: number;
};

export type TakeoutSimulationResponse = {
	reply: string;
	source: 'scenario';
	traceId: string;
	intent?: 'takeout_order' | 'takeout_recommend' | 'non_takeout';
	confidence?: number;
	slots?: {
		dishType: string | null;
		addressHint: string | null;
		budgetRange: string | null;
		timeConstraint: string | null;
		tastePreference: string[];
	};
	missingSlots?: Array<'dishType' | 'addressHint' | 'budgetRange' | 'timeConstraint'>;
	nextAction?: 'start_takeout_flow' | 'ask_for_slot' | 'fallback_to_chat';
};

export type TakeoutIntentAnalysisResponse = {
	intent: 'takeout_order' | 'takeout_recommend' | 'non_takeout';
	confidence: number;
	slots: {
		dishType: string | null;
		addressHint: string | null;
		budgetRange: string | null;
		timeConstraint: string | null;
		tastePreference: string[];
	};
	missingSlots: Array<'dishType' | 'addressHint' | 'budgetRange' | 'timeConstraint'>;
	nextAction: 'start_takeout_flow' | 'ask_for_slot' | 'fallback_to_chat';
};

export type TakeoutOrchestrationResponse = {
	action: 'chat' | 'ask_slot' | 'tool_call';
	assistantReply: string;
	toolCall?: {
		name: 'takeout';
		params: {
			food: string;
		};
	};
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

export const requestTakeoutSimulation = async (params: {
	authToken: string;
	instruction: TakeoutInstruction;
	payload?: TakeoutSimulationPayload;
}): Promise<TakeoutSimulationResponse> => {
	const response = await fetch(apiUrl('/api/takeout/simulate'), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${params.authToken}`,
		},
		body: JSON.stringify({
			instruction: params.instruction,
			payload: params.payload || {},
		}),
	});

	if (!response.ok) {
		throw new Error('Failed to request takeout simulation');
	}

	return (await response.json()) as TakeoutSimulationResponse;
};

export const requestTakeoutIntentAnalysis = async (params: {
	authToken: string;
	prompt: string;
	history?: string[];
}): Promise<TakeoutIntentAnalysisResponse> => {
	const response = await fetch(apiUrl('/api/takeout/intent-analyze'), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${params.authToken}`,
		},
		body: JSON.stringify({
			prompt: params.prompt,
			history: params.history || [],
		}),
	});

	if (!response.ok) {
		throw new Error('Failed to request takeout intent analysis');
	}

	return (await response.json()) as TakeoutIntentAnalysisResponse;
};

export const requestTakeoutOrchestration = async (params: {
	authToken: string;
	prompt: string;
	history?: string[];
}): Promise<TakeoutOrchestrationResponse> => {
	const response = await fetch(apiUrl('/api/takeout/orchestrate'), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${params.authToken}`,
		},
		body: JSON.stringify({
			prompt: params.prompt,
			history: params.history || [],
		}),
	});

	if (!response.ok) {
		throw new Error('Failed to request takeout orchestration');
	}

	return (await response.json()) as TakeoutOrchestrationResponse;
};
