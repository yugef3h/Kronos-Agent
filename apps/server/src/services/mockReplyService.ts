export async function* streamMockReply(prompt: string): AsyncGenerator<string> {
  const mockText = `You asked: ${prompt}. Configure Doubao env vars to switch from mock to LangChain stream.`;

  for (const token of mockText.split('')) {
    yield token;
    await new Promise((resolve) => setTimeout(resolve, 24));
  }
}
