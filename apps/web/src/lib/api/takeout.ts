import { apiUrl } from './core';
import type { TakeoutInstruction, TakeoutSimulationPayload, TakeoutSimulationResponse, TakeoutIntentAnalysisResponse, TakeoutOrchestrationResponse, TakeoutCatalogResponse } from './types/takeout';

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
	sessionId?: string;
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
			sessionId: params.sessionId,
		}),
	});

	if (!response.ok) {
		throw new Error('Failed to request takeout orchestration');
	}

	return (await response.json()) as TakeoutOrchestrationResponse;
};

export const requestTakeoutCatalog = async (params: {
	authToken: string;
	prompt: string;
	address?: string;
}): Promise<TakeoutCatalogResponse> => {
	const response = await fetch(apiUrl('/api/takeout/catalog'), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${params.authToken}`,
		},
		body: JSON.stringify({
			prompt: params.prompt,
			address: params.address,
		}),
	});

	if (!response.ok) {
		throw new Error('Failed to request takeout catalog');
	}

	return (await response.json()) as TakeoutCatalogResponse;
};
