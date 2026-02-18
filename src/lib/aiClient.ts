import { runtimeConfig } from '@/lib/runtimeConfig';
import { getStoredSupabaseAccessToken } from '@/lib/supabase';
import type { AiChatRequest, AiChatResponse } from '@/types';

const AI_REQUEST_TIMEOUT_MS = 120000;
const AI_NETWORK_RETRY_DELAY_MS = 900;

function isValidAiChatResponse(payload: unknown): payload is AiChatResponse {
  const value = payload as Partial<AiChatResponse> | null;
  return Boolean(
    value &&
      typeof value.threadId === 'string' &&
      (value.mode === 'answer' || value.mode === 'action_proposal') &&
      value.assistantMessage &&
      typeof value.assistantMessage.content === 'string'
  );
}

async function postAiMessage(request: AiChatRequest): Promise<AiChatResponse> {
  const accessToken = getStoredSupabaseAccessToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
  const endpoint = `${runtimeConfig.orchestratorBaseUrl}/ai/chat`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(request),
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`AI request failed (${response.status}): ${bodyText || 'no response body'}`);
  }

  const payload = (await response.json()) as unknown;
  if (!isValidAiChatResponse(payload)) {
    throw new Error('AI response shape invalid');
  }

  return payload;
}

export async function sendAiMessage(request: AiChatRequest): Promise<AiChatResponse> {
  try {
    return await postAiMessage(request);
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) {
      await new Promise((resolve) => setTimeout(resolve, AI_NETWORK_RETRY_DELAY_MS));
      try {
        return await postAiMessage(request);
      } catch (retryError) {
        if (retryError instanceof Error && retryError.name === 'AbortError') {
          throw new Error(
            `AI request timed out after ${Math.round(AI_REQUEST_TIMEOUT_MS / 1000)}s.`
          );
        }
        if (retryError instanceof TypeError) {
          throw new Error(
            `Failed to reach AI orchestrator at ${runtimeConfig.orchestratorBaseUrl}. Check that 'npm run ai:dev' is running.`
          );
        }
        throw retryError;
      }
    }
    throw error;
  }
}
