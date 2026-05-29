import type { MutableRefObject } from 'react';

export type PlaygroundStreamRequestRefs = {
  activeRequestIdRef: MutableRefObject<number>;
  interruptedRequestIdsRef: MutableRefObject<Set<number>>;
  activeControllerRef: MutableRefObject<AbortController | null>;
};

export const interruptActivePlaygroundStream = (
  refs: PlaygroundStreamRequestRefs,
  callbacks: {
    flushRemainingAssistantBuffer: () => void;
    abortStreamingAssistantMessage: () => void;
    markLastAssistantIncomplete: () => void;
  },
) => {
  const previousRequestId = refs.activeRequestIdRef.current;
  if (!refs.activeControllerRef.current) {
    return previousRequestId;
  }

  refs.interruptedRequestIdsRef.current.add(previousRequestId);
  callbacks.flushRemainingAssistantBuffer();
  callbacks.abortStreamingAssistantMessage();
  callbacks.markLastAssistantIncomplete();
  refs.activeControllerRef.current.abort();
  return previousRequestId;
};

export const beginPlaygroundStreamRequest = (refs: PlaygroundStreamRequestRefs) => {
  const requestId = refs.activeRequestIdRef.current + 1;
  refs.activeRequestIdRef.current = requestId;
  const controller = new AbortController();
  refs.activeControllerRef.current = controller;
  return { requestId, controller };
};
