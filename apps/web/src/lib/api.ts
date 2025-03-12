const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const apiUrl = (path: string): string => `${API_BASE_URL}${path}`;

export type DevTokenResponse = {
	token: string;
	tokenType: 'Bearer';
	expiresIn: string;
};

export const requestDevToken = async (): Promise<DevTokenResponse> => {
	const response = await fetch(apiUrl('/api/dev/token'));

	if (!response.ok) {
		throw new Error('Failed to request dev JWT token');
	}

	return (await response.json()) as DevTokenResponse;
};
