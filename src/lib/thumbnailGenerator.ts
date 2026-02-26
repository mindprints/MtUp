import type { Proposal } from '@/types';

type OpenRouterImageResponse = {
  choices?: Array<{
    message?: {
      images?: Array<{
        type?: string;
        image_url?: { url?: string };
      }>;
      content?: string;
    };
  }>;
  error?: { message?: string };
};

function getThumbnailProvider(): string {
  return String((import.meta as any).env?.VITE_THUMBNAIL_PROVIDER || 'openrouter').trim().toLowerCase();
}

function getOpenRouterApiKey(): string {
  return String(
    (import.meta as any).env?.VITE_THUMBNAIL_OPENROUTER_API_KEY ||
      (import.meta as any).env?.VITE_OPENROUTER_API_KEY ||
      ''
  ).trim();
}

function getOpenRouterBaseUrl(): string {
  return (
    String((import.meta as any).env?.VITE_THUMBNAIL_OPENROUTER_BASE_URL || '').trim() ||
    'https://openrouter.ai/api/v1'
  );
}

function getOpenRouterModel(): string {
  return (
    String((import.meta as any).env?.VITE_THUMBNAIL_OPENROUTER_MODEL || '').trim() ||
    'google/gemini-3.1-flash-image-preview'
  );
}

export function canGenerateProposalThumbnail(): boolean {
  return getThumbnailProvider() === 'openrouter' && Boolean(getOpenRouterApiKey());
}

export function getThumbnailGeneratorDebugState(): {
  provider: string;
  hasApiKey: boolean;
  hasModel: boolean;
  baseUrl: string;
} {
  return {
    provider: getThumbnailProvider(),
    hasApiKey: Boolean(getOpenRouterApiKey()),
    hasModel: Boolean(getOpenRouterModel()),
    baseUrl: getOpenRouterBaseUrl(),
  };
}

function buildPrompt(proposal: Proposal): string {
  const details = [
    proposal.title,
    proposal.type === 'sejour' ? 'multi-day social trip / stay' : 'social meetup event',
    proposal.specifics?.date ? `Date context: ${proposal.specifics.date}` : null,
    proposal.specifics?.time ? `Time context: ${proposal.specifics.time}` : null,
    proposal.specifics?.location ? `Location context: ${proposal.specifics.location}` : null,
  ]
    .filter(Boolean)
    .join('. ');

  return `A high-quality, aesthetic, and inviting thumbnail image for a social group planning app. The proposal is: ${details}. The image should feel warm, modern, and suitable for a contemporary coordination interface. No text in the image.`;
}

export async function generateProposalThumbnail(proposal: Proposal): Promise<string> {
  const provider = getThumbnailProvider();
  if (provider !== 'openrouter') {
    throw new Error(`Unsupported thumbnail provider: ${provider}`);
  }
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error('Missing VITE_THUMBNAIL_OPENROUTER_API_KEY');
  }

  const response = await fetch(`${getOpenRouterBaseUrl()}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getOpenRouterModel(),
      modalities: ['image', 'text'],
      messages: [
        {
          role: 'user',
          content: buildPrompt(proposal),
        },
      ],
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter thumbnail request failed (${response.status}): ${body || 'no body'}`);
  }

  const payload = (await response.json()) as OpenRouterImageResponse;
  if (payload.error?.message) {
    throw new Error(payload.error.message);
  }

  const images = payload.choices?.[0]?.message?.images || [];
  for (const image of images) {
    const url = image.image_url?.url;
    if (typeof url === 'string' && url.startsWith('data:image/')) {
      return url;
    }
  }

  throw new Error('No image returned by OpenRouter model');
}
