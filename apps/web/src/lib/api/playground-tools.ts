import { apiUrl, readApiErrorMessage } from '../api';

export type PlaygroundToolDescriptor = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  enabled: boolean;
};

export type PlaygroundToolsResponse = {
  tools: PlaygroundToolDescriptor[];
  configuredToolNames: string[];
};

export const requestPlaygroundTools = async (params: {
  authToken: string;
}): Promise<PlaygroundToolsResponse> => {
  const response = await fetch(apiUrl('/api/playground/tools'), {
    headers: {
      Authorization: `Bearer ${params.authToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, 'Failed to load playground tools'));
  }

  return (await response.json()) as PlaygroundToolsResponse;
};
